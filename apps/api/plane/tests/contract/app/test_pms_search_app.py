from uuid import uuid4

import pytest
from django.utils import timezone

from plane.db.models import (
    Cycle,
    FileAsset,
    Issue,
    IssueLink,
    IssueView,
    Page,
    PersonalTask,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
URL = "/api/search/pms/"


def make_project(workspace, user, name="Search project", role=15):
    project = Project.objects.create(
        workspace=workspace, name=f"{name} {uuid4().hex[:8]}", identifier=uuid4().hex[:8].upper()
    )
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=role)
    state = State.objects.create(workspace=workspace, project=project, name="To do", group="unstarted")
    return project, state


def make_issue(project, state, user, name="Search task"):
    issue = Issue(workspace=project.workspace, project=project, state=state, created_by=user, name=name)
    issue.save(disable_auto_set_user=True)
    return issue


def test_search_matches_menu_destination_across_active_workspaces(session_client, workspace, create_user):
    second = Workspace.objects.create(owner=create_user, name="Second", slug="second")
    WorkspaceMember.objects.create(workspace=second, member=create_user, role=15)
    inactive = Workspace.objects.create(owner=create_user, name="Inactive", slug="inactive")
    WorkspaceMember.objects.create(workspace=inactive, member=create_user, role=15, is_active=False)
    response = session_client.get(URL, {"search": "my tasks"})
    assert response.status_code == 200
    matches = response.data["results"]
    assert {item["workspace_slug"] for item in matches} == {workspace.slug, "second"}
    assert all(item["name"] == "My tasks" and item["kind"] == "navigation" for item in matches)
    assert all(f"/profile/{create_user.id}" in item["href"] for item in matches)
    assert response["Cache-Control"] == "no-store"


def test_cross_workspace_tasks_and_personal_owner_isolation(session_client, workspace, create_user):
    second = Workspace.objects.create(owner=create_user, name="Second", slug="second")
    WorkspaceMember.objects.create(workspace=second, member=create_user, role=15)
    stranger = User.objects.create(email="stranger@example.test", username=uuid4().hex)
    for space in (workspace, second):
        project, state = make_project(space, create_user)
        make_issue(project, state, create_user)
        PersonalTask.objects.create(owner=create_user, workspace=space, name="Search private task")
        PersonalTask.objects.create(owner=stranger, workspace=space, name="Search hidden private task")
        PersonalTask.objects.create(
            owner=create_user, workspace=space, name="Search moved task", moved_at=timezone.now()
        )
    response = session_client.get(URL, {"search": "search", "category": "tasks"})
    assert response.status_code == 200
    assert len(response.data["results"]) == 4
    assert {item["workspace_slug"] for item in response.data["results"]} == {workspace.slug, second.slug}
    assert not any("hidden" in item["name"] or "moved" in item["name"] for item in response.data["results"])
    assert sum("personal_task=" in item["href"] for item in response.data["results"]) == 2


def test_unjoined_projects_and_limited_guest_tasks_are_not_exposed(session_client, workspace, create_user):
    other = User.objects.create(email="other@example.test", username=uuid4().hex)
    hidden, hidden_state = make_project(workspace, other)
    make_issue(hidden, hidden_state, other, "Search hidden")
    guest_project, state = make_project(workspace, create_user, role=5)
    make_issue(guest_project, state, other, "Search other creator")
    own = make_issue(guest_project, state, create_user, "Search own creator")
    response = session_client.get(URL, {"search": "search", "category": "tasks"})
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [str(own.id)]


def test_notepad_whiteboards_and_private_page_access(session_client, workspace, create_user):
    other = User.objects.create(email="page-owner@example.test", username=uuid4().hex)
    project, _ = make_project(workspace, create_user)
    public = Page.objects.create(workspace=workspace, owned_by=other, name="Search notepad", is_global=True)
    private = Page.objects.create(
        workspace=workspace, owned_by=other, name="Search hidden notepad", is_global=True, access=1
    )
    shared = Page.objects.create(
        workspace=workspace,
        owned_by=other,
        name="Search shared whiteboard",
        is_global=True,
        access=1,
        tool_type="whiteboard",
        whiteboard_roles={str(create_user.id): "viewer"},
    )
    private_project_page = Page.objects.create(
        workspace=workspace, owned_by=other, name="Search hidden project page", access=1
    )
    private_project_page.projects.add(project, through_defaults={"workspace": workspace})
    response = session_client.get(URL, {"search": "search", "category": "documents"})
    assert response.status_code == 200
    ids = {item["id"] for item in response.data["results"]}
    assert ids == {str(public.id), str(shared.id)}
    assert str(private.id) not in ids and str(private_project_page.id) not in ids


def test_scoped_document_invite_does_not_expose_workspace_or_other_documents(session_client, create_user):
    other = User.objects.create(email="invite-owner@example.test", username=uuid4().hex)
    space = Workspace.objects.create(owner=other, name="External", slug="external")
    shared = Page.objects.create(
        workspace=space,
        owned_by=other,
        name="Search invited notepad",
        is_global=True,
        access=1,
        notepad_collaborators=[str(create_user.id)],
    )
    Page.objects.create(workspace=space, owned_by=other, name="Search unrelated", is_global=True)
    response = session_client.get(URL, {"search": "search"})
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [str(shared.id)]


def test_files_respect_task_and_page_access(session_client, workspace, create_user):
    project, state = make_project(workspace, create_user)
    issue = make_issue(project, state, create_user)
    other = User.objects.create(email="file-owner@example.test", username=uuid4().hex)
    hidden_project, hidden_state = make_project(workspace, other)
    hidden_issue = make_issue(hidden_project, hidden_state, other)
    for task in (issue, hidden_issue):
        FileAsset.objects.create(
            workspace=workspace,
            project=task.project,
            issue=task,
            user=create_user,
            entity_type="ISSUE_ATTACHMENT",
            is_uploaded=True,
            attributes={"name": "Search document.pdf"},
            asset=f"{task.id}/document.pdf",
        )
    response = session_client.get(URL, {"search": "search", "category": "files"})
    assert response.status_code == 200
    assert len(response.data["results"]) == 1
    assert str(issue.id) in response.data["results"][0]["href"]


def test_whiteboard_scene_text_is_searchable(session_client, workspace, create_user):
    board = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Planning board",
        is_global=True,
        tool_type="whiteboard",
        description_json={"elements": [{"type": "text", "text": "Campaign roadmap"}]},
    )
    response = session_client.get(URL, {"search": "campaign roadmap", "category": "documents"})
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [str(board.id)]


def test_page_files_open_the_accessible_project_without_asset_project_metadata(session_client, workspace, create_user):
    project, _ = make_project(workspace, create_user)
    other = User.objects.create(username=uuid4().hex, email="private-file-page@example.test")
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Accessible")
    page.projects.add(project, through_defaults={"workspace": workspace})
    private = Page.objects.create(workspace=workspace, owned_by=other, name="Hidden", is_global=True, access=1)
    for target in (page, private):
        FileAsset.objects.create(
            workspace=workspace,
            page=target,
            user=create_user,
            entity_type="PAGE_DESCRIPTION",
            is_uploaded=True,
            attributes={"name": "Search report.pdf"},
            asset=f"{target.id}/report.pdf",
        )
    response = session_client.get(URL, {"search": "search", "category": "files"})
    assert response.status_code == 200
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["href"] == f"/{workspace.slug}/projects/{project.id}/pages/{page.id}"


def test_category_pagination_has_no_dropped_or_duplicate_results(session_client, workspace, create_user):
    names = ["alpha", "Bravo", "charlie", "Delta", "echo", "Foxtrot", "golf"]
    for name in names:
        PersonalTask.objects.create(workspace=workspace, owner=create_user, name=f"Search {name}")
    collected = []
    offset = 0
    while True:
        response = session_client.get(URL, {"search": "search", "category": "tasks", "limit": 2, "offset": offset})
        assert response.status_code == 200
        collected.extend(item["name"] for item in response.data["results"])
        if not response.data["has_more"]:
            assert response.data["next_offset"] is None
            break
        offset = response.data["next_offset"]
    assert collected == [f"Search {name}" for name in names]


def test_my_tasks_matches_task_content_as_well_as_navigation(session_client, workspace, create_user):
    task = PersonalTask.objects.create(workspace=workspace, owner=create_user, name="My task module")
    response = session_client.get(URL, {"search": "my tasks"})
    assert response.status_code == 200
    assert {item["kind"] for item in response.data["results"]} == {"navigation", "tasks"}
    assert any(item["id"] == str(task.id) for item in response.data["results"])


def test_limited_guests_only_find_owned_project_pages(session_client, workspace, create_user):
    other = User.objects.create(email="guest-page-owner@example.test", username=uuid4().hex)
    project, _ = make_project(workspace, create_user, role=5)
    for owner in (create_user, other):
        page = Page.objects.create(workspace=workspace, owned_by=owner, name="Search public page")
        page.projects.add(project, through_defaults={"workspace": workspace})
    owned = Page.objects.get(owned_by=create_user)
    Cycle.objects.create(workspace=workspace, project=project, owned_by=other, name="Search hidden cycle")
    response = session_client.get(URL, {"search": "search", "category": "documents"})
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [str(owned.id)]


def test_views_preserve_private_and_workspace_guest_access(session_client, workspace, create_user):
    other = User.objects.create(email="view-owner@example.test", username=uuid4().hex)
    project, _ = make_project(workspace, create_user)
    visible = []
    for scope in (project, None):
        for owner, access in ((other, 0), (other, 1), (create_user, 0)):
            view = IssueView.objects.create(
                workspace=workspace, project=scope, owned_by=owner, name="Search view", access=access
            )
            if owner == create_user or access == 1:
                visible.append(str(view.id))
    response = session_client.get(URL, {"search": "search", "category": "documents"})
    assert response.status_code == 200
    assert {item["id"] for item in response.data["results"]} == set(visible)
    assert any("/workspace-views/" in item["href"] for item in response.data["results"])
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
    response = session_client.get(URL, {"search": "search", "category": "documents"})
    assert response.status_code == 200
    assert all(
        "/workspace-views/" not in item["href"] or IssueView.objects.get(pk=item["id"]).owned_by_id == create_user.id
        for item in response.data["results"]
    )


def test_pagination_preserves_fallback_names_and_mixed_sources(session_client, workspace, create_user):
    project, state = make_project(workspace, create_user)
    issue = make_issue(project, state, create_user)
    PersonalTask.objects.create(workspace=workspace, owner=create_user, name="Search personal")
    for name, display_name in (("Zulu", ""), ("Alpha", ""), ("Bravo", "Search Bravo")):
        member = User.objects.create(
            username=uuid4().hex, email=f"{name}@example.test", first_name=f"Search {name}", display_name=display_name
        )
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    for title, url in (("", "https://example.test/search-zulu"), ("Search Alpha", "https://example.test/alpha")):
        IssueLink.objects.create(workspace=workspace, project=project, issue=issue, title=title, url=url)
    expected = session_client.get(URL, {"search": "search", "limit": 100})
    assert expected.status_code == 200
    collected = []
    offset = 0
    for _ in range(20):
        response = session_client.get(URL, {"search": "search", "limit": 1, "offset": offset})
        assert response.status_code == 200
        collected.extend(response.data["results"])
        if not response.data["has_more"]:
            break
        offset = response.data["next_offset"]
    assert collected == expected.data["results"]


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"search": " "},
        {"search": "x", "category": "invalid"},
        {"search": "x", "limit": 101},
        {"search": "x", "offset": -1},
    ],
)
def test_invalid_search_returns_explicit_validation_error(session_client, params):
    assert session_client.get(URL, params).status_code == 400


def test_unauthenticated_search_is_rejected(api_client):
    assert api_client.get(URL, {"search": "my tasks"}).status_code in (401, 403)
