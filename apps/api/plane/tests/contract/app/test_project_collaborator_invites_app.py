# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for teammates added from the Create Project form."""

from unittest import mock
from django.urls import reverse

import pytest
from rest_framework import status

from plane.app.views.project.collaborator_invite import PENDING_COLLABORATOR_INVITE
from plane.authentication.utils.workspace_project_join import process_workspace_project_invitations
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    ProjectUserProperty,
    User,
    WorkspaceMember,
    WorkspaceMemberInvite,
    Issue,
    IssueAssignee,
    PendingTaskAssignee,
)
from plane.bgtasks.workspace_invitation_task import workspace_invitation

TASK_PATH = "plane.app.views.project.collaborator_invite.workspace_invitation"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Website", identifier="WEB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


def _member(workspace, email, role):
    user = User.objects.create(email=email, username=email.split("@")[0])
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    return user


def _url(workspace, project):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/collaborator-invites/"


@pytest.fixture
def post_invite(session_client, django_capture_on_commit_callbacks):
    def post(url, payload):
        with django_capture_on_commit_callbacks(execute=True):
            return session_client.post(url, payload, format="json")

    return post


@pytest.fixture
def issue(workspace, project):
    return Issue.objects.create(workspace=workspace, project=project, name="Invited task")


@pytest.mark.contract
@pytest.mark.django_db
class TestTaskAssigneeInvitations:
    @mock.patch("plane.app.views.project.collaborator_invite.issue_activity")
    @mock.patch(TASK_PATH)
    @pytest.mark.parametrize("join_path", ["workspace", "bulk", "project"])
    def test_pending_assignment_is_idempotent_and_applies_only_after_accepting(
        self, mail, activity, post_invite, session_client, workspace, project, issue, join_path
    ):
        payload = {"issue_id": str(issue.id), "invites": [{"email": "New@Example.com", "role": 15}]}
        for _ in range(2):
            response = post_invite(_url(workspace, project), payload)
            assert response.status_code == 200, response.data
        assert not User.objects.filter(email="new@example.com").exists()
        assert not IssueAssignee.objects.filter(issue=issue).exists()
        assert PendingTaskAssignee.objects.filter(issue=issue).count() == 1
        mail.delay.assert_called_once()
        invite = WorkspaceMemberInvite.objects.get(email="new@example.com")
        user = User.objects.create(email=invite.email, username="new-task-invite")
        session_client.force_authenticate(user=user)
        url = f"/api/workspaces/{workspace.slug}/invitations/{invite.id}/join/"
        data = {"token": invite.token, "accepted": True}
        if join_path == "bulk":
            url = "/api/users/me/workspaces/invitations/"
            data = {"invitations": [str(invite.id)]}
        elif join_path == "project":
            project_invite = ProjectMemberInvite.objects.get(project=project, email=user.email)
            url = reverse(
                "project-join", kwargs={"slug": workspace.slug, "project_id": project.id, "pk": project_invite.id}
            )
            data = {"token": project_invite.token, "accepted": True}
        response = session_client.post(url, data, format="json")
        assert response.status_code == (204 if join_path == "bulk" else 200), response.data
        assert IssueAssignee.objects.filter(issue=issue, assignee=user).count() == 1

    @mock.patch("plane.app.views.project.collaborator_invite.issue_activity")
    def test_assigns_existing_workspace_editor_immediately(self, activity, post_invite, workspace, project, issue):
        user = _member(workspace, "editor@example.com", 15)
        payload = {"issue_id": str(issue.id), "invites": [{"email": user.email, "role": 15}]}
        for _ in range(2):
            assert post_invite(_url(workspace, project), payload).status_code == 200
        assert IssueAssignee.objects.filter(issue=issue, assignee=user).count() == 1
        activity.delay.assert_called_once()
        assert activity.delay.call_args.kwargs["notification"] is True
        assert not PendingTaskAssignee.objects.exists()

    @mock.patch("plane.app.views.project.collaborator_invite.issue_activity")
    @mock.patch(TASK_PATH)
    @pytest.mark.parametrize("restriction", ["declined", "revoked", "inviter-removed", "issue-deleted"])
    def test_does_not_assign_cancelled_or_ineligible_invitations(
        self,
        mail,
        activity,
        post_invite,
        session_client,
        workspace,
        project,
        issue,
        create_user,
        restriction,
        monkeypatch,
    ):
        monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", lambda *args, **kwargs: None)
        response = post_invite(
            _url(workspace, project),
            {"issue_id": str(issue.id), "invites": [{"email": "later@example.com", "role": 15}]},
        )
        assert response.status_code == 200, response.data
        invite = WorkspaceMemberInvite.objects.get(email="later@example.com")
        user = User.objects.create(email=invite.email, username="later-task-invite")
        if restriction == "revoked":
            ProjectMemberInvite.objects.get(project=project, email=user.email).delete()
        elif restriction == "inviter-removed":
            ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
        elif restriction == "issue-deleted":
            issue.delete()
        session_client.force_authenticate(user=user)
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/invitations/{invite.id}/join/",
            {"token": invite.token, "accepted": restriction != "declined"},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert not IssueAssignee.objects.filter(issue_id=issue.id, assignee=user).exists()

    @mock.patch(TASK_PATH)
    @pytest.mark.parametrize(
        "restriction", ["workspace-viewer", "project-viewer", "suspended", "inactive-user", "smtp"]
    )
    def test_rejects_ineligible_assignees_before_sending_or_assigning(
        self, mail, session_client, workspace, project, issue, restriction
    ):
        email = "blocked@example.com"
        user = _member(workspace, email, 5 if restriction == "workspace-viewer" else 15)
        if restriction == "project-viewer":
            ProjectMember.objects.create(project=project, workspace=workspace, member=user, role=5)
        elif restriction == "suspended":
            WorkspaceMember.objects.filter(workspace=workspace, member=user).update(is_active=False)
        elif restriction == "inactive-user":
            User.objects.filter(id=user.id).update(is_active=False)
        elif restriction == "smtp":
            email = "outside@example.com"
        with mock.patch("plane.app.views.project.collaborator_invite.get_email_configuration", return_value=(None,)):
            response = session_client.post(
                _url(workspace, project),
                {"issue_id": str(issue.id), "invites": [{"email": email, "role": 15}]},
                format="json",
            )
        assert response.status_code == 400, response.data
        mail.delay.assert_not_called()
        assert not IssueAssignee.objects.filter(issue=issue).exists()
        assert not PendingTaskAssignee.objects.exists()

    @mock.patch(TASK_PATH)
    def test_issue_must_belong_to_project_and_inviter_must_be_project_admin(
        self, mail, session_client, workspace, project, issue, create_user
    ):
        other = Project.objects.create(workspace=workspace, name="Other", identifier="OTHER")
        foreign_issue = Issue.objects.create(workspace=workspace, project=other, name="Other task")
        payload = {"issue_id": str(foreign_issue.id), "invites": [{"email": "new@example.com", "role": 15}]}
        assert session_client.post(_url(workspace, project), payload, format="json").status_code == 404
        payload["issue_id"] = "not-a-uuid"
        assert session_client.post(_url(workspace, project), payload, format="json").status_code == 400
        payload["issue_id"] = str(issue.id)
        ProjectMember.objects.filter(project=project, member=create_user).update(role=15)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
        assert session_client.post(_url(workspace, project), payload, format="json").status_code == 403
        assert not ProjectMemberInvite.objects.exists()


@pytest.mark.contract
class TestProjectCollaboratorInvites:
    @pytest.mark.django_db
    @mock.patch(TASK_PATH)
    def test_adds_existing_members_with_capped_roles(self, task, session_client, workspace, project):
        editor = _member(workspace, "ed@example.com", 15)
        guest = _member(workspace, "guest@example.com", 5)
        admin = _member(workspace, "boss@example.com", 20)

        response = session_client.post(
            _url(workspace, project),
            {
                "invites": [
                    {"email": "ED@example.com", "role": 15},
                    {"email": "guest@example.com", "role": 15},
                    {"email": "boss@example.com", "role": 5},
                ]
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert sorted(response.data["added"]) == ["boss@example.com", "ed@example.com", "guest@example.com"]
        assert response.data["invited"] == []
        roles = dict(ProjectMember.objects.filter(project=project).values_list("member_id", "role"))
        assert roles[editor.id] == 15
        assert roles[guest.id] == 5
        assert roles[admin.id] == 20
        assert ProjectUserProperty.objects.filter(project=project, user=editor).exists()
        task.delay.assert_not_called()

    @pytest.mark.django_db
    @mock.patch(TASK_PATH)
    def test_invites_new_email_and_adds_them_after_joining(self, task, session_client, workspace, project, post_invite):
        response = post_invite(_url(workspace, project), {"invites": [{"email": "New@Example.com", "role": 5}]})

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"added": [], "invited": ["new@example.com"]}
        workspace_invite = WorkspaceMemberInvite.objects.get(workspace=workspace, email="new@example.com")
        assert workspace_invite.role == 5
        task.delay.assert_called_once()
        assert ProjectMemberInvite.objects.filter(
            project=project, email="new@example.com", message=PENDING_COLLABORATOR_INVITE
        ).exists()

        # Accepting the workspace invite adds them to the project.
        newcomer = User.objects.create(email="new@example.com", username="new")
        session_client.force_authenticate(user=newcomer)
        join = session_client.post(
            f"/api/workspaces/{workspace.slug}/invitations/{workspace_invite.id}/join/",
            {"token": workspace_invite.token, "accepted": True},
            format="json",
        )
        assert join.status_code == status.HTTP_200_OK
        assert ProjectMember.objects.get(project=project, member=newcomer).role == 5
        assert not ProjectMemberInvite.objects.filter(email="new@example.com").exists()

    @pytest.mark.django_db
    @mock.patch(TASK_PATH)
    def test_pending_invite_applies_through_other_join_paths(
        self, task, session_client, workspace, project, post_invite
    ):
        post_invite(_url(workspace, project), {"invites": [{"email": "later@example.com", "role": 15}]})
        invite = WorkspaceMemberInvite.objects.get(email="later@example.com")
        later = User.objects.create(email="later@example.com", username="later")

        session_client.force_authenticate(user=later)
        response = session_client.post(
            "/api/users/me/workspaces/invitations/", {"invitations": [str(invite.id)]}, format="json"
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert ProjectMember.objects.get(project=project, member=later).role == 15

        # The sign-up path (accepted invites) works too.
        session_client.force_authenticate(user=None)
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        ProjectMemberInvite.objects.create(
            project=other,
            workspace=workspace,
            email="signup@example.com",
            role=15,
            token="t",
            message=PENDING_COLLABORATOR_INVITE,
        )
        WorkspaceMemberInvite.objects.create(
            workspace=workspace, email="signup@example.com", token="t", role=15, accepted=True
        )
        signup = User.objects.create(email="signup@example.com", username="signup")
        process_workspace_project_invitations(signup)
        assert ProjectMember.objects.get(project=other, member=signup).role == 15

    @pytest.mark.django_db
    @mock.patch(TASK_PATH)
    def test_existing_workspace_invite_sends_new_project_context_but_not_duplicates(
        self, task, workspace, project, post_invite
    ):
        WorkspaceMemberInvite.objects.create(workspace=workspace, email="pending@example.com", token="x", role=15)
        response = post_invite(_url(workspace, project), {"invites": [{"email": "pending@example.com", "role": 15}]})
        assert response.status_code == status.HTTP_200_OK
        task.delay.assert_called_once()
        task.reset_mock()
        post_invite(_url(workspace, project), {"invites": [{"email": "pending@example.com", "role": 15}]})
        task.delay.assert_not_called()
        assert WorkspaceMemberInvite.objects.filter(email="pending@example.com").count() == 1

    @pytest.mark.django_db
    @mock.patch(TASK_PATH)
    def test_project_context_requires_the_invitation_token(self, task, session_client, workspace, project, post_invite):
        post_invite(_url(workspace, project), {"invites": [{"email": "context@example.com", "role": 15}]})
        invite = WorkspaceMemberInvite.objects.get(email="context@example.com")
        session_client.force_authenticate(user=None)
        url = f"/api/workspaces/{workspace.slug}/invitations/{invite.id}/join/"
        for token in ("", "wrong", "\u00e9"):
            response = session_client.get(url, {"token": token})
            assert response.status_code == 200
            assert response.data["projects"] == []
            assert "token" not in response.data
            assert "invite_link" not in response.data
        response = session_client.get(url, {"token": invite.token})
        assert response.data["projects"] == [{"id": str(project.id), "name": project.name}]
        unrelated = Project.objects.create(name="Private", identifier="PRI", workspace=workspace)
        ProjectMemberInvite.objects.create(
            project=unrelated,
            workspace=workspace,
            email="other@example.com",
            role=15,
            token="other",
            message=PENDING_COLLABORATOR_INVITE,
        )
        response = session_client.get(url, {"token": invite.token})
        assert response.data["projects"] == [{"id": str(project.id), "name": project.name}]

    @pytest.mark.django_db
    @mock.patch(TASK_PATH)
    def test_email_is_enqueued_only_after_pending_project_is_committed(
        self, task, session_client, workspace, project, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            session_client.post(
                _url(workspace, project), {"invites": [{"email": "queued@example.com", "role": 15}]}, format="json"
            )
            task.delay.assert_not_called()
        task.delay.assert_called_once()

    @pytest.mark.django_db
    @pytest.mark.parametrize("project_count", [0, 1, 2])
    def test_email_names_only_the_pending_invited_projects(
        self, workspace, project, create_user, settings, project_count
    ):
        settings.WEB_URL = "https://pms.example.test"
        invite = WorkspaceMemberInvite.objects.create(
            workspace=workspace, email="mail@example.com", token="mail-token", role=15
        )
        project.name = "Website & Design"
        project.save()
        for index in range(project_count):
            selected = (
                project if index == 0 else Project.objects.create(workspace=workspace, name="Second", identifier="SEC")
            )
            ProjectMemberInvite.objects.create(
                project=selected,
                workspace=workspace,
                email=invite.email,
                role=15,
                token=f"project-{index}",
                message=PENDING_COLLABORATOR_INVITE,
            )
        with (
            mock.patch(
                "plane.bgtasks.workspace_invitation_task.get_email_configuration",
                return_value=("smtp.invalid", "", "", "25", "0", "0", "noreply@example.test"),
            ),
            mock.patch("plane.bgtasks.workspace_invitation_task.get_connection"),
            mock.patch("plane.bgtasks.workspace_invitation_task.EmailMultiAlternatives") as email,
        ):
            workspace_invitation(invite.email, workspace.id, invite.token, settings.WEB_URL, create_user.email)
        email.assert_called_once()
        subject = email.call_args.kwargs["subject"]
        html = email.return_value.attach_alternative.call_args.args[0]
        assert workspace.name in subject
        if project_count:
            assert f"Website & Design in {workspace.name}" in subject
            assert "Website &amp; Design" in html
            assert "Accepting this invitation joins the workspace" in html
            if project_count == 2:
                assert "Second" in subject
        else:
            assert "Website" not in subject
            assert "Accepting this invitation joins the workspace" not in html
        email.return_value.send.assert_called_once()

    @pytest.mark.django_db
    @pytest.mark.parametrize(
        "payload",
        [
            {"invites": []},
            {"invites": [{"email": "not-an-email", "role": 15}]},
            {"invites": [{"email": "a@example.com", "role": 20}]},
            {"invites": [{"email": f"u{i}@example.com", "role": 15} for i in range(21)]},
        ],
    )
    def test_rejects_invalid_payloads(self, session_client, workspace, project, payload):
        response = session_client.post(_url(workspace, project), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not WorkspaceMemberInvite.objects.exists()

    @pytest.mark.django_db
    def test_project_members_who_are_not_admins_are_forbidden(self, session_client, workspace, project, create_user):
        ProjectMember.objects.filter(project=project, member=create_user).update(role=15)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
        response = session_client.post(
            _url(workspace, project), {"invites": [{"email": "x@example.com", "role": 15}]}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not WorkspaceMemberInvite.objects.exists()
