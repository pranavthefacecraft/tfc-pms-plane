# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the home page "My tasks" endpoint."""

from datetime import date, timedelta

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueAssignee, Project, ProjectMember, State

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
