import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from smtplib import SMTPException
from unittest.mock import patch

import pytest
from django.core import mail
from django.db import connections
from kombu.exceptions import OperationalError
from rest_framework.test import APIClient

from plane.bgtasks.workspace_message_task import queue_workspace_message_emails, send_workspace_message_email
from plane.db.models import Notification, User, Workspace, WorkspaceMember, WorkspaceMessage, WorkspaceMessageRecipient


@pytest.fixture
def recipient(workspace):
    user = User.objects.create(email="message-recipient@example.test", username=uuid.uuid4().hex)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15, is_active=True)
    return user


@pytest.fixture
def payload(recipient):
    return {
        "id": str(uuid.uuid4()),
        "subject": "A workspace update",
        "body": "Hello\nTeam",
        "recipients": [str(recipient.id)],
    }


@pytest.fixture(autouse=True)
def email_configuration():
    config = ("smtp.test", "", "", "25", "0", "0", "messages@example.test")
    with (
        patch("plane.app.views.notification.message.get_email_configuration", return_value=config),
        patch("plane.bgtasks.workspace_message_task.get_email_configuration", return_value=config),
    ):
        yield


def url(workspace, message_id=None):
    return f"/api/workspaces/{workspace.slug}/messages/{f'{message_id}/' if message_id else ''}"


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceMessages:
    @pytest.mark.django_db(transaction=True)
    def test_concurrent_retries_only_create_one_message(self, workspace, create_user, payload):
        barrier = Barrier(2)

        def send(_):
            try:
                client = APIClient()
                client.force_authenticate(create_user)
                barrier.wait(timeout=10)
                return client.post(url(workspace), payload, format="json").status_code
            finally:
                connections.close_all()

        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            with ThreadPoolExecutor(max_workers=2) as executor:
                responses = list(executor.map(send, [1, 2]))
        assert sorted(responses) == [200, 201]
        assert WorkspaceMessage.objects.count() == 1
        assert Notification.objects.count() == 1

    def test_workspace_scope_is_enforced(self, workspace, create_user, session_client, payload):
        other = Workspace.objects.create(name="Other", slug="other-messages", owner=create_user)
        WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
        assert session_client.post(url(other), payload, format="json").status_code == 400
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            assert session_client.post(url(workspace), payload, format="json").status_code == 201
        assert session_client.get(url(other, payload["id"])).status_code == 404

    def test_retries_original_send_even_if_recipient_has_left(self, workspace, session_client, recipient, payload):
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            assert session_client.post(url(workspace), payload, format="json").status_code == 201
            WorkspaceMember.objects.filter(workspace=workspace, member=recipient).update(is_active=False)
            assert session_client.post(url(workspace), payload, format="json").status_code == 200
        assert Notification.objects.count() == 1

    def test_durable_outbox_requeues_pending_delivery(self, workspace, session_client, payload):
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            session_client.post(url(workspace), payload, format="json")
        with patch("plane.bgtasks.workspace_message_task.send_workspace_message_email.delay") as queue:
            queue_workspace_message_emails.run()
        queue.assert_called_once_with(str(WorkspaceMessageRecipient.objects.get().id))

    def test_only_send_and_read_methods_are_supported(self, workspace, session_client, payload):
        assert session_client.get(url(workspace)).status_code == 405
        assert session_client.post(url(workspace, payload["id"]), payload, format="json").status_code == 405

    def test_sends_to_members_once_and_exposes_notification(
        self, workspace, session_client, create_user, recipient, payload
    ):
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay") as queue:
            response = session_client.post(url(workspace), payload, format="json")
            assert response.status_code == 201
            duplicate = session_client.post(url(workspace), payload, format="json")
        assert duplicate.status_code == 200
        assert WorkspaceMessage.objects.count() == 1
        assert WorkspaceMessageRecipient.objects.count() == 1
        assert Notification.objects.filter(entity_name="workspace_message").count() == 1
        notification = Notification.objects.get(entity_name="workspace_message")
        assert notification.receiver == recipient
        assert notification.triggered_by == create_user
        assert notification.project_id is None
        assert queue.call_count == 2
        client = APIClient()
        client.force_authenticate(recipient)
        listing = client.get(f"/api/workspaces/{workspace.slug}/users/notifications/")
        assert listing.status_code == 200
        assert str(notification.id) in [item["id"] for item in listing.json()]
        detail = client.get(url(workspace, payload["id"]))
        assert detail.status_code == 200
        assert detail.json()["body"] == payload["body"]
        notification.refresh_from_db()
        assert notification.read_at

    def test_multiple_recipients_and_duplicates(self, workspace, session_client, recipient, payload):
        second = User.objects.create(email="second@example.test", username=uuid.uuid4().hex)
        WorkspaceMember.objects.create(workspace=workspace, member=second, role=5)
        payload["recipients"] = [str(recipient.id), str(second.id), str(recipient.id)]
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            assert session_client.post(url(workspace), payload, format="json").status_code == 201
        assert WorkspaceMessageRecipient.objects.count() == 2
        assert Notification.objects.count() == 2

    @pytest.mark.parametrize("kind", ["outsider", "inactive", "bot", "deleted", "disabled_user"])
    def test_rejects_invalid_recipients_atomically(self, workspace, session_client, recipient, payload, kind):
        membership = WorkspaceMember.objects.get(workspace=workspace, member=recipient)
        if kind in ("outsider", "deleted"):
            membership.delete(soft=False)
        elif kind == "inactive":
            membership.is_active = False
            membership.save()
        elif kind == "disabled_user":
            recipient.is_active = False
            recipient.save()
        else:
            recipient.is_bot = True
            recipient.save()
        response = session_client.post(url(workspace), payload, format="json")
        assert response.status_code == 400
        assert not WorkspaceMessage.objects.exists()
        assert not Notification.objects.exists()

    @pytest.mark.parametrize(
        "field,value",
        [
            ("subject", ""),
            ("subject", " \n "),
            ("subject", "x\nBcc: injected@example.test"),
            ("body", " "),
            ("body", "x" * 20001),
            ("recipients", []),
            ("recipients", ["not-a-uuid"]),
            ("recipients", [str(uuid.uuid4())] * 101),
            ("id", "not-a-uuid"),
        ],
    )
    def test_validates_payload(self, workspace, session_client, payload, field, value):
        payload[field] = value
        assert session_client.post(url(workspace), payload, format="json").status_code == 400
        assert not Notification.objects.exists()

    def test_forbids_self_recipient(self, workspace, session_client, create_user, payload):
        payload["recipients"] = [str(create_user.id)]
        assert session_client.post(url(workspace), payload, format="json").status_code == 400

    @pytest.mark.parametrize("role", [5, None])
    def test_guests_and_outsiders_cannot_send(self, workspace, recipient, payload, role):
        WorkspaceMember.objects.filter(member=recipient).update(role=role or 15, is_active=role is not None)
        client = APIClient()
        client.force_authenticate(recipient)
        assert client.post(url(workspace), payload, format="json").status_code == 403

    def test_unrelated_members_cannot_read(self, workspace, session_client, payload):
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            assert session_client.post(url(workspace), payload, format="json").status_code == 201
        outsider = User.objects.create(email="other-member@example.test", username=uuid.uuid4().hex)
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=20)
        client = APIClient()
        client.force_authenticate(outsider)
        assert client.get(url(workspace, payload["id"])).status_code == 404
        assert session_client.get(url(workspace, payload["id"])).status_code == 200

    def test_same_id_cannot_change_content(self, workspace, session_client, payload):
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            assert session_client.post(url(workspace), payload, format="json").status_code == 201
            payload["body"] = "Different"
            assert session_client.post(url(workspace), payload, format="json").status_code == 409
        assert Notification.objects.count() == 1

    def test_queue_failure_is_explicit_and_retry_does_not_duplicate(self, workspace, session_client, payload):
        with patch(
            "plane.app.views.notification.message.send_workspace_message_email.delay",
            side_effect=OperationalError("offline"),
        ):
            response = session_client.post(url(workspace), payload, format="json")
        assert response.status_code == 503
        assert "Inbox" in response.json()["error"]
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            assert session_client.post(url(workspace), payload, format="json").status_code == 200
        assert Notification.objects.count() == 1

    def test_missing_email_configuration_is_explicit(self, workspace, session_client, payload):
        with patch("plane.app.views.notification.message.get_email_configuration", return_value=("",) * 7):
            response = session_client.post(url(workspace), payload, format="json")
        assert response.status_code == 503
        assert not WorkspaceMessage.objects.exists()

    def test_email_escapes_content_and_sends_once(self, workspace, session_client, recipient, payload, settings):
        settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
        settings.WEB_URL = "https://clevdex.example"
        payload["body"] = "<script>alert('x')</script>\nSecond line"
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            session_client.post(url(workspace), payload, format="json")
        delivery = WorkspaceMessageRecipient.objects.get()
        send_workspace_message_email.run(str(delivery.id))
        send_workspace_message_email.run(str(delivery.id))
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [recipient.email]
        assert mail.outbox[0].subject == payload["subject"]
        html = mail.outbox[0].alternatives[0][0]
        assert "<script>" not in html
        assert "&lt;script&gt;" in html
        assert f"/notifications/?message={payload['id']}" in html
        delivery.refresh_from_db()
        assert delivery.email_sent_at

    def test_failed_email_is_not_marked_sent(self, workspace, session_client, payload, settings):
        settings.WEB_URL = "https://clevdex.example"
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            session_client.post(url(workspace), payload, format="json")
        delivery = WorkspaceMessageRecipient.objects.get()
        with patch("plane.bgtasks.workspace_message_task.EmailMultiAlternatives.send", return_value=0):
            with pytest.raises(SMTPException):
                send_workspace_message_email.run(str(delivery.id))
        delivery.refresh_from_db()
        assert delivery.email_sent_at is None

    def test_removed_member_is_not_emailed(self, workspace, session_client, payload, recipient, settings):
        settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
        with patch("plane.app.views.notification.message.send_workspace_message_email.delay"):
            session_client.post(url(workspace), payload, format="json")
        WorkspaceMember.objects.filter(workspace=workspace, member=recipient).update(is_active=False)
        with patch("plane.bgtasks.workspace_message_task.EmailMultiAlternatives.send") as send:
            send_workspace_message_email.run(str(WorkspaceMessageRecipient.objects.get().id))
        send.assert_not_called()

    def test_unauthenticated_access_is_denied(self, workspace, payload):
        response = APIClient().post(url(workspace), payload, format="json")
        assert response.status_code in (401, 403)
