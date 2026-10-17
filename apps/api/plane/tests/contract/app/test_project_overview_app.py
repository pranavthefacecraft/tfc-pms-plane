# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from plane.db.models import Issue, Project, ProjectMember, State, User, WorkspaceMember


@pytest.fixture
def overview_project(workspace, create_user):
    project = Project.objects.create(name="Overview project", identifier="OVR", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/"


@pytest.mark.contract
@pytest.mark.django_db
class TestProjectOverview:
    def test_persists_overview_and_reloads(self, session_client, workspace, overview_project, create_user):
        payload = {
            "description": "Goals and scope\nSecond line",
            "project_lead": str(create_user.id),
            "health": "at_risk",
            "overview_resources": [
                {"title": "Brief", "url": "https://example.com/brief", "kind": "link"},
                {"title": "Notes", "url": "https://example.com/tool/pages/notes", "kind": "notepad"},
                {"title": "Board", "url": "https://example.com/tool/whiteboards/board", "kind": "whiteboard"},
            ],
        }
        with patch("plane.app.views.project.base.model_activity.delay"):
            response = session_client.patch(url(workspace, overview_project), payload, format="json")
        assert response.status_code == 200, response.data
        with patch("plane.app.views.project.base.recent_visited_task.delay"):
            response = session_client.get(url(workspace, overview_project))
        assert response.status_code == 200
        for field, value in payload.items():
            assert response.json()[field] == value
        overview_project.refresh_from_db()
        assert overview_project.overview_resources == payload["overview_resources"]

    @pytest.mark.parametrize(
        "payload",
        [
            {"health": "unknown"},
            {"health": None},
            {"overview_resources": [{}]},
            {"overview_resources": [{"title": "Missing type", "url": "https://example.com"}]},
            {"overview_resources": [{"title": "Bad", "url": "javascript:alert(1)", "kind": "link"}]},
            {"overview_resources": [{"title": "Bad", "url": "ftp://example.com/file", "kind": "link"}]},
            {"overview_resources": [{"title": "", "url": "https://example.com", "kind": "link"}]},
            {"overview_resources": [{"title": "Bad", "url": "https://example.com", "kind": "file"}]},
            {"overview_resources": [{"title": "Duplicate", "url": "https://example.com", "kind": "link"}] * 2},
            {
                "overview_resources": [
                    {"title": str(i), "url": f"https://example.com/{i}", "kind": "link"} for i in range(51)
                ]
            },
        ],
    )
    def test_rejects_invalid_overview_data(self, session_client, workspace, overview_project, payload):
        response = session_client.patch(url(workspace, overview_project), payload, format="json")
        assert response.status_code == 400
        overview_project.refresh_from_db()
        assert overview_project.health == ""
        assert overview_project.overview_resources == []

    def test_owner_must_be_an_active_project_member(self, session_client, workspace, overview_project):
        outsider = User.objects.create(email="outside@example.com", username="outside")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)
        response = session_client.patch(
            url(workspace, overview_project), {"project_lead": str(outsider.id)}, format="json"
        )
        assert response.status_code == 400
        ProjectMember.objects.create(project=overview_project, member=outsider, role=15, is_active=False)
        response = session_client.patch(
            url(workspace, overview_project), {"project_lead": str(outsider.id)}, format="json"
        )
        assert response.status_code == 400

    @pytest.mark.parametrize("role", [5, 15])
    def test_read_only_for_non_admins(self, session_client, workspace, overview_project, create_user, role):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
        ProjectMember.objects.filter(project=overview_project, member=create_user).update(role=role)
        with patch("plane.app.views.project.base.recent_visited_task.delay"):
            assert session_client.get(url(workspace, overview_project)).status_code == 200
        assert (
            session_client.patch(url(workspace, overview_project), {"health": "off_track"}, format="json").status_code
            == 403
        )

    def test_archived_project_cannot_be_changed(self, session_client, workspace, overview_project):
        overview_project.archived_at = timezone.now()
        overview_project.save()
        assert (
            session_client.patch(url(workspace, overview_project), {"health": "on_track"}, format="json").status_code
            == 400
        )

    def test_task_summary_counts_only_active_project_tasks(
        self, session_client, workspace, overview_project, create_user
    ):
        yesterday = timezone.localdate() - timedelta(days=1)
        for group in ["backlog", "started", "completed", "cancelled", "triage"]:
            state = State.objects.create(project=overview_project, name=group, group=group)
            Issue.objects.create(
                project=overview_project, name=group, state=state, target_date=yesterday, created_by=create_user
            )
        state = State.objects.get(project=overview_project, group="started")
        Issue.objects.create(project=overview_project, name="Draft", state=state, is_draft=True)
        Issue.objects.create(project=overview_project, name="Archived", state=state, archived_at=timezone.now())
        deleted = Issue.objects.create(project=overview_project, name="Deleted", state=state)
        deleted.delete()
        other = Project.objects.create(workspace=workspace, name="Other", identifier="OTH")
        Issue.objects.create(project=other, name="Other task")
        with patch("plane.app.views.project.base.recent_visited_task.delay"):
            response = session_client.get(url(workspace, overview_project))
        assert response.status_code == 200
        assert response.data["task_summary"] == {"total": 4, "completed": 1, "cancelled": 1, "started": 1, "overdue": 2}

    def test_guest_summary_follows_visibility(self, session_client, workspace, overview_project, create_user):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
        ProjectMember.objects.filter(project=overview_project, member=create_user).update(role=5)
        state = State.objects.create(project=overview_project, name="Todo", group="unstarted")
        own = Issue.objects.create(project=overview_project, name="Own", state=state)
        Issue.objects.filter(pk=own.pk).update(created_by=create_user)
        Issue.objects.create(project=overview_project, name="Someone else's", state=state)
        with patch("plane.app.views.project.base.recent_visited_task.delay"):
            response = session_client.get(url(workspace, overview_project))
        assert response.status_code == 200
        assert response.data["task_summary"]["total"] == 1
        overview_project.guest_view_all_features = True
        overview_project.save()
        with patch("plane.app.views.project.base.recent_visited_task.delay"):
            response = session_client.get(url(workspace, overview_project))
        assert response.data["task_summary"]["total"] == 2

    def test_removing_link_does_not_delete_resource(self, session_client, workspace, overview_project):
        overview_project.overview_resources = [{"title": "Brief", "url": "https://example.com", "kind": "link"}]
        overview_project.save()
        with patch("plane.app.views.project.base.model_activity.delay"):
            response = session_client.patch(url(workspace, overview_project), {"overview_resources": []}, format="json")
        assert response.status_code == 200
        overview_project.refresh_from_db()
        assert overview_project.overview_resources == []
