# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Case, Count, F, IntegerField, OuterRef, Q, Subquery, UUIDField, Value, When
from django.db.models.functions import Coalesce
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import (
    FileAsset,
    Issue,
    IssueComment,
    IssueCustomFieldValue,
    Project,
    ProjectCustomField,
    ProjectMember,
    State,
)

TASK_LIST_LIMIT = 1000


class ProjectTaskListEndpoint(BaseAPIView):
    """A flat, light list of a project's tasks for the Figma List tab, grouped by section on the client."""

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

        comment_count = (
            IssueComment.objects.filter(issue_id=OuterRef("id"), deleted_at__isnull=True)
            .order_by()
            .values("issue_id")
            .annotate(total=Count("id"))
            .values("total")
        )
        attachment_count = (
            FileAsset.objects.filter(
                issue_id=OuterRef("id"),
                entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                is_uploaded=True,
                is_deleted=False,
            )
            .order_by()
            .values("issue_id")
            .annotate(total=Count("id"))
            .values("total")
        )
        results = list(
            issues.annotate(
                # Tasks in a deleted section show under "No section", like the work item list.
                visible_section_id=Case(
                    When(section__deleted_at__isnull=True, then=F("section_id")),
                    default=Value(None),
                    output_field=UUIDField(),
                ),
                state_group=F("state__group"),
                comment_count=Coalesce(Subquery(comment_count, output_field=IntegerField()), Value(0)),
                attachment_count=Coalesce(Subquery(attachment_count, output_field=IntegerField()), Value(0)),
                assignee_ids=ArrayAgg(
                    "issue_assignee__assignee_id",
                    distinct=True,
                    filter=Q(issue_assignee__deleted_at__isnull=True),
                ),
            )
            .order_by("sort_order", "-created_at")
            .values(
                "id",
                "name",
                "sequence_id",
                "priority",
                "start_date",
                "target_date",
                "state_id",
                "state_group",
                "parent_id",
                "comment_count",
                "attachment_count",
                "assignee_ids",
                "visible_section_id",
            )[: TASK_LIST_LIMIT + 1]
        )
        page = results[:TASK_LIST_LIMIT]
        status_field = ProjectCustomField.objects.filter(
            project_id=project_id, name__iexact="Status", field_type="single_select"
        ).first()
        status_by_issue = {}
        if status_field and page:
            options = {option["id"]: option["name"] for option in status_field.options}
            status_by_issue = {
                issue_id: options.get(value)
                for issue_id, value in IssueCustomFieldValue.objects.filter(
                    field=status_field, issue_id__in=[task["id"] for task in page]
                ).values_list("issue_id", "value")
                if isinstance(value, str)
            }
        for task in page:
            task["section_id"] = task.pop("visible_section_id")
            task["assignee_ids"] = [assignee for assignee in task["assignee_ids"] if assignee is not None]
            task["status_name"] = status_by_issue.get(task["id"])

        states = State.objects.filter(project_id=project_id)
        completed_state = states.filter(group="completed").order_by("sequence").values_list("id", flat=True).first()
        default_state = states.filter(default=True).values_list("id", flat=True).first()
        return Response(
            {
                "project_identifier": project.identifier,
                "completed_state_id": completed_state,
                "default_state_id": default_state,
                "truncated": len(results) > TASK_LIST_LIMIT,
                "results": page,
            },
            status=status.HTTP_200_OK,
        )
