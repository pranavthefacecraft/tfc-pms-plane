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
from plane.db.models import Issue, IssueComment, Project, ProjectMember, State

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
                "assignee_ids",
                "visible_section_id",
            )[: TASK_LIST_LIMIT + 1]
        )
        for task in results:
            task["section_id"] = task.pop("visible_section_id")
            task["assignee_ids"] = [assignee for assignee in task["assignee_ids"] if assignee is not None]

        states = State.objects.filter(project_id=project_id)
        completed_state = states.filter(group="completed").order_by("sequence").values_list("id", flat=True).first()
        default_state = states.filter(default=True).values_list("id", flat=True).first()
        return Response(
            {
                "project_identifier": project.identifier,
                "completed_state_id": completed_state,
                "default_state_id": default_state,
                "truncated": len(results) > TASK_LIST_LIMIT,
                "results": results[:TASK_LIST_LIMIT],
            },
            status=status.HTTP_200_OK,
        )
