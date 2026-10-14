# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Workspace-level pages (Tool → Pages) that can be attached to a project or work item."""

# Python imports
import uuid

# Django imports
from django.db.models import Prefetch, Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import Issue, Page, PageEntityLink, ProjectMember, Workspace, WorkspaceMember

from ..base import BaseAPIView

EDITABLE_FIELDS = ("name", "description_html", "logo_props")


def _is_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except (TypeError, ValueError):
        return False


def _user_project_ids(user, slug):
    return set(
        ProjectMember.objects.filter(
            workspace__slug=slug,
            member=user,
            is_active=True,
            project__archived_at__isnull=True,
        ).values_list("project_id", flat=True)
    )


def _serialize_user(user):
    if user is None:
        return None
    return {
        "id": str(user.id),
        "display_name": user.display_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar_url": user.avatar_url,
    }


def _serialize_attachment(link, member_project_ids):
    if link is None:
        return None
    data = {
        "entity_type": link.entity_type,
        "project_id": str(link.project_id),
        "issue_id": str(link.issue_id) if link.issue_id else None,
        "is_accessible": link.project_id in member_project_ids,
    }
    # Only reveal names of projects/work items the requester can access.
    if data["is_accessible"]:
        data["project_name"] = link.project.name
        data["project_identifier"] = link.project.identifier
        if link.issue_id:
            data["issue_name"] = link.issue.name
            data["issue_sequence_id"] = link.issue.sequence_id
    return data


def serialize_workspace_page(page, member_project_ids, include_description=False):
    links = getattr(page, "active_links", None)
    if links is None:
        links = list(page.entity_links.filter(deleted_at__isnull=True).select_related("project", "issue"))
    data = {
        "id": str(page.id),
        "name": page.name,
        "access": page.access,
        "logo_props": page.logo_props,
        "owned_by": str(page.owned_by_id),
        "owner": _serialize_user(page.owned_by),
        "updated_by": _serialize_user(page.updated_by),
        "workspace": str(page.workspace_id),
        "created_at": page.created_at,
        "updated_at": page.updated_at,
        "attachment": _serialize_attachment(links[0] if links else None, member_project_ids),
    }
    if include_description:
        data["description_html"] = page.description_html
    return data


def _is_workspace_admin(user, slug):
    return WorkspaceMember.objects.filter(
        workspace__slug=slug, member=user, role=ROLE.ADMIN.value, is_active=True
    ).exists()


class WorkspacePageMixin:
    def get_pages(self, request, slug):
        return (
            Page.objects.filter(
                workspace__slug=slug,
                is_global=True,
                parent__isnull=True,
                archived_at__isnull=True,
            )
            .filter(Q(owned_by=request.user) | Q(access=Page.PUBLIC_ACCESS))
            .select_related("owned_by", "updated_by")
            .prefetch_related(
                Prefetch(
                    "entity_links",
                    queryset=PageEntityLink.objects.filter(deleted_at__isnull=True).select_related("project", "issue"),
                    to_attr="active_links",
                )
            )
        )


class WorkspacePageEndpoint(WorkspacePageMixin, BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        pages = self.get_pages(request, slug)

        query = request.query_params.get("query")
        if query:
            pages = pages.filter(name__icontains=query)

        issue_id = request.query_params.get("issue_id")
        project_id = request.query_params.get("project_id")
        if (issue_id and not _is_uuid(issue_id)) or (project_id and not _is_uuid(project_id)):
            return Response({"error": "Invalid id"}, status=status.HTTP_400_BAD_REQUEST)
        member_project_ids = _user_project_ids(request.user, slug)
        if issue_id:
            pages = pages.filter(
                entity_links__issue_id=issue_id,
                entity_links__deleted_at__isnull=True,
                entity_links__project_id__in=member_project_ids,
            )
        elif project_id:
            pages = pages.filter(
                entity_links__project_id=project_id,
                entity_links__entity_type=PageEntityLink.ENTITY_PROJECT,
                entity_links__deleted_at__isnull=True,
                entity_links__project_id__in=member_project_ids,
            )

        pages = pages.distinct().order_by("-updated_at")
        return Response(
            [serialize_workspace_page(page, member_project_ids) for page in pages],
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        access = request.data.get("access", Page.PUBLIC_ACCESS)
        if access not in (Page.PUBLIC_ACCESS, Page.PRIVATE_ACCESS):
            return Response({"error": "Invalid access value"}, status=status.HTTP_400_BAD_REQUEST)

        page = Page.objects.create(
            workspace=workspace,
            name=request.data.get("name", "") or "",
            description_html=request.data.get("description_html", "<p></p>") or "<p></p>",
            access=access,
            owned_by=request.user,
            is_global=True,
        )
        page = self.get_pages(request, slug).get(pk=page.id)
        return Response(
            serialize_workspace_page(page, _user_project_ids(request.user, slug), include_description=True),
            status=status.HTTP_201_CREATED,
        )


class WorkspacePageDetailEndpoint(WorkspacePageMixin, BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, page_id):
        page = self.get_pages(request, slug).filter(pk=page_id).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            serialize_workspace_page(page, _user_project_ids(request.user, slug), include_description=True),
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def patch(self, request, slug, page_id):
        page = self.get_pages(request, slug).filter(pk=page_id).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)

        if "access" in request.data and request.data["access"] != page.access:
            if page.owned_by_id != request.user.id:
                return Response(
                    {"error": "Access cannot be updated since this page is owned by someone else"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if request.data["access"] not in (Page.PUBLIC_ACCESS, Page.PRIVATE_ACCESS):
                return Response({"error": "Invalid access value"}, status=status.HTTP_400_BAD_REQUEST)
            page.access = request.data["access"]

        for field in EDITABLE_FIELDS:
            if field in request.data:
                setattr(page, field, request.data[field] if request.data[field] is not None else "")
        page.save()

        page = self.get_pages(request, slug).get(pk=page.id)
        return Response(
            serialize_workspace_page(page, _user_project_ids(request.user, slug), include_description=True),
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request, slug, page_id):
        page = self.get_pages(request, slug).filter(pk=page_id).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        if page.owned_by_id != request.user.id and not _is_workspace_admin(request.user, slug):
            return Response(
                {"error": "Only the page owner or a workspace admin can delete this page"},
                status=status.HTTP_403_FORBIDDEN,
            )
        PageEntityLink.objects.filter(page_id=page.id).delete()
        page.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspacePageAttachmentEndpoint(WorkspacePageMixin, BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def put(self, request, slug, page_id):
        page = self.get_pages(request, slug).filter(pk=page_id).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)

        entity_type = request.data.get("entity_type")
        entity_id = request.data.get("entity_id")
        if (
            entity_type not in (PageEntityLink.ENTITY_PROJECT, PageEntityLink.ENTITY_ISSUE)
            or not entity_id
            or not _is_uuid(entity_id)
        ):
            return Response(
                {"error": "entity_type must be 'project' or 'issue' and entity_id must be a valid id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member_project_ids = _user_project_ids(request.user, slug)
        issue = None
        if entity_type == PageEntityLink.ENTITY_ISSUE:
            issue = Issue.issue_objects.filter(pk=entity_id, workspace__slug=slug).first()
            if issue is None:
                return Response({"error": "Work item not found"}, status=status.HTTP_404_NOT_FOUND)
            project_id = issue.project_id
        else:
            project_id = uuid.UUID(str(entity_id))

        if project_id not in member_project_ids:
            return Response(
                {"error": "You are not a member of this project"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # A page has a single attachment: replace any existing one.
        PageEntityLink.objects.filter(page_id=page.id).delete()
        PageEntityLink.objects.create(
            workspace_id=page.workspace_id,
            page_id=page.id,
            entity_type=entity_type,
            project_id=project_id,
            issue=issue,
        )

        page = self.get_pages(request, slug).get(pk=page.id)
        return Response(
            serialize_workspace_page(page, member_project_ids, include_description=True),
            status=status.HTTP_200_OK,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request, slug, page_id):
        page = self.get_pages(request, slug).filter(pk=page_id).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        PageEntityLink.objects.filter(page_id=page.id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
