# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import date, timedelta

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Case, CharField, F, OuterRef, Q, Subquery, Value, When
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import FileAsset, Issue, IssueLink, State

from ..base import BaseAPIView

MY_TASK_TABS = ("upcoming", "overdue", "completed")
OPEN_EXCLUDED_GROUPS = ("completed", "cancelled")
DEFAULT_LIMIT = 10
MAX_LIMIT = 100
FILES_LIMIT = 300


def collect_task_files(slug, issues):
    """Attachments and links on the given work items, newest first."""
    issue_fields = {
        "issue_name": F("issue__name"),
        "sequence_id": F("issue__sequence_id"),
        "project_identifier": F("project__identifier"),
        "state_group": F("issue__state__group"),
        "created_by_name": F("created_by__display_name"),
    }
    attachments = (
        FileAsset.objects.filter(
            issue_id__in=issues.values("id"),
            entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
            is_uploaded=True,
            is_deleted=False,
        )
        .order_by("-created_at")
        .values("id", "attributes", "size", "created_at", "issue_id", "project_id", **issue_fields)[:FILES_LIMIT]
    )
    links = (
        IssueLink.objects.filter(issue_id__in=issues.values("id"))
        .order_by("-created_at")
        .values("id", "title", "url", "created_at", "issue_id", "project_id", **issue_fields)[:FILES_LIMIT]
    )
    files = [
        {
            **{key: value for key, value in item.items() if key != "attributes"},
            "kind": "attachment",
            "name": (item["attributes"] or {}).get("name") or "Attachment",
            "mime_type": (item["attributes"] or {}).get("type") or "",
            "url": f"/api/assets/v2/workspaces/{slug}/projects/{item['project_id']}/issues/"
            f"{item['issue_id']}/attachments/{item['id']}/",
        }
        for item in attachments
    ] + [
        {
            **{key: value for key, value in item.items() if key != "title"},
            "kind": "link",
            "name": item["title"] or item["url"],
            "mime_type": "",
            "size": 0,
        }
        for item in links
    ]
    files.sort(key=lambda item: item["created_at"], reverse=True)
    return files[:FILES_LIMIT]


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

    def _files(self, slug, issues):
        return collect_task_files(slug, issues)

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
        list_view = request.GET.get("view") == "list"
        offset = 0
        if list_view:
            try:
                offset = int(request.GET.get("offset", 0))
                if offset < 0:
                    raise ValueError
            except ValueError:
                return Response({"error": "Invalid offset"}, status=status.HTTP_400_BAD_REQUEST)

        if request.GET.get("view") == "files":
            return Response({"results": self._files(slug, base_queryset)}, status=status.HTTP_200_OK)

        if request.GET.get("view") == "schedule":
            start = self._parse_today(request.GET.get("start"))
            end = self._parse_today(request.GET.get("end"))
            if (
                not request.GET.get("start")
                or not request.GET.get("end")
                or start is None
                or end is None
                or end < start
                or (end - start).days > 62
                or start == date.min
                or end == date.max
            ):
                return Response(
                    {"error": "Expected a valid start/end date range of at most 63 days (YYYY-MM-DD)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Include adjacent completion dates; the client applies the user's timezone.
            scheduled = (
                Q(start_date__lte=end, target_date__gte=start)
                | Q(start_date__range=(start, end), target_date__isnull=True)
                | Q(target_date__range=(start, end))
                | Q(completed_at__date__range=(start - timedelta(days=1), end + timedelta(days=1)))
            )
            results = list(
                base_queryset.exclude(state__group="cancelled")
                .filter(scheduled)
                .annotate(
                    assignee_ids=ArrayAgg(
                        "issue_assignee__assignee_id",
                        distinct=True,
                        filter=Q(issue_assignee__deleted_at__isnull=True),
                    )
                )
                .order_by("target_date", "name", "id")
                .values(
                    "id",
                    "name",
                    "project_id",
                    "sequence_id",
                    "start_date",
                    "target_date",
                    "completed_at",
                    "assignee_ids",
                    "created_by",
                    project_identifier=F("project__identifier"),
                    project_name=F("project__name"),
                    state_group=F("state__group"),
                )
            )
            return Response({"results": results}, status=status.HTTP_200_OK)

        open_queryset = base_queryset.exclude(state__group__in=OPEN_EXCLUDED_GROUPS)
        overdue_filter = Q(target_date__lt=today)
        tab_querysets = {
            "upcoming": open_queryset.exclude(overdue_filter),
            "overdue": open_queryset.filter(overdue_filter),
            "completed": base_queryset.filter(state__group="completed"),
        }
        counts = {key: queryset.count() for key, queryset in tab_querysets.items()}

        ordering = (
            ("-created_at", "id")
            if list_view
            else {
                "upcoming": (F("target_date").asc(nulls_last=True), "-created_at"),
                "overdue": (F("target_date").asc(), "-created_at"),
                "completed": (F("completed_at").desc(nulls_last=True), "-updated_at"),
            }[tab]
        )

        selected_queryset = base_queryset if list_view else tab_querysets[tab]
        results_queryset = selected_queryset.annotate(
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
        ).order_by(*ordering)
        fields = [
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
        ]
        if list_view:
            results_queryset = results_queryset.annotate(
                project_name=F("project__name"),
                section_name=Case(
                    When(section__deleted_at__isnull=True, then=F("section__name")),
                    default=Value(None),
                    output_field=CharField(),
                ),
                assignee_ids=ArrayAgg(
                    "issue_assignee__assignee_id",
                    distinct=True,
                    filter=Q(issue_assignee__deleted_at__isnull=True),
                ),
            )
            fields += ["project_name", "assignee_ids", "section_id", "section_name", "start_date"]
        results = list(results_queryset.values(*fields)[offset : offset + limit])
        if list_view:
            return Response({"count": selected_queryset.count(), "results": results}, status=status.HTTP_200_OK)

        return Response({"tab": tab, "counts": counts, "results": results}, status=status.HTTP_200_OK)
