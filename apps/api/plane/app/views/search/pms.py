from django.db.models import Q, CharField, Value
from django.db.models.functions import Cast, Coalesce, Lower, NullIf
from django.db.models.fields.json import KeyTextTransform
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from plane.app.permissions import ROLE
from plane.app.views.base import BaseAPIView
from plane.db.models import (
    Cycle,
    FileAsset,
    Issue,
    IssueLink,
    IssueView,
    Module,
    Page,
    PersonalTask,
    Project,
    ProjectMember,
    Recording,
    WorkspaceMember,
)


KINDS = ("navigation", "tasks", "projects", "people", "documents", "files")


class SearchInput(serializers.Serializer):
    search = serializers.CharField(max_length=200, trim_whitespace=True)
    category = serializers.ChoiceField(choices=("all", *KINDS), default="all")
    offset = serializers.IntegerField(min_value=0, default=0)
    limit = serializers.IntegerField(min_value=1, max_value=100, default=20)


def matching(query, *fields):
    condition = Q()
    for word in query.split():
        if word.lower() == "tasks":
            word = "task"
        word_condition = Q()
        for field in fields:
            word_condition |= Q(**{f"{field}__icontains": word})
        condition &= word_condition
    return condition


def accessible_projects(user, workspace_ids):
    memberships = ProjectMember.objects.filter(
        member=user, is_active=True, workspace_id__in=workspace_ids, project__archived_at__isnull=True
    )
    return Project.objects.filter(pk__in=memberships.values("project_id"))


def accessible_issues(user, projects):
    restricted = ProjectMember.objects.filter(
        member=user,
        is_active=True,
        role=ROLE.GUEST.value,
        project__in=projects,
        project__guest_view_all_features=False,
    ).values("project_id")
    return Issue.issue_objects.filter(project__in=projects).filter(~Q(project_id__in=restricted) | Q(created_by=user))


def accessible_pages(user, workspace_ids, projects, feature_projects):
    uid = str(user.id)
    global_access = (
        (
            Q(workspace_id__in=workspace_ids)
            & (
                Q(access=Page.PUBLIC_ACCESS)
                | Q(owned_by=user)
                | Q(tool_type=Page.TOOL_TYPE_WHITEBOARD, whiteboard_roles__has_key=uid)
            )
        )
        | Q(tool_type=Page.TOOL_TYPE_PAGE, notepad_collaborators__contains=[uid])
        | Q(
            tool_type=Page.TOOL_TYPE_WHITEBOARD,
            whiteboard_guest_ids__contains=[uid],
            whiteboard_guest_role__in=("viewer", "editor"),
        )
    )
    return (
        Page.objects.filter(archived_at__isnull=True)
        .filter(
            Q(is_global=True, parent__isnull=True) & global_access
            | Q(is_global=False, parent__isnull=True, projects__in=projects, owned_by=user)
            | Q(is_global=False, parent__isnull=True, projects__in=feature_projects, access=0)
        )
        .distinct()
    )


def result(item, kind, name, href, detail="", identifier=None):
    return {
        "id": str(identifier or item.id),
        "kind": kind,
        "name": name,
        "detail": detail,
        "href": href,
        "workspace_slug": item.workspace.slug,
        "workspace_name": item.workspace.name,
    }


def ordered(queryset, field="name"):
    return queryset.order_by(Lower(field), "workspace__slug", "id")


def navigation_results(memberships, user, query):
    items = []
    for membership in memberships:
        workspace = membership.workspace
        destinations = [
            ("workspace", workspace.name, "", "Workspace"),
            ("activity", "Activity", "", "Overview home"),
            ("all-activity", "All accounts activity", "all-accounts-activity", "Workspace activity"),
            ("my-tasks", "My tasks", f"profile/{user.id}", "My task your work personal tasks"),
            ("projects", "Projects", "projects", "Project list"),
            ("active-cycles", "Active cycles", "active-cycles", "Sprints cycles"),
            ("workspace-views", "Workspace views", "workspace-views", "Views filters"),
            ("notepad", "Notepad", "tool/pages", "Tools notes pages"),
            ("whiteboard", "Whiteboards", "tool/whiteboards", "Tools whiteboard"),
            ("recorder", "Recorder", "tool/recorder", "Tools screen recording video"),
            ("inbox", "Inbox", "notifications", "Notifications messages"),
            ("account", "Account settings", "pms-settings/account", "PMS Settings profile preferences"),
        ]
        if membership.role >= ROLE.MEMBER.value:
            destinations.append(("teammates", "Teammates", "pms-settings/teammates", "People team members"))
        if membership.role >= ROLE.ADMIN.value:
            destinations.extend(
                [
                    ("company", "Company settings", "pms-settings/company", "Workspace PMS settings"),
                    ("billing", "Billing", "pms-settings/billing", "PMS Settings plan"),
                ]
            )
        destinations.extend(
            [
                ("preferences", "PMS Preferences", "pms-settings/preferences", "Settings calendar tasks notifications"),
                ("integrations", "Integrations", "pms-settings/integrations", "Settings connections"),
            ]
        )
        for key, name, path, keywords in destinations:
            if all(word in f"{name} {keywords}".lower() for word in query.lower().split()):
                items.append(
                    {
                        "id": f"{workspace.id}-{key}",
                        "kind": "navigation",
                        "name": name,
                        "detail": "Go to page",
                        "href": f"/{workspace.slug}/{path}",
                        "workspace_slug": workspace.slug,
                        "workspace_name": workspace.name,
                    }
                )
    return items


class PMSSearchEndpoint(BaseAPIView):
    """Search only content the authenticated user can open, across their workspaces."""

    def get(self, request):
        if request.user.is_bot:
            raise PermissionDenied("Global search is unavailable for bot accounts.")
        serializer = SearchInput(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["search"]
        category = serializer.validated_data["category"]
        offset = serializer.validated_data["offset"]
        limit = serializer.validated_data["limit"]
        memberships = (
            WorkspaceMember.objects.filter(member=request.user, is_active=True)
            .select_related("workspace")
            .order_by("workspace__name", "workspace_id")
        )
        workspace_ids = list(memberships.values_list("workspace_id", flat=True))
        projects = accessible_projects(request.user, workspace_ids)
        feature_projects = projects.exclude(
            pk__in=ProjectMember.objects.filter(
                member=request.user, is_active=True, role=ROLE.GUEST.value, project__guest_view_all_features=False
            ).values("project_id")
        )
        project_ids = set(projects.values_list("id", flat=True))
        feature_project_ids = set(feature_projects.values_list("id", flat=True))
        issues = accessible_issues(request.user, projects)
        pages = accessible_pages(request.user, workspace_ids, projects, feature_projects)
        items = []

        def include(kind):
            return category in ("all", kind)

        # Bound each source to the requested page; no source can contribute more
        # than offset + limit + 1 rows to the merged, deterministic result order.
        end = offset + limit + 1
        if category == "all" or category == "navigation":
            items.extend(navigation_results(memberships, request.user, query))
        if include("tasks"):
            tasks = issues.filter(
                matching(query, "name", "description_stripped", "project__identifier")
            ).select_related("workspace", "project")
            tasks = ordered(tasks)[:end]
            for task in tasks:
                items.append(
                    result(
                        task,
                        "tasks",
                        task.name,
                        f"/{task.workspace.slug}/projects/{task.project_id}/issues/{task.id}",
                        f"{task.project.identifier}-{task.sequence_id}",
                    )
                )
            member_workspaces = memberships.filter(role__gte=ROLE.MEMBER.value).values("workspace_id")
            personal = (
                PersonalTask.objects.filter(
                    owner=request.user,
                    workspace_id__in=member_workspaces,
                    moved_at__isnull=True,
                )
                .filter(matching(query, "name", "description"))
                .select_related("workspace")
            )
            personal = ordered(personal)[:end]
            for task in personal:
                items.append(
                    result(
                        task,
                        "tasks",
                        task.name,
                        f"/{task.workspace.slug}/profile/{request.user.id}?personal_task={task.id}",
                        "Personal task",
                    )
                )
        if include("projects"):
            for project in ordered(
                projects.filter(matching(query, "name", "identifier", "description")).select_related("workspace")
            )[:end]:
                items.append(
                    result(
                        project,
                        "projects",
                        project.name,
                        f"/{project.workspace.slug}/projects/{project.id}/overview",
                        project.identifier,
                    )
                )
        if include("people"):
            people = WorkspaceMember.objects.filter(
                workspace_id__in=workspace_ids,
                is_active=True,
                member__is_active=True,
                member__is_bot=False,
            ).filter(
                matching(query, "member__display_name", "member__first_name", "member__last_name", "member__email")
            )
            people = people.annotate(
                search_name=Lower(
                    Coalesce(
                        NullIf("member__display_name", Value("")),
                        NullIf("member__first_name", Value("")),
                        "member__email",
                    )
                )
            ).order_by("search_name", "workspace__slug", "member_id")
            for membership in people.select_related("workspace", "member")[:end]:
                person = membership.member
                name = person.display_name or person.first_name or person.email
                items.append(
                    result(
                        membership,
                        "people",
                        name,
                        f"/{membership.workspace.slug}/profile/{person.id}",
                        person.email,
                        identifier=f"{membership.workspace_id}-{person.id}",
                    )
                )
        if include("documents"):
            for page in (
                pages.annotate(scene_text=Cast("description_json", CharField()))
                .filter(matching(query, "name", "description_stripped", "scene_text"))
                .select_related("workspace")
                .prefetch_related("projects")
                .annotate(search_name=Lower("name"))
                .order_by("search_name", "workspace__slug", "id")[:end]
            ):
                if page.is_global:
                    tool = "whiteboards" if page.tool_type == Page.TOOL_TYPE_WHITEBOARD else "pages"
                    href = f"/{page.workspace.slug}/tool/{tool}/{page.id}"
                else:
                    allowed_ids = project_ids if page.owned_by_id == request.user.id else feature_project_ids
                    project = next((p for p in page.projects.all() if p.id in allowed_ids), None)
                    if project is None:
                        continue
                    href = f"/{page.workspace.slug}/projects/{project.id}/pages/{page.id}"
                detail = "Whiteboard" if page.tool_type == Page.TOOL_TYPE_WHITEBOARD else "Notepad"
                items.append(result(page, "documents", page.name, href, detail))
            for model, path, label in (
                (Cycle, "cycles", "Cycle"),
                (Module, "modules", "Module"),
            ):
                for document in ordered(
                    model.objects.filter(project__in=feature_projects)
                    .filter(matching(query, "name"))
                    .select_related("workspace")
                )[:end]:
                    items.append(
                        result(
                            document,
                            "documents",
                            document.name,
                            f"/{document.workspace.slug}/projects/{document.project_id}/{path}/{document.id}",
                            label,
                        )
                    )
            member_workspaces = memberships.filter(role__gte=ROLE.MEMBER.value).values("workspace_id")
            views = (
                IssueView.objects.filter(archived_at__isnull=True)
                .filter(
                    Q(project__in=feature_projects, access=1)
                    | Q(project__in=projects, owned_by=request.user)
                    | Q(project__isnull=True, workspace_id__in=member_workspaces, access=1)
                    | Q(project__isnull=True, workspace_id__in=workspace_ids, owned_by=request.user)
                )
                .filter(matching(query, "name", "description"))
                .select_related("workspace")
            )
            for view in ordered(views)[:end]:
                href = (
                    f"/{view.workspace.slug}/projects/{view.project_id}/views/{view.id}"
                    if view.project_id
                    else f"/{view.workspace.slug}/workspace-views/{view.id}"
                )
                items.append(result(view, "documents", view.name, href, "View"))
        if include("files"):
            recordings = (
                Recording.objects.filter(workspace_id__in=workspace_ids, ready=True)
                .filter(Q(owner=request.user) | Q(viewers=request.user))
                .filter(matching(query, "name"))
                .select_related("workspace")
                .distinct()
            )
            for recording in ordered(recordings)[:end]:
                items.append(
                    result(
                        recording,
                        "files",
                        recording.name,
                        f"/{recording.workspace.slug}/tool/recorder/{recording.id}",
                        "Recording",
                    )
                )
            files = (
                FileAsset.objects.filter(is_uploaded=True, is_deleted=False, is_archived=False)
                .filter(
                    Q(entity_type="PROJECT_ATTACHMENT", project__in=projects)
                    | Q(
                        entity_type__in=("ISSUE_ATTACHMENT", "ISSUE_DESCRIPTION", "COMMENT_DESCRIPTION"),
                        issue__in=issues,
                    )
                    | Q(entity_type="PAGE_DESCRIPTION", page__in=pages)
                )
                .filter(matching(query, "attributes__name"))
                .select_related("workspace", "issue", "project", "page")
                .prefetch_related("page__projects")
            )
            files = files.annotate(search_name=Lower(KeyTextTransform("name", "attributes"))).order_by(
                "search_name", "workspace__slug", "id"
            )[:end]
            for file in files:
                if file.page_id:
                    tool = "whiteboards" if file.page.tool_type == Page.TOOL_TYPE_WHITEBOARD else "pages"
                    href = f"/{file.workspace.slug}/tool/{tool}/{file.page_id}"
                    if not file.page.is_global:
                        allowed_ids = project_ids if file.page.owned_by_id == request.user.id else feature_project_ids
                        project = next((p for p in file.page.projects.all() if p.id in allowed_ids), None)
                        if project is None:
                            continue
                        href = f"/{file.workspace.slug}/projects/{project.id}/pages/{file.page_id}"
                elif file.issue_id:
                    href = f"/{file.workspace.slug}/projects/{file.issue.project_id}/issues/{file.issue_id}"
                else:
                    href = f"/{file.workspace.slug}/projects/{file.project_id}/files"
                items.append(
                    result(file, "files", file.attributes.get("name") or "Attachment", href, "File attachment")
                )
            for link in (
                IssueLink.objects.filter(issue__in=issues)
                .filter(matching(query, "title", "url"))
                .select_related("workspace", "issue")
                .annotate(search_name=Lower(Coalesce(NullIf("title", Value("")), "url", output_field=CharField())))
                .order_by("search_name", "workspace__slug", "id")[:end]
            ):
                items.append(
                    result(
                        link,
                        "files",
                        link.title or link.url,
                        f"/{link.workspace.slug}/projects/{link.project_id}/issues/{link.issue_id}",
                        "Task link",
                    )
                )
        priority = {kind: index for index, kind in enumerate(KINDS)}
        items.sort(key=lambda item: (priority[item["kind"]], item["name"].lower(), item["workspace_slug"], item["id"]))
        response = Response(
            {
                "results": items[offset : offset + limit],
                "has_more": len(items) > offset + limit,
                "next_offset": offset + limit if len(items) > offset + limit else None,
            }
        )
        response["Cache-Control"] = "no-store"
        return response
