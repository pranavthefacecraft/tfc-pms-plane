from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from plane.db.models import PersonalTask, User, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def shared_task(workspace, create_user):
    return PersonalTask.objects.create(
        owner=create_user, workspace=workspace, name="Share me", description="Plain notes"
    )


def share_url(workspace, task):
    return f"/api/workspaces/{workspace.slug}/personal-tasks/{task.id}/share/"


def public_url(token):
    return f"/api/shared/personal-tasks/{token}/"


def test_share_requires_opt_in_and_returns_only_public_fields(session_client, workspace, shared_task):
    url = share_url(workspace, shared_task)
    assert session_client.get(url).json() == {"token": None}
    assert "share_token" not in session_client.get(f"/api/workspaces/{workspace.slug}/personal-tasks/").json()[0]
    response = session_client.post(url)
    assert response.status_code == 200
    token = response.json()["token"]
    assert token != str(shared_task.id)
    assert session_client.post(url).json()["token"] == token
    anonymous = APIClient()
    response = anonymous.get(public_url(token))
    assert response.status_code == 200
    assert response.json() == {
        "name": "Share me",
        "description": "Plain notes",
        "priority": "none",
        "start_date": None,
        "target_date": None,
        "completed_at": None,
    }
    assert response["Cache-Control"] == "no-store"
    assert response["X-Robots-Tag"] == "noindex, nofollow"
    assert anonymous.get(public_url(shared_task.id)).status_code == 404
    assert anonymous.get(public_url(uuid4())).status_code == 404
    for method in (anonymous.post, anonymous.patch, anonymous.delete):
        assert method(public_url(token)).status_code == 405


def test_only_owner_can_manage_sharing(session_client, workspace, shared_task):
    stranger = User.objects.create(email="sharing-other@example.com", username="sharing-other")
    WorkspaceMember.objects.create(workspace=workspace, member=stranger, role=20)
    other = APIClient()
    other.force_authenticate(stranger)
    url = share_url(workspace, shared_task)
    for method in (other.get, other.post, other.delete):
        assert method(url).status_code == 404
    anonymous = APIClient()
    for method in (anonymous.get, anonymous.post, anonymous.delete):
        assert method(url).status_code in (401, 403)
    shared_task.refresh_from_db()
    assert shared_task.share_token is None


def test_revoking_and_resharing_rotates_token(session_client, workspace, shared_task):
    url = share_url(workspace, shared_task)
    token = session_client.post(url).json()["token"]
    assert session_client.delete(url).status_code == 204
    assert APIClient().get(public_url(token)).status_code == 404
    new_token = session_client.post(url).json()["token"]
    assert new_token != token
    assert APIClient().get(public_url(new_token)).status_code == 200


@pytest.mark.parametrize("operation", ["delete", "move"])
def test_deleted_or_moved_tasks_disable_public_link(session_client, workspace, shared_task, operation, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", lambda *args, **kwargs: None)
    token = session_client.post(share_url(workspace, shared_task)).json()["token"]
    if operation == "delete":
        assert (
            session_client.delete(f"/api/workspaces/{workspace.slug}/personal-tasks/{shared_task.id}/").status_code
            == 204
        )
    else:
        from django.utils import timezone

        shared_task.moved_at = timezone.now()
        shared_task.save(update_fields=["moved_at"])
    assert APIClient().get(public_url(token)).status_code == 404


def test_task_updates_cannot_enable_or_replace_share_token(session_client, workspace, shared_task):
    response = session_client.patch(
        f"/api/workspaces/{workspace.slug}/personal-tasks/{shared_task.id}/",
        {"share_token": str(uuid4()), "name": "Changed"},
        format="json",
    )
    assert response.status_code == 200
    shared_task.refresh_from_db()
    assert shared_task.share_token is None
