# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the project List tab task list."""

from datetime import date

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueComment,
    Project,
    ProjectMember,
    Section,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Website", identifier="WEB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


@pytest.fixture
def states(project, workspace):
    todo = State.objects.create(name="Todo", project=project, workspace=workspace, group="unstarted", default=True)
    done = State.objects.create(name="Done", project=project, workspace=workspace, group="completed", sequence=5)
    return todo, done


def _url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/task-list/"


@pytest.mark.contract
class TestProjectTaskList:
    @pytest.mark.django_db
    def test_lists_tasks_with_sections_assignees_and_comment_counts(
        self, session_client, workspace, project, states, create_user
    ):
        todo, done = states
        section = Section.objects.create(name="To Do", project=project, workspace=workspace, sort_order=1)
        gone = Section.objects.create(name="Old", project=project, workspace=workspace, sort_order=2)
        teammate = User.objects.create(email="ann@example.com", username="ann")
        first = Issue.objects.create(
            name="Wireframes",
            project=project,
            workspace=workspace,
            state=todo,
            section=section,
            priority="medium",
            target_date=date(2026, 10, 29),
        )
        second = Issue.objects.create(name="Scope", project=project, workspace=workspace, state=done, section=gone)
        IssueAssignee.objects.create(issue=first, assignee=create_user, project=project, workspace=workspace)
        removed = IssueAssignee.objects.create(issue=first, assignee=teammate, project=project, workspace=workspace)
        removed.deleted_at = timezone.now()
        removed.save(update_fields=["deleted_at"])
        for text in ("one", "two"):
            IssueComment.objects.create(
                issue=first, project=project, workspace=workspace, comment_html=f"<p>{text}</p>"
            )
        deleted_comment = IssueComment.objects.create(issue=first, project=project, workspace=workspace)
        deleted_comment.deleted_at = timezone.now()
        deleted_comment.save(update_fields=["deleted_at"])
        gone.deleted_at = timezone.now()
        gone.save(update_fields=["deleted_at"])

        response = session_client.get(_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["project_identifier"] == "WEB"
        assert response.data["completed_state_id"] == done.id
        assert response.data["default_state_id"] == todo.id
        assert response.data["truncated"] is False
        tasks = {task["name"]: task for task in response.data["results"]}
        assert tasks["Wireframes"]["section_id"] == section.id
        assert tasks["Wireframes"]["comment_count"] == 2
        assert tasks["Wireframes"]["assignee_ids"] == [create_user.id]
        assert tasks["Wireframes"]["priority"] == "medium"
        assert str(tasks["Wireframes"]["target_date"]) == "2026-10-29"
        assert tasks["Wireframes"]["state_group"] == "unstarted"
        assert tasks["Scope"]["section_id"] is None
        assert tasks["Scope"]["comment_count"] == 0
        assert tasks["Scope"]["assignee_ids"] == []
        assert tasks["Scope"]["state_group"] == "completed"
        assert second.id in {task["id"] for task in response.data["results"]}

    @pytest.mark.django_db
    def test_restricted_guests_only_see_their_own_tasks(self, api_client, workspace, project, states):
        todo, _ = states
        guest = User.objects.create(email="guest@example.com", username="guest")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
        ProjectMember.objects.create(project=project, member=guest, workspace=workspace, role=5)
        theirs = Issue.objects.create(name="Theirs", project=project, workspace=workspace, state=todo)
        mine = Issue.objects.create(name="Mine", project=project, workspace=workspace, state=todo)
        Issue.objects.filter(id=mine.id).update(created_by=guest)
        Issue.objects.filter(id=theirs.id).update(created_by=None)

        api_client.force_authenticate(user=guest)
        response = api_client.get(_url(workspace, project))

        assert response.status_code == status.HTTP_200_OK
        assert [task["name"] for task in response.data["results"]] == ["Mine"]

    @pytest.mark.django_db
    def test_non_members_are_forbidden(self, api_client, workspace, project):
        outsider = User.objects.create(email="out@example.com", username="out")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)
        api_client.force_authenticate(user=outsider)
        assert api_client.get(_url(workspace, project)).status_code == status.HTTP_403_FORBIDDEN
