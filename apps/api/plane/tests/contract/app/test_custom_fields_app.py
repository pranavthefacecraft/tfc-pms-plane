# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from django.utils import timezone

from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueCustomFieldValue,
    IssueSubscriber,
    Notification,
    Project,
    ProjectCustomField,
    ProjectMember,
    State,
    User,
    UserNotificationPreference,
    WorkspaceMember,
)


def url(workspace, project, suffix=""):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/{suffix}"


@pytest.fixture
def field_context(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Custom fields", identifier="CFLD")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=15)
    state = State.objects.create(workspace=workspace, project=project, name="Todo", group="unstarted")
    issue = Issue.objects.create(
        workspace=workspace,
        project=project,
        name="Task",
        state=state,
        created_by_id=create_user.id,
    )
    return project, issue


def payload(kind="single_select", name="Category"):
    return {
        "name": name,
        "field_type": kind,
        "notify_collaborators": True,
        "options": [{"id": str(uuid.uuid4()), "name": "First", "color": "#135DDD"}] if "select" in kind else [],
    }


def create_field(client, workspace, project, kind="single_select", name="Category"):
    response = client.post(url(workspace, project, "custom-fields/"), payload(kind, name), format="json")
    assert response.status_code == 201, response.data
    return response.json()


def save(client, workspace, project, issue, field, value):
    return client.put(
        url(workspace, project, f"issues/{issue.id}/custom-field-values/"),
        {"field_id": field["id"], "value": value},
        format="json",
    )


@pytest.mark.django_db
@pytest.mark.contract
class TestCustomFields:
    def test_project_defaults(self, session_client, workspace, field_context):
        project, _ = field_context
        rows = session_client.get(url(workspace, project, "custom-fields/")).json()
        assert [row["name"] for row in rows] == ["Stage", "Status"]
        assert all(row["field_type"] == "single_select" and row["options"] for row in rows)

    def test_project_save_does_not_recreate_removed_defaults(self, field_context):
        project, _ = field_context
        ProjectCustomField.objects.get(project=project, name="Stage").delete()
        project.name = "Renamed project"
        project.save()
        assert list(ProjectCustomField.objects.filter(project=project).values_list("name", flat=True)) == ["Status"]

    @pytest.mark.parametrize("kind", ProjectCustomField.FIELD_TYPES)
    def test_roundtrip_and_clear(self, session_client, workspace, field_context, kind):
        project, issue = field_context
        field = create_field(session_client, workspace, project, kind)
        value = {
            "text": "Specification",
            "number": 12.75,
            "date": "2026-10-20",
            "single_select": field["options"][0]["id"] if field["options"] else None,
            "multi_select": [field["options"][0]["id"]] if field["options"] else [],
        }[kind]
        assert save(session_client, workspace, project, issue, field, value).status_code == 200
        listed = session_client.get(url(workspace, project, f"issues/{issue.id}/custom-field-values/")).json()
        assert listed[field["id"]] == value
        assert save(session_client, workspace, project, issue, field, None).status_code == 200

    @pytest.mark.parametrize(
        "kind,value",
        [
            ("number", True),
            ("number", "12"),
            ("number", 1e16),
            ("number", 10**400),
            ("date", "2026-02-30"),
            ("date", "tomorrow"),
            ("text", 123),
            ("single_select", "unknown"),
            ("multi_select", ["unknown"]),
            ("multi_select", "unknown"),
            ("text", "x" * 10001),
        ],
    )
    def test_reject_invalid_values(self, session_client, workspace, field_context, kind, value):
        project, issue = field_context
        field = create_field(session_client, workspace, project, kind)
        assert save(session_client, workspace, project, issue, field, value).status_code == 400
        assert not IssueCustomFieldValue.objects.filter(issue=issue).exists()

    def test_duplicate_option_rejected(self, session_client, workspace, field_context):
        project, _ = field_context
        data = payload()
        data["options"] *= 2
        assert session_client.post(url(workspace, project, "custom-fields/"), data, format="json").status_code == 400

    @pytest.mark.parametrize(
        "update",
        [
            {"name": ""},
            {"name": "Stage"},
            {"field_type": "unknown"},
            {"options": []},
            {"options": [{"id": "bad", "name": "A", "color": "red"}]},
        ],
    )
    def test_invalid_definitions(self, session_client, workspace, field_context, update):
        project, _ = field_context
        data = {**payload(), **update}
        assert session_client.post(url(workspace, project, "custom-fields/"), data, format="json").status_code == 400

    def test_edit_preserves_option_ids_and_protects_values(self, session_client, workspace, field_context):
        project, issue = field_context
        field = create_field(session_client, workspace, project)
        option = field["options"][0]
        save(session_client, workspace, project, issue, field, option["id"])
        endpoint = url(workspace, project, f"custom-fields/{field['id']}/")
        renamed = session_client.patch(
            endpoint,
            {
                "name": "Renamed",
                "description": "Description",
                "options": [{**option, "name": "Updated", "color": "#16A34A"}],
            },
            format="json",
        )
        assert renamed.status_code == 200
        assert renamed.json()["options"][0]["id"] == option["id"]
        assert session_client.patch(endpoint, {"field_type": "text"}, format="json").status_code == 400
        assert (
            session_client.patch(
                endpoint,
                {
                    "options": [{"id": str(uuid.uuid4()), "name": "New", "color": "#135DDD"}],
                },
                format="json",
            ).status_code
            == 400
        )
        assert session_client.delete(endpoint).status_code == 204
        assert (
            field["id"]
            not in session_client.get(url(workspace, project, f"issues/{issue.id}/custom-field-values/")).json()
        )

    def test_cross_project_rejected(self, session_client, workspace, field_context):
        project, issue = field_context
        other = Project.objects.create(workspace=workspace, name="Other", identifier="OTHER")
        field = ProjectCustomField.objects.filter(project=other).first()
        assert save(session_client, workspace, project, issue, {"id": str(field.id)}, "test").status_code == 404

    def test_guests_read_but_cannot_manage_or_write(self, session_client, workspace, create_user, field_context):
        project, issue = field_context
        Issue.objects.filter(pk=issue.pk).update(created_by=None)
        ProjectMember.objects.filter(project=project, member=create_user).update(role=5)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
        assert session_client.get(url(workspace, project, "custom-fields/")).status_code == 200
        assert (
            session_client.post(url(workspace, project, "custom-fields/"), payload(), format="json").status_code == 403
        )
        assert session_client.get(url(workspace, project, f"issues/{issue.id}/custom-field-values/")).status_code == 403
        Issue.objects.filter(pk=issue.pk).update(created_by=create_user)
        assert session_client.get(url(workspace, project, f"issues/{issue.id}/custom-field-values/")).status_code == 200
        Issue.objects.filter(pk=issue.pk).update(created_by=None)
        Project.objects.filter(pk=project.pk).update(guest_view_all_features=True)
        assert session_client.get(url(workspace, project, f"issues/{issue.id}/custom-field-values/")).status_code == 200
        field = ProjectCustomField.objects.filter(project=project).first()
        assert save(session_client, workspace, project, issue, {"id": str(field.id)}, None).status_code == 403

    def test_nonmembers_and_inactive_members_denied(self, session_client, workspace, create_user, field_context):
        project, _ = field_context
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
        assert session_client.get(url(workspace, project, "custom-fields/")).status_code == 403
        ProjectMember.objects.filter(project=project, member=create_user).update(is_active=True)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
        assert session_client.get(url(workspace, project, "custom-fields/")).status_code == 403

    def test_archived_task_and_project_readonly(self, session_client, workspace, field_context):
        project, issue = field_context
        field = create_field(session_client, workspace, project, "text")
        issue.archived_at = timezone.now()
        issue.save()
        assert session_client.get(url(workspace, project, f"issues/{issue.id}/custom-field-values/")).status_code == 200
        assert save(session_client, workspace, project, issue, field, "test").status_code == 400
        project.archived_at = timezone.now()
        project.save()
        assert (
            session_client.post(url(workspace, project, "custom-fields/"), payload(), format="json").status_code == 400
        )

    def test_collaborator_notifications_and_preferences(self, session_client, workspace, create_user, field_context):
        project, issue = field_context
        other = User.objects.create(email="field-notification@example.test", username=uuid.uuid4().hex)
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
        membership = ProjectMember.objects.create(workspace=workspace, project=project, member=other, role=15)
        IssueAssignee.objects.create(workspace=workspace, project=project, issue=issue, assignee=other)
        IssueSubscriber.objects.create(workspace=workspace, project=project, issue=issue, subscriber=other)
        field = create_field(session_client, workspace, project, "text")
        assert save(session_client, workspace, project, issue, field, "New").status_code == 200
        notifications = Notification.objects.filter(sender="custom_field.updated")
        assert notifications.count() == 1
        notification = notifications.get()
        assert notification.receiver_id == other.id
        assert notification.data["custom_field_id"] == field["id"]
        assert "None -> New" in notification.message_stripped
        session_client.force_authenticate(user=other)
        endpoint = f"/api/workspaces/{workspace.slug}/users/notifications/"
        assert session_client.get(endpoint + "unread/").json()["total_unread_notifications_count"] == 1
        assert session_client.get(endpoint + f"{notification.id}/").status_code == 200
        membership.is_active = False
        membership.save()
        assert session_client.get(endpoint + "unread/").json()["total_unread_notifications_count"] == 0
        assert session_client.get(endpoint + f"{notification.id}/").status_code == 404
        membership.is_active = True
        membership.save()
        session_client.force_authenticate(user=create_user)
        save(session_client, workspace, project, issue, field, "New")
        assert notifications.count() == 1
        UserNotificationPreference.objects.create(user=other, workspace=workspace, property_change=False)
        save(session_client, workspace, project, issue, field, "Again")
        assert notifications.count() == 1
        UserNotificationPreference.objects.filter(user=other).delete()
        membership.is_active = False
        membership.save()
        save(session_client, workspace, project, issue, field, "Last")
        assert notifications.count() == 1

    def test_notifications_disabled_by_default(self, session_client, workspace, field_context):
        project, issue = field_context
        field = ProjectCustomField.objects.filter(project=project).first()
        assert field.notify_collaborators is False
        save(session_client, workspace, project, issue, {"id": str(field.id)}, field.options[0]["id"])
        assert not Notification.objects.filter(sender="custom_field.updated").exists()
