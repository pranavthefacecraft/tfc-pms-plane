# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Authoritative, row-locked whiteboard collaboration and board-scoped sharing."""

import json
import math
import os
import time
import uuid

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.bgtasks.workspace_seed_task import workspace_seed
from plane.db.models import Page, Profile, User, Workspace, WorkspaceMember
from plane.license.utils.instance_value import get_configuration_value
from ..base import BaseAPIView
from .workspace import WorkspacePageMixin, _serialize_user, allow_board_guest

ROLES = [ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST]
LEASE_SECONDS = 30
MAX_SCENE_BYTES = 8 * 1024 * 1024


def board_role(page, user):
    if page.owned_by_id == user.id:
        return "owner"
    member = WorkspaceMember.objects.filter(workspace_id=page.workspace_id, member=user, is_active=True).first()
    if member:
        role = page.whiteboard_roles.get(str(user.id))
        if role in ("viewer", "editor"):
            return role
    if not member and str(user.id) in page.whiteboard_guest_ids and page.whiteboard_guest_role in ("viewer", "editor"):
        return page.whiteboard_guest_role
    return "editor" if member and member.role >= ROLE.MEMBER.value and page.access == Page.PUBLIC_ACCESS else "viewer"


def presenting(page):
    presenter = page.whiteboard_session.get("presenter")
    return presenter if presenter and presenter.get("expires", 0) > time.time() else None


def require_board_editor(page, user):
    if board_role(page, user) not in ("owner", "editor") or presenting(page):
        raise PermissionDenied("Editing is paused during presentation or you have viewer access.")


def merge_scene(current, incoming):
    """Keep tombstones and resolve concurrent versions deterministically, like Excalidraw."""
    if not isinstance(incoming, dict) or len(json.dumps(incoming)) > MAX_SCENE_BYTES:
        raise ValidationError("Invalid or oversized scene.")
    elements = incoming.get("elements", [])
    files = incoming.get("files", {})
    if not isinstance(elements, list) or len(elements) > 20000 or not isinstance(files, dict):
        raise ValidationError("Invalid scene elements or files.")
    merged = {element["id"]: element for element in current.get("elements", [])}
    for element in elements:
        if not isinstance(element, dict) or not isinstance(element.get("id"), str):
            raise ValidationError("Each element needs an id.")
        for key in ("version", "versionNonce"):
            value = element.get(key)
            if type(value) is not int or value < 0 or value > 2**53 - 1:
                raise ValidationError("Invalid element version.")
        old = merged.get(element["id"])
        if (
            old is None
            or element["version"] > old.get("version", 0)
            or (element["version"] == old.get("version", 0) and element["versionNonce"] < old.get("versionNonce", 0))
        ):
            merged[element["id"]] = element
    result = {
        **current,
        "elements": list(merged.values()),
        "files": {**current.get("files", {}), **files},
    }
    if "background" in incoming:
        color = incoming["background"]
        if not isinstance(color, str) or len(color) > 100:
            raise ValidationError("Invalid canvas background.")
        result["appState"] = {**current.get("appState", {}), "viewBackgroundColor": color}
    if len(json.dumps(result)) > MAX_SCENE_BYTES:
        raise ValidationError("Whiteboard exceeds the 8 MB collaboration limit.")
    return result


class SessionInput(serializers.Serializer):
    action = serializers.ChoiceField(choices=["heartbeat", "leave", "scene", "present", "stop", "viewport"])
    client_id = serializers.UUIDField()
    scene = serializers.DictField(required=False)
    viewport = serializers.DictField(required=False)


def viewport_value(data):
    viewport = data.get("viewport", {})
    if set(viewport) != {"scrollX", "scrollY", "zoom"} or any(
        type(value) not in (float, int) or not math.isfinite(value) for value in viewport.values()
    ):
        raise ValidationError("Invalid presenter viewport.")
    if not 0.1 <= viewport["zoom"] <= 30 or any(abs(viewport[key]) > 1e9 for key in ("scrollX", "scrollY")):
        raise ValidationError("Presenter viewport is out of range.")
    return viewport


def session_response(page, user):
    now = time.time()
    members = {
        str(member.member_id): member.member
        for member in WorkspaceMember.objects.filter(workspace_id=page.workspace_id, is_active=True).select_related(
            "member"
        )
    }
    if page.whiteboard_guest_role in ("viewer", "editor"):
        members.update(
            {
                str(user.id): user
                for user in User.objects.filter(pk__in=page.whiteboard_guest_ids, is_active=True, is_bot=False)
            }
        )
    participants = []
    for client_id, entry in page.whiteboard_session.get("participants", {}).items():
        member = members.get(entry["user_id"])
        if (
            member
            and entry["expires"] > now
            and (
                page.access == Page.PUBLIC_ACCESS
                or member.id == page.owned_by_id
                or entry["user_id"] in page.whiteboard_roles
                or entry["user_id"] in page.whiteboard_guest_ids
            )
        ):
            participants.append({"client_id": client_id, "user": _serialize_user(member)})
    return {
        "revision": page.whiteboard_revision,
        "scene": page.description_json,
        "role": board_role(page, user),
        "user": _serialize_user(user),
        "presenter": presenting(page),
        "participants": participants,
    }


class WhiteboardSessionEndpoint(WorkspacePageMixin, BaseAPIView):
    def board(self, request, slug, page_id, lock=False):
        pages = self.get_pages(request, slug).filter(pk=page_id, tool_type=Page.TOOL_TYPE_WHITEBOARD)
        # Lock only the page, not nullable joined user records.
        if lock:
            pages = pages.select_for_update(of=("self",))
        page = pages.first()
        if page is None:
            raise NotFound("Whiteboard not found.")
        return page

    @allow_board_guest
    def get(self, request, slug, page_id):
        return Response(session_response(self.board(request, slug, page_id), request.user))

    @allow_board_guest
    def post(self, request, slug, page_id):
        serializer = SessionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        action, client_id = data["action"], str(data["client_id"])
        with transaction.atomic():
            page = self.board(request, slug, page_id, lock=True)
            session = page.whiteboard_session
            now = time.time()
            participants = {
                key: value for key, value in session.get("participants", {}).items() if value["expires"] > now
            }
            existing = participants.get(client_id)
            if existing and existing["user_id"] != str(request.user.id):
                raise PermissionDenied("Participant id belongs to another user.")
            presenter = presenting(page)
            if action == "scene":
                require_board_editor(page, request.user)
                if "scene" not in data:
                    raise ValidationError("A scene is required.")
                page.description_json = merge_scene(page.description_json, data["scene"])
            if action == "present":
                if page.owned_by_id != request.user.id:
                    raise PermissionDenied("Only the whiteboard owner can present.")
                if presenter and presenter["client_id"] != client_id:
                    raise ValidationError("Another session is already presenting.")
                presenter = {"client_id": client_id, "user_id": str(request.user.id), "viewport": viewport_value(data)}
            if action in ("viewport", "stop"):
                if not presenter or presenter["client_id"] != client_id or presenter["user_id"] != str(request.user.id):
                    raise PermissionDenied("Only the active presenter can control presentation.")
                if action == "viewport":
                    presenter["viewport"] = viewport_value(data)
                else:
                    presenter = None
            if action == "leave":
                participants.pop(client_id, None)
                if presenter and presenter["client_id"] == client_id:
                    presenter = None
            else:
                if len(participants) >= 100 and client_id not in participants:
                    raise ValidationError("This whiteboard already has 100 connected sessions.")
                participants[client_id] = {"user_id": str(request.user.id), "expires": now + LEASE_SECONDS}
            if presenter and presenter["client_id"] == client_id:
                presenter["expires"] = now + LEASE_SECONDS
            session.update(participants=participants, presenter=presenter)
            page.whiteboard_session = session
            page.whiteboard_revision += 1
            updates = {"whiteboard_session": session, "whiteboard_revision": page.whiteboard_revision}
            if action == "scene":
                updates["description_json"] = page.description_json
            Page.objects.filter(pk=page.pk).update(**updates)
            return Response(session_response(page, request.user))


class WhiteboardSharingEndpoint(WhiteboardSessionEndpoint):
    @allow_permission(allowed_roles=ROLES, level="WORKSPACE")
    def get(self, request, slug, page_id):
        page = self.board(request, slug, page_id)
        if page.owned_by_id != request.user.id:
            raise PermissionDenied("Only the owner can manage sharing.")
        members = WorkspaceMember.objects.filter(
            workspace_id=page.workspace_id, is_active=True, member__is_bot=False
        ).select_related("member")
        return Response(
            {
                "access": page.access,
                "guest_role": page.whiteboard_guest_role,
                "guests": [
                    _serialize_user(user)
                    for user in User.objects.filter(pk__in=page.whiteboard_guest_ids, is_active=True, is_bot=False)
                ],
                "members": [
                    {
                        "user": _serialize_user(member.member),
                        "role": board_role(page, member.member),
                        "explicit": str(member.member_id) in page.whiteboard_roles,
                    }
                    for member in members
                ],
            }
        )

    @allow_permission(allowed_roles=ROLES, level="WORKSPACE")
    def post(self, request, slug, page_id):
        with transaction.atomic():
            page = self.board(request, slug, page_id, lock=True)
            if page.owned_by_id != request.user.id:
                raise PermissionDenied("Only the owner can manage sharing.")
            if "guest_role" in request.data:
                role = request.data["guest_role"]
                if role not in ("disabled", "viewer", "editor"):
                    raise ValidationError("Choose disabled, viewer, or editor for guest access.")
                page.whiteboard_guest_role = role
                if role == "disabled":
                    page.whiteboard_guest_ids = []
                Page.objects.filter(pk=page.pk).update(
                    whiteboard_guest_role=role, whiteboard_guest_ids=page.whiteboard_guest_ids
                )
                return self.get(request, slug=slug, page_id=page_id)
            try:
                user_id = str(uuid.UUID(str(request.data.get("user_id", ""))))
            except ValueError:
                raise ValidationError("Invalid member id.")
            role = request.data.get("role")
            if user_id in page.whiteboard_guest_ids and role == "remove":
                page.whiteboard_guest_ids.remove(user_id)
                Page.objects.filter(pk=page.pk).update(whiteboard_guest_ids=page.whiteboard_guest_ids)
                return self.get(request, slug=slug, page_id=page_id)
            if role not in ("viewer", "editor", "remove"):
                raise ValidationError("Choose viewer, editor, or remove.")
            if (
                user_id == str(page.owned_by_id)
                or not WorkspaceMember.objects.filter(
                    workspace_id=page.workspace_id, member_id=user_id, is_active=True
                ).exists()
            ):
                raise ValidationError("Choose an active workspace member other than the owner.")
            if role == "remove":
                page.whiteboard_roles.pop(user_id, None)
            else:
                page.whiteboard_roles[user_id] = role
            Page.objects.filter(pk=page.pk).update(whiteboard_roles=page.whiteboard_roles)
        return self.get(request, slug=slug, page_id=page_id)


class WhiteboardGuestEndpoint(WorkspacePageMixin, BaseAPIView):
    def board(self, slug, page_id, lock=False):
        pages = Page.objects.filter(
            pk=page_id,
            workspace__slug=slug,
            is_global=True,
            parent__isnull=True,
            archived_at__isnull=True,
            tool_type=Page.TOOL_TYPE_WHITEBOARD,
        )
        page = (pages.select_for_update() if lock else pages).first()
        if page is None:
            raise NotFound("Whiteboard not found.")
        return page

    def get(self, request, slug, page_id):
        page = self.board(slug, page_id)
        is_member = WorkspaceMember.objects.filter(
            workspace_id=page.workspace_id, member=request.user, is_active=True
        ).exists()
        if not is_member and (page.whiteboard_guest_role == "disabled" or request.user.is_bot):
            raise NotFound("Guest access is not enabled for this whiteboard. Ask the owner to enable it.")
        if is_member and not self.get_pages(request, slug).filter(pk=page_id).exists():
            raise PermissionDenied("This whiteboard has not been shared with you.")
        return Response(
            {
                "is_member": is_member,
                "joined": is_member or str(request.user.id) in page.whiteboard_guest_ids,
                "guest_role": page.whiteboard_guest_role,
            }
        )

    def post(self, request, slug, page_id):
        with transaction.atomic():
            page = self.board(slug, page_id, lock=True)
            if page.whiteboard_guest_role not in ("viewer", "editor") or request.user.is_bot:
                raise PermissionDenied("Guest access is not enabled for this whiteboard.")
            if WorkspaceMember.objects.filter(
                workspace_id=page.workspace_id, member=request.user, is_active=True
            ).exists():
                raise ValidationError("You are already a workspace member.")
            user_id = str(request.user.id)
            if user_id not in page.whiteboard_guest_ids:
                page.whiteboard_guest_ids.append(user_id)
                Page.objects.filter(pk=page.pk).update(whiteboard_guest_ids=page.whiteboard_guest_ids)
        return self.get(request, slug=slug, page_id=page_id)


class WhiteboardGuestWorkspaceEndpoint(WhiteboardGuestEndpoint):
    def post(self, request, slug, page_id):
        with transaction.atomic():
            page = self.board(slug, page_id, lock=True)
            if (
                request.user.is_bot
                or page.whiteboard_guest_role not in ("viewer", "editor")
                or str(request.user.id) not in page.whiteboard_guest_ids
            ):
                raise PermissionDenied("Join this shared whiteboard before opening it in your workspace.")
            # Serialize provisioning across tabs and different shared boards for this account.
            user = User.objects.select_for_update().get(pk=request.user.pk)
            workspace = (
                Workspace.objects.filter(owner=user, workspace_member__member=user, workspace_member__is_active=True)
                .exclude(pk=page.workspace_id)
                .order_by("created_at", "id")
                .first()
            )
            if workspace is None:
                (disabled,) = get_configuration_value(
                    [
                        {
                            "key": "DISABLE_WORKSPACE_CREATION",
                            "default": os.environ.get("DISABLE_WORKSPACE_CREATION", "0"),
                        }
                    ]
                )
                if disabled == "1":
                    raise PermissionDenied("Your instance administrator has disabled workspace creation.")
                name = "".join(
                    character
                    for character in (user.first_name or user.display_name)
                    if character.isalnum() or character == " "
                ).strip()
                workspace = Workspace.objects.create(
                    owner=user,
                    name=f"{name[:60]}'s workspace" if name else "Personal workspace",
                    slug=f"personal-{uuid.uuid4().hex}",
                    organization_size="Just myself",
                )
                WorkspaceMember.objects.create(workspace=workspace, member=user, role=ROLE.ADMIN.value)
                transaction.on_commit(lambda: workspace_seed.delay(str(workspace.id)))
            profile, _ = Profile.objects.get_or_create(user=user)
            if not profile.is_onboarded:
                profile.is_onboarded = True
                profile.onboarding_step = {
                    **profile.onboarding_step,
                    "profile_complete": True,
                    "workspace_create": True,
                    "workspace_invite": True,
                    "workspace_join": True,
                }
            profile.last_workspace_id = workspace.id
            profile.save(update_fields=["is_onboarded", "onboarding_step", "last_workspace_id", "updated_at"])
        return Response({"workspace_slug": workspace.slug})
