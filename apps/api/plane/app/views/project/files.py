# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import F
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.app.views.workspace.my_tasks import FILES_LIMIT, collect_task_files
from plane.db.models import FileAsset, Issue, Project, ProjectMember


class ProjectFilesEndpoint(BaseAPIView):
    """Attachments and links across a project's work items, plus files attached to the project itself."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        project = Project.objects.filter(id=project_id, workspace__slug=slug).first()
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        issues = Issue.issue_objects.filter(workspace__slug=slug, project_id=project_id)
        # Guests without full feature access only see work items they created, as in the work item list.
        if ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role=ROLE.GUEST.value,
            is_active=True,
            project__guest_view_all_features=False,
        ).exists():
            issues = issues.filter(created_by=request.user)

        project_attachments = (
            FileAsset.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                entity_type=FileAsset.EntityTypeContext.PROJECT_ATTACHMENT,
                is_uploaded=True,
                is_deleted=False,
            )
            .order_by("-created_at")
            .values(
                "id",
                "attributes",
                "size",
                "created_at",
                "project_id",
                project_identifier=F("project__identifier"),
                created_by_name=F("created_by__display_name"),
            )[:FILES_LIMIT]
        )
        files = collect_task_files(slug, issues) + [
            {
                **{key: value for key, value in item.items() if key != "attributes"},
                "kind": "attachment",
                "name": (item["attributes"] or {}).get("name") or "Attachment",
                "mime_type": (item["attributes"] or {}).get("type") or "",
                "url": f"/api/assets/v2/workspaces/{slug}/projects/{project_id}/download/{item['id']}/",
                "issue_id": None,
                "issue_name": None,
                "sequence_id": None,
                "state_group": None,
            }
            for item in project_attachments
        ]
        files.sort(key=lambda item: item["created_at"], reverse=True)
        return Response(files[:FILES_LIMIT], status=status.HTTP_200_OK)
