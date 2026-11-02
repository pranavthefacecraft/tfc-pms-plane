# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the home page "My tasks" endpoint."""

from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Issue, IssueAssignee, Project, ProjectMember, Section, State, User

TODAY = date(2026, 10, 14)


def _url(slug, **params):
    query = "&".join(f"{key}={value}" for key, value in params.items())
    return f"/api/workspaces/{slug}/my-tasks/" + (f"?{query}" if query else "")


@pytest.fixture
def project_states(workspace, create_user):
    project = Project.objects.create(name="Tasks", identifier="TSK", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    states = {
        group: State.objects.create(
            name=group.title(), project=project, workspace=workspace, group=group, default=group == "unstarted"
        )
        for group in ("unstarted", "started", "completed", "cancelled")
    }
    return project, states


def _task(project, state, user, name, target_date=None, assign=True):
    issue = Issue.objects.create(
        name=name, project=project, workspace=project.workspace, state=state, target_date=target_date
    )
    if assign:
        IssueAssignee.objects.create(issue=issue, assignee=user, project=project, workspace=project.workspace)
    return issue


@pytest.mark.contract
class TestMyTasks:
    @pytest.mark.django_db
    def test_list_includes_all_states_and_undated_tasks_with_pagination(
        self, session_client, workspace, create_user, project_states
    ):
        project, states = project_states
        expected = [
            _task(project, states[group], create_user, group) for group in ("started", "completed", "cancelled")
        ]
        _task(project, states["started"], create_user, "Not assigned", assign=False)
        first = session_client.get(_url(workspace.slug, view="list", limit=2)).json()
        second = session_client.get(_url(workspace.slug, view="list", limit=2, offset=2)).json()
        assert first["count"] == second["count"] == 3
        assert len(first["results"]) == 2
        assert {item["id"] for item in first["results"] + second["results"]} == {str(task.id) for task in expected}
        assert first["results"][0]["project_name"] == project.name
        assert first["results"][0]["assignee_ids"] == [str(create_user.id)]
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
        assert session_client.get(_url(workspace.slug, view="list")).json() == {"count": 0, "results": []}

    @pytest.mark.django_db
    def test_list_includes_active_section_for_board_columns(
        self, session_client, workspace, create_user, project_states
    ):
        project, states = project_states
        review = Section.objects.create(project=project, name="Waiting for review")
        retired = Section.objects.create(project=project, name="Retired")
        reviewed = _task(project, states["started"], create_user, "Reviewed")
        retired_task = _task(project, states["started"], create_user, "Retired task")
        Issue.objects.filter(id=reviewed.id).update(section=review)
        Issue.objects.filter(id=retired_task.id).update(section=retired)
        Section.objects.filter(id=retired.id).update(deleted_at=timezone.now())
        results = {
            item["name"]: item for item in session_client.get(_url(workspace.slug, view="list")).json()["results"]
        }
        assert results["Reviewed"]["section_id"] == str(review.id)
        assert results["Reviewed"]["section_name"] == "Waiting for review"
        assert results["Retired task"]["section_name"] is None

    @pytest.mark.django_db
    @pytest.mark.parametrize("offset", ["bad", "-1"])
    def test_list_rejects_invalid_offset(self, session_client, workspace, offset):
        response = session_client.get(_url(workspace.slug, view="list", offset=offset))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_schedule_includes_project_name_and_all_current_assignees(
        self, session_client, workspace, create_user, project_states
    ):
        project, states = project_states
        issue = _task(project, states["started"], create_user, "Shared task", TODAY)
        teammate = User.objects.create(email="teammate@example.com", username="teammate")
        removed = User.objects.create(email="removed@example.com", username="removed")
        for person in (teammate, removed):
            ProjectMember.objects.create(workspace=workspace, project=project, member=person, role=20)
            IssueAssignee.objects.create(issue=issue, assignee=person, project=project, workspace=workspace)
        IssueAssignee.objects.filter(issue=issue, assignee=removed).update(deleted_at=timezone.now())

        response = session_client.get(_url(workspace.slug, view="schedule", start=TODAY, end=TODAY))
        assert response.status_code == status.HTTP_200_OK
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["project_name"] == project.name
        assert set(results[0]["assignee_ids"]) == {str(create_user.id), str(teammate.id)}

    @pytest.mark.django_db
    def test_schedule_includes_spanning_tasks_without_tab_limit(
        self, session_client, workspace, create_user, project_states
    ):
        project, states = project_states
        spanning = _task(project, states["started"], create_user, "Spanning", TODAY + timedelta(days=3))
        spanning.start_date = TODAY - timedelta(days=3)
        spanning.save()
        start_only = _task(project, states["unstarted"], create_user, "Start only")
        start_only.start_date = TODAY
        start_only.save()
        due = _task(project, states["unstarted"], create_user, "Due today", TODAY)
        done = _task(project, states["completed"], create_user, "Completed without dates")
        Issue.objects.filter(id=done.id).update(completed_at=f"{TODAY.isoformat()}T12:00:00Z")
        _task(project, states["cancelled"], create_user, "Cancelled", TODAY)
        _task(project, states["started"], create_user, "Other day", TODAY + timedelta(days=5))
        _task(project, states["started"], create_user, "Unassigned", TODAY, assign=False)
        _task(project, states["started"], create_user, "Undated")

        response = session_client.get(_url(workspace.slug, view="schedule", start=TODAY, end=TODAY, limit=1))
        assert response.status_code == status.HTTP_200_OK
        results = response.json()["results"]
        assert {task["id"] for task in results} == {str(task.id) for task in (spanning, start_only, due, done)}
        assert next(task for task in results if task["id"] == str(spanning.id))["start_date"] == str(
            spanning.start_date
        )

    @pytest.mark.django_db
    def test_schedule_excludes_projects_user_left(self, session_client, workspace, create_user, project_states):
        project, states = project_states
        _task(project, states["started"], create_user, "Hidden", TODAY)
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
        response = session_client.get(_url(workspace.slug, view="schedule", start=TODAY, end=TODAY))
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"results": []}

    @pytest.mark.django_db
    @pytest.mark.parametrize(
        "params",
        [
            {},
            {"start": "invalid", "end": TODAY},
            {"start": TODAY, "end": TODAY - timedelta(days=1)},
            {"start": TODAY, "end": TODAY + timedelta(days=63)},
        ],
    )
    def test_schedule_rejects_invalid_ranges(self, session_client, workspace, params):
        response = session_client.get(_url(workspace.slug, view="schedule", **params))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_tabs_split_assigned_tasks(self, session_client, workspace, create_user, project_states):
        project, states = project_states
        later = _task(project, states["unstarted"], create_user, "Later", TODAY + timedelta(days=3))
        no_date = _task(project, states["started"], create_user, "No date")
        due_today = _task(project, states["started"], create_user, "Today", TODAY)
        overdue = _task(project, states["unstarted"], create_user, "Overdue", TODAY - timedelta(days=2))
        done = _task(project, states["completed"], create_user, "Done", TODAY - timedelta(days=5))
        _task(project, states["cancelled"], create_user, "Cancelled", TODAY - timedelta(days=1))
        _task(project, states["unstarted"], create_user, "Not mine", assign=False)

        upcoming = session_client.get(_url(workspace.slug, tab="upcoming", today=TODAY.isoformat())).json()
        assert upcoming["counts"] == {"upcoming": 3, "overdue": 1, "completed": 1}
        assert [t["id"] for t in upcoming["results"]] == [str(due_today.id), str(later.id), str(no_date.id)]

        overdue_body = session_client.get(_url(workspace.slug, tab="overdue", today=TODAY.isoformat())).json()
        assert [t["id"] for t in overdue_body["results"]] == [str(overdue.id)]

        completed = session_client.get(_url(workspace.slug, tab="completed", today=TODAY.isoformat())).json()
        assert [t["id"] for t in completed["results"]] == [str(done.id)]

    @pytest.mark.django_db
    def test_result_includes_state_shortcuts(self, session_client, workspace, create_user, project_states):
        project, states = project_states
        _task(project, states["started"], create_user, "Ship it", TODAY)

        task = session_client.get(_url(workspace.slug, today=TODAY.isoformat())).json()["results"][0]
        assert task["project_identifier"] == "TSK"
        assert task["state_group"] == "started"
        assert task["completed_state_id"] == str(states["completed"].id)
        assert task["default_state_id"] == str(states["unstarted"].id)

    @pytest.mark.django_db
    def test_limit_caps_results_but_not_counts(self, session_client, workspace, create_user, project_states):
        project, states = project_states
        for index in range(4):
            _task(project, states["unstarted"], create_user, f"Task {index}", TODAY)

        body = session_client.get(_url(workspace.slug, limit=2, today=TODAY.isoformat())).json()
        assert len(body["results"]) == 2
        assert body["counts"]["upcoming"] == 4

    @pytest.mark.django_db
    def test_excludes_projects_user_left(self, session_client, workspace, create_user, project_states):
        project, states = project_states
        _task(project, states["unstarted"], create_user, "Hidden", TODAY)
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)

        body = session_client.get(_url(workspace.slug, today=TODAY.isoformat())).json()
        assert body["results"] == []
        assert body["counts"] == {"upcoming": 0, "overdue": 0, "completed": 0}

    @pytest.mark.django_db
    @pytest.mark.parametrize("params", [{"tab": "later"}, {"today": "14-10-2026"}, {"limit": "abc"}])
    def test_rejects_invalid_params(self, session_client, workspace, params):
        response = session_client.get(_url(workspace.slug, **params))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
