# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import date

# Django imports
from django.db.models import F, OuterRef, Q, Subquery
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import Issue, State

from ..base import BaseAPIView

MY_TASK_TABS = ("upcoming", "overdue", "completed")
OPEN_EXCLUDED_GROUPS = ("completed", "cancelled")
DEFAULT_LIMIT = 10
MAX_LIMIT = 100


class WorkspaceMyTasksEndpoint(BaseAPIView):
    """Work items assigned to the current user, split into Asana-style tabs."""

    def _parse_today(self, value):
        if not value:
            return timezone.localdate()
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    def _parse_limit(self, value):
        try:
            limit = int(value) if value else DEFAULT_LIMIT
        except ValueError:
            return None
        return max(1, min(limit, MAX_LIMIT))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        tab = request.GET.get("tab", "upcoming")
        if tab not in MY_TASK_TABS:
            return Response(
                {"error": f"Invalid tab. Expected one of: {', '.join(MY_TASK_TABS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The client sends its local date so "overdue" matches the user's timezone.
        today = self._parse_today(request.GET.get("today"))
        if today is None:
            return Response({"error": "Invalid today date. Expected YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

        limit = self._parse_limit(request.GET.get("limit"))
        if limit is None:
            return Response({"error": "Invalid limit"}, status=status.HTTP_400_BAD_REQUEST)

        assigned_issue_ids = Issue.issue_objects.filter(
            workspace__slug=slug,
            issue_assignee__assignee=request.user,
            issue_assignee__deleted_at__isnull=True,
            project__project_projectmember__member=request.user,
            project__project_projectmember__is_active=True,
            project__project_projectmember__deleted_at__isnull=True,
        ).values("id")
        base_queryset = Issue.issue_objects.filter(id__in=assigned_issue_ids)

        open_queryset = base_queryset.exclude(state__group__in=OPEN_EXCLUDED_GROUPS)
        overdue_filter = Q(target_date__lt=today)
        tab_querysets = {
            "upcoming": open_queryset.exclude(overdue_filter),
            "overdue": open_queryset.filter(overdue_filter),
            "completed": base_queryset.filter(state__group="completed"),
        }
        counts = {key: queryset.count() for key, queryset in tab_querysets.items()}

        ordering = {
            "upcoming": (F("target_date").asc(nulls_last=True), "-created_at"),
            "overdue": (F("target_date").asc(), "-created_at"),
            "completed": (F("completed_at").desc(nulls_last=True), "-updated_at"),
        }[tab]

        results = list(
            tab_querysets[tab]
            .annotate(
                project_identifier=F("project__identifier"),
                state_group=F("state__group"),
                state_name=F("state__name"),
                state_color=F("state__color"),
                completed_state_id=Subquery(
                    State.objects.filter(project_id=OuterRef("project_id"), group="completed")
                    .order_by("sequence")
                    .values("id")[:1]
                ),
                default_state_id=Subquery(
                    State.objects.filter(project_id=OuterRef("project_id"), default=True).values("id")[:1]
                ),
            )
            .order_by(*ordering)
            .values(
                "id",
                "name",
                "sequence_id",
                "project_id",
                "project_identifier",
                "priority",
                "target_date",
                "completed_at",
                "state_id",
                "state_group",
                "state_name",
                "state_color",
                "completed_state_id",
                "default_state_id",
            )[:limit]
        )

        return Response({"tab": tab, "counts": counts, "results": results}, status=status.HTTP_200_OK)
