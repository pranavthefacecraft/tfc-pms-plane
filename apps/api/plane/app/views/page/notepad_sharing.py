import uuid

from django.core import signing
from django.db import transaction
from django.utils.crypto import constant_time_compare
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.app.permissions import ROLE
from plane.bgtasks.notepad_invitation_task import notepad_invitation
from plane.db.models import Page, User, WorkspaceMember
from plane.utils.host import base_host

SALT = "notepad-invitation"


def sharing_page(user, slug, page_id, lock=False):
    pages = Page.objects.filter(
        pk=page_id,
        workspace__slug=slug,
        is_global=True,
        parent__isnull=True,
        archived_at__isnull=True,
        tool_type=Page.TOOL_TYPE_PAGE,
    )
    if lock:
        pages = pages.select_for_update()
    page = pages.first()
    if page is None:
        raise NotFound("Notepad not found.")
    if (
        user.is_bot
        or page.owned_by_id != user.id
        or not WorkspaceMember.objects.filter(
            workspace_id=page.workspace_id, member=user, is_active=True, role__gte=ROLE.MEMBER.value
        ).exists()
    ):
        raise PermissionDenied("Only the notepad owner can manage collaborators.")
    return page


def sharing_response(page):
    return {
        "access": page.access,
        "collaborators": [
            {"id": str(user.id), "name": user.display_name or user.first_name, "email": user.email}
            for user in User.objects.filter(pk__in=page.notepad_collaborators, is_active=True, is_bot=False)
        ],
        "pending": list(page.notepad_invitations),
    }


class InvitationInput(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class NotepadSharingEndpoint(BaseAPIView):
    def get(self, request, slug, page_id):
        return Response(sharing_response(sharing_page(request.user, slug, page_id)))

    def post(self, request, slug, page_id):
        serializer = InvitationInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        if email == request.user.email.lower():
            raise ValidationError("You already own this notepad.")
        with transaction.atomic():
            page = sharing_page(request.user, slug, page_id, lock=True)
            if User.objects.filter(pk__in=page.notepad_collaborators, email__iexact=email).exists():
                raise ValidationError("This person already has access.")
            if (
                email not in page.notepad_invitations
                and len(page.notepad_invitations) + len(page.notepad_collaborators) >= 100
            ):
                raise ValidationError("A notepad can have up to 100 collaborators and pending invitations.")
            nonce = uuid.uuid4().hex
            page.notepad_invitations[email] = nonce
            page.save(update_fields=["notepad_invitations"])
            token = signing.dumps({"page": str(page.id), "email": email, "nonce": nonce}, salt=SALT)
            transaction.on_commit(
                lambda: notepad_invitation.delay(str(page.id), email, token, base_host(request=request, is_app=True))
            )
        return Response(sharing_response(page), status=202)

    def delete(self, request, slug, page_id):
        with transaction.atomic():
            page = sharing_page(request.user, slug, page_id, lock=True)
            if request.data.get("only_me") is True:
                page.access = Page.PRIVATE_ACCESS
                page.notepad_collaborators = []
                page.notepad_invitations = {}
            else:
                serializer = InvitationInput(data=request.data)
                serializer.is_valid(raise_exception=True)
                email = serializer.validated_data["email"].lower()
                page.notepad_invitations.pop(email, None)
                user_ids = {str(user.id) for user in User.objects.filter(email__iexact=email)}
                page.notepad_collaborators = [value for value in page.notepad_collaborators if value not in user_ids]
            page.save(update_fields=["access", "notepad_collaborators", "notepad_invitations"])
        return Response(sharing_response(page))


class NotepadInvitationEndpoint(BaseAPIView):
    def post(self, request, slug, page_id):
        if request.user.is_bot:
            raise PermissionDenied("Sign in with a personal account.")
        try:
            payload = signing.loads(request.data.get("token", ""), salt=SALT, max_age=7 * 24 * 60 * 60)
        except (signing.BadSignature, TypeError):
            raise ValidationError("Invitation is invalid or expired. Ask the owner to send another.")
        if payload.get("page") != str(page_id) or payload.get("email") != request.user.email.lower():
            raise PermissionDenied("Sign in using the invited email address.")
        with transaction.atomic():
            page = (
                Page.objects.select_for_update()
                .filter(
                    pk=page_id,
                    workspace__slug=slug,
                    is_global=True,
                    parent__isnull=True,
                    archived_at__isnull=True,
                    tool_type=Page.TOOL_TYPE_PAGE,
                )
                .first()
            )
            if page is None:
                raise NotFound("Notepad not found.")
            email = payload["email"]
            nonce = page.notepad_invitations.get(email, "")
            if not nonce or not constant_time_compare(nonce, payload.get("nonce", "")):
                raise PermissionDenied(
                    "Invitation has been accepted or revoked. Open the shared notepad or ask the owner."
                )
            page.notepad_invitations.pop(email)
            user_id = str(request.user.id)
            if user_id not in page.notepad_collaborators:
                page.notepad_collaborators.append(user_id)
            page.save(update_fields=["notepad_invitations", "notepad_collaborators"])
        return Response({"accepted": True})
