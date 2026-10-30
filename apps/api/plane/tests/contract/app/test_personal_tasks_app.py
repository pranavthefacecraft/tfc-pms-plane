from uuid import uuid4
from datetime import datetime, timezone as datetime_timezone

import pytest
from django.utils import timezone

from plane.db.models import Issue, PersonalTask, Project, ProjectMember, State, User, Workspace, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def url(workspace):
    return f"/api/workspaces/{workspace.slug}/personal-tasks/"


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Destination", identifier="DEST")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=15)
    State.objects.create(workspace=workspace, project=project, name="To do", group="unstarted", default=True)
    return project


def test_create_without_project_and_update_complete_reopen_delete(
    session_client, url, create_user, workspace, monkeypatch
):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", lambda *args, **kwargs: None)
    response = session_client.post(
        url, {"name": "Private task", "description": "Notes", "owner": str(uuid4())}, format="json"
    )
    assert response.status_code == 201
    task = PersonalTask.objects.get(id=response.data["id"])
    assert task.owner == create_user and task.workspace == workspace
    assert not Issue.objects.exists()
    detail = f"{url}{task.id}/"
    response = session_client.patch(
        detail, {"name": "Renamed", "priority": "high", "is_completed": True}, format="json"
    )
    assert response.status_code == 200 and response.data["completed_at"]
    assert session_client.get(url).data[0]["name"] == "Renamed"
    response = session_client.patch(detail, {"is_completed": False}, format="json")
    assert response.data["completed_at"] is None
    assert session_client.delete(detail).status_code == 204
    assert session_client.get(url).data == []


@pytest.mark.parametrize("dates", [{}, {"start_date": None, "target_date": None}])
@pytest.mark.parametrize("user_timezone,expected", [("Asia/Kolkata", "2026-10-31"), ("America/New_York", "2026-10-30")])
def test_missing_dates_default_to_today_in_user_timezone(
    session_client, url, create_user, monkeypatch, dates, user_timezone, expected
):
    create_user.user_timezone = user_timezone
    create_user.save(update_fields=["user_timezone"])
    monkeypatch.setattr(timezone, "now", lambda: datetime(2026, 10, 30, 20, tzinfo=datetime_timezone.utc))
    response = session_client.post(url, {"name": "Today by default", **dates}, format="json")
    assert response.status_code == 201
    assert response.data["target_date"] == expected
    assert str(PersonalTask.objects.get(id=response.data["id"]).target_date) == expected


@pytest.mark.parametrize(
    "dates",
    [
        {"start_date": "2026-11-02", "target_date": None},
        {"start_date": None, "target_date": "2026-11-03"},
        {"start_date": "2026-11-02", "target_date": "2026-11-03"},
    ],
)
def test_creation_preserves_explicit_dates(session_client, url, dates):
    response = session_client.post(url, {"name": "Scheduled", **dates}, format="json")
    assert response.status_code == 201
    for field, value in dates.items():
        assert response.data[field] == value


def test_editing_existing_undated_task_does_not_reschedule_it(session_client, url, create_user, workspace):
    task = PersonalTask.objects.create(owner=create_user, workspace=workspace, name="Undated")
    response = session_client.patch(f"{url}{task.id}/", {"name": "Renamed"}, format="json")
    assert response.status_code == 200
    assert response.data["target_date"] is None


@pytest.mark.parametrize(
    "data",
    [
        {"name": ""},
        {"name": " "},
        {"name": "x" * 256},
        {"name": "x", "priority": "invalid"},
        {"name": "x", "start_date": "2026-10-28", "target_date": "2026-10-27"},
        {"name": "x", "description": "a" * 20001},
    ],
)
def test_rejects_invalid_tasks(session_client, url, data):
    assert session_client.post(url, data, format="json").status_code == 400
    assert not PersonalTask.objects.exists()


def test_private_even_from_other_workspace_admins(session_client, url, workspace, create_user, project):
    other = User.objects.create(email="other@personal.test", username="other-personal")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=20)
    task = PersonalTask.objects.create(owner=other, workspace=workspace, name="Secret")
    assert session_client.get(url).data == []
    assert session_client.patch(f"{url}{task.id}/", {"name": "Stolen"}, format="json").status_code == 404
    assert session_client.delete(f"{url}{task.id}/").status_code == 404
    assert (
        session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json").status_code == 404
    )
    task.refresh_from_db()
    assert task.name == "Secret" and task.moved_at is None


@pytest.mark.parametrize("role,active", [(5, True), (15, False)])
def test_requires_active_workspace_membership(session_client, url, workspace, create_user, role, active):
    task = PersonalTask.objects.create(owner=create_user, workspace=workspace, name="Mine")
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role, is_active=active)
    assert session_client.get(url).status_code == 403
    assert session_client.post(url, {"name": "No"}, format="json").status_code == 403
    assert session_client.patch(f"{url}{task.id}/", {"name": "No"}, format="json").status_code == 403
    assert session_client.delete(f"{url}{task.id}/").status_code == 403
    assert session_client.post(f"{url}{task.id}/move/", {"project_id": str(uuid4())}, format="json").status_code == 403


def test_workspace_isolation(session_client, url, create_user):
    other = Workspace.objects.create(name="Other", slug="other-personal", owner=create_user)
    WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
    task = PersonalTask.objects.create(owner=create_user, workspace=other, name="Other workspace")
    assert session_client.get(url).data == []
    assert session_client.patch(f"{url}{task.id}/", {"name": "No"}, format="json").status_code == 404


@pytest.mark.parametrize("completed", [False, True])
def test_move_preserves_details_assignment_section_and_completion(
    session_client, url, project, workspace, create_user, completed
):
    state = State.objects.create(project=project, workspace=workspace, name="Done", group="completed", sequence=10)
    task = PersonalTask.objects.create(
        workspace=workspace,
        owner=create_user,
        name="Promote",
        description="<script>x</script>\nDetails",
        priority="high",
        start_date="2026-10-27",
        target_date="2026-10-29",
        completed_at=timezone.now() if completed else None,
    )
    response = session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json")
    assert response.status_code == 201, response.data
    issue = Issue.objects.get(id=response.data["id"])
    assert issue.project == project and issue.workspace == workspace
    assert issue.name == task.name and issue.priority == task.priority
    assert str(issue.start_date) == task.start_date and str(issue.target_date) == task.target_date
    assert "<script>" not in issue.description_html and "&lt;script&gt;" in issue.description_html
    assert issue.assignees.filter(id=create_user.id).exists()
    assert issue.section.is_default
    assert bool(issue.completed_at) == completed
    if completed:
        assert issue.state_id == state.id
    assert session_client.get(url).data == []
    assert (
        session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json").status_code == 409
    )
    assert Issue.objects.count() == 1
    assert session_client.patch(f"{url}{task.id}/", {"name": "No"}, format="json").status_code == 404


@pytest.mark.parametrize("restriction", ["nonmember", "guest", "inactive", "archived", "different-workspace"])
def test_move_rejects_invalid_destination_without_losing_task(
    session_client, url, project, workspace, create_user, restriction
):
    task = PersonalTask.objects.create(workspace=workspace, owner=create_user, name="Keep private")
    members = ProjectMember.objects.filter(project=project, member=create_user)
    if restriction == "nonmember":
        members.delete()
    elif restriction == "guest":
        members.update(role=5)
    elif restriction == "inactive":
        members.update(is_active=False)
    elif restriction == "archived":
        Project.objects.filter(id=project.id).update(archived_at=timezone.now())
    else:
        other = Workspace.objects.create(name="Other", slug="destination-other", owner=create_user)
        project = Project.objects.create(workspace=other, name="Other", identifier="OTHER")
        ProjectMember.objects.create(workspace=other, project=project, member=create_user, role=20)
    response = session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json")
    assert response.status_code in (403, 404)
    task.refresh_from_db()
    assert task.moved_at is None and not Issue.objects.exists()


def test_move_rolls_back_if_issue_creation_fails(session_client, url, project, workspace, create_user, monkeypatch):
    task = PersonalTask.objects.create(workspace=workspace, owner=create_user, name="Retain")
    from plane.app.serializers.issue import IssueCreateSerializer
    from rest_framework.exceptions import ValidationError

    original = IssueCreateSerializer.create

    def fail_after_create(self, data):
        original(self, data)
        raise ValidationError("Failed to finish creating task")

    monkeypatch.setattr(IssueCreateSerializer, "create", fail_after_create)
    response = session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json")
    assert response.status_code == 400
    task.refresh_from_db()
    assert task.moved_at is None and not Issue.objects.exists()


def test_unauthenticated_access_denied(api_client, url):
    assert api_client.get(url).status_code in (401, 403)


@pytest.mark.parametrize("completed", [False, True])
def test_move_requires_matching_state(session_client, url, project, workspace, create_user, completed):
    task = PersonalTask.objects.create(
        workspace=workspace,
        owner=create_user,
        name="Keep",
        completed_at=timezone.now() if completed else None,
    )
    State.objects.filter(project=project).update(group="cancelled")
    response = session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json")
    assert response.status_code == 400
    task.refresh_from_db()
    assert task.moved_at is None and not Issue.objects.exists()


def test_move_schedules_standard_project_activity_after_commit(
    session_client, url, project, workspace, create_user, monkeypatch, django_capture_on_commit_callbacks
):
    calls = []
    monkeypatch.setattr(
        "plane.app.views.workspace.personal_task.issue_activity.delay", lambda **kwargs: calls.append(kwargs)
    )
    task = PersonalTask.objects.create(workspace=workspace, owner=create_user, name="Move me")
    with django_capture_on_commit_callbacks(execute=True):
        response = session_client.post(f"{url}{task.id}/move/", {"project_id": str(project.id)}, format="json")
        assert not calls
    assert response.status_code == 201
    assert len(calls) == 1
    assert calls[0]["issue_id"] == response.data["id"]
    assert calls[0]["actor_id"] == str(create_user.id)
    assert calls[0]["type"] == "issue.activity.created"
