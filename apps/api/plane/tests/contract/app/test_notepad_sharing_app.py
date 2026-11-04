from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core import signing
from rest_framework.test import APIClient

from plane.db.models import FileAsset, Page, ProjectMember, User, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def note(workspace, create_user):
    return Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Private note",
        is_global=True,
        access=Page.PRIVATE_ACCESS,
    )


@pytest.fixture
def guest():
    return User.objects.create(email="notepad-guest@example.com", username="notepad-guest")


def client(user):
    result = APIClient()
    result.force_authenticate(user)
    return result


def url(workspace, note, suffix=""):
    return f"/api/workspaces/{workspace.slug}/workspace-pages/{note.id}/{suffix}"


def invite(session_client, workspace, note, guest, django_capture_on_commit_callbacks):
    with patch("plane.app.views.page.notepad_sharing.notepad_invitation.delay") as send:
        with django_capture_on_commit_callbacks(execute=True):
            response = session_client.post(
                url(workspace, note, "collaborators/"), {"email": guest.email.upper()}, format="json"
            )
        assert response.status_code == 202
        token = send.call_args.args[2]
    return token


def test_invitation_only_grants_this_notepad_after_recipient_accepts(
    session_client, workspace, note, guest, django_capture_on_commit_callbacks
):
    token = invite(session_client, workspace, note, guest, django_capture_on_commit_callbacks)
    external = client(guest)
    assert external.get(url(workspace, note)).status_code in (403, 404)
    response = external.post(url(workspace, note, "accept-invitation/"), {"token": token}, format="json")
    assert response.status_code == 200
    response = external.get(url(workspace, note))
    assert response.status_code == 200
    assert response.json()["can_edit"] is True
    assert response.json()["attachment"] is None
    assert external.patch(url(workspace, note), {"name": "Edited by guest"}, format="json").status_code == 200
    assert not WorkspaceMember.objects.filter(workspace=workspace, member=guest).exists()
    assert not ProjectMember.objects.filter(workspace=workspace, member=guest).exists()
    other_note = Page.objects.create(workspace=workspace, owned_by=note.owned_by, is_global=True)
    assert external.get(url(workspace, other_note)).status_code in (403, 404)
    for suffix in ("collaborators/", "attachment/"):
        assert external.post(
            url(workspace, note, suffix), {"email": "other@example.com"}, format="json"
        ).status_code in (403, 405)
    assert external.patch(url(workspace, note), {"access": 0}, format="json").status_code == 400
    assert external.delete(url(workspace, note)).status_code == 403
    assert (
        session_client.delete(url(workspace, note, "collaborators/"), {"email": guest.email}, format="json").status_code
        == 200
    )
    assert external.get(url(workspace, note)).status_code in (403, 404)
    assert external.patch(url(workspace, note), {"name": "Forbidden"}, format="json").status_code in (403, 404)


def test_invitation_recipient_expiry_tampering_and_rotation(
    session_client, workspace, note, guest, create_user, django_capture_on_commit_callbacks
):
    token = invite(session_client, workspace, note, guest, django_capture_on_commit_callbacks)
    assert (
        client(create_user)
        .post(url(workspace, note, "accept-invitation/"), {"token": token}, format="json")
        .status_code
        == 403
    )
    external = client(guest)
    assert (
        external.post(url(workspace, note, "accept-invitation/"), {"token": token + "bad"}, format="json").status_code
        == 400
    )
    with patch("django.core.signing.time.time", return_value=signing.time.time() + 8 * 86400):
        assert (
            external.post(url(workspace, note, "accept-invitation/"), {"token": token}, format="json").status_code
            == 400
        )
    newer = invite(session_client, workspace, note, guest, django_capture_on_commit_callbacks)
    assert external.post(url(workspace, note, "accept-invitation/"), {"token": token}, format="json").status_code == 403
    assert external.post(url(workspace, note, "accept-invitation/"), {"token": newer}, format="json").status_code == 200
    assert external.post(url(workspace, note, "accept-invitation/"), {"token": newer}, format="json").status_code == 403


def test_only_me_revokes_pending_and_accepted_access(
    session_client, workspace, note, guest, django_capture_on_commit_callbacks
):
    token = invite(session_client, workspace, note, guest, django_capture_on_commit_callbacks)
    note.notepad_collaborators = [str(guest.id)]
    note.access = 0
    note.save(update_fields=["notepad_collaborators", "access"])
    response = session_client.delete(url(workspace, note, "collaborators/"), {"only_me": True}, format="json")
    assert response.status_code == 200
    assert response.json() == {"access": 1, "collaborators": [], "pending": []}
    assert (
        client(guest).post(url(workspace, note, "accept-invitation/"), {"token": token}, format="json").status_code
        == 403
    )
    assert client(guest).get(url(workspace, note)).status_code in (403, 404)


def test_owner_only_sharing_and_input_validation(session_client, workspace, note, guest):
    outsider = client(guest)
    WorkspaceMember.objects.create(workspace=workspace, member=guest, role=20)
    for method in (outsider.get, outsider.post, outsider.delete):
        assert method(url(workspace, note, "collaborators/")).status_code in (400, 403)
    assert (
        session_client.post(url(workspace, note, "collaborators/"), {"email": "invalid"}, format="json").status_code
        == 400
    )
    assert (
        session_client.post(
            url(workspace, note, "collaborators/"), {"email": note.owned_by.email}, format="json"
        ).status_code
        == 400
    )
    assert (
        session_client.patch(
            url(workspace, note), {"notepad_collaborators": [str(guest.id)]}, format="json"
        ).status_code
        == 200
    )
    note.refresh_from_db()
    assert note.notepad_collaborators == []


def test_notepad_assets_are_scoped_and_revoked(session_client, workspace, note, guest):
    note.notepad_collaborators = [str(guest.id)]
    note.save(update_fields=["notepad_collaborators"])
    asset = FileAsset.objects.create(
        workspace=workspace,
        page=note,
        entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
        asset=f"{workspace.id}/image.png",
        attributes={"name": "image.png"},
        is_uploaded=True,
    )
    external = client(guest)
    base = f"/api/assets/v2/workspaces/{workspace.slug}/"
    with patch("plane.app.views.asset.v2.S3Storage.generate_presigned_url", return_value="https://example.com/image"):
        assert external.get(f"{base}{asset.id}/").status_code == 302
        assert external.get(f"{base}download/{asset.id}/").status_code == 302
    assert external.get(f"{base}check/{asset.id}/").json() == {"exists": True}
    with patch(
        "plane.app.views.asset.v2.S3Storage.generate_presigned_post",
        return_value={"url": "https://example.com", "fields": {}},
    ):
        response = external.post(
            base,
            {
                "entity_type": "PAGE_DESCRIPTION",
                "entity_identifier": str(note.id),
                "name": "guest.png",
                "type": "image/png",
                "size": 20,
            },
            format="json",
        )
        assert response.status_code == 200
        created = FileAsset.objects.get(pk=response.json()["asset_id"])
        assert created.page_id == note.id
    assert (
        external.post(
            base, {"entity_type": "WORKSPACE_LOGO", "entity_identifier": str(workspace.id)}, format="json"
        ).status_code
        == 403
    )
    assert (
        external.post(
            f"{base}duplicate-assets/{asset.id}/",
            {"entity_type": "PAGE_DESCRIPTION", "entity_id": str(uuid4())},
            format="json",
        ).status_code
        == 403
    )
    session_client.delete(url(workspace, note, "collaborators/"), {"only_me": True}, format="json")
    assert external.get(f"{base}{asset.id}/").status_code == 403
    assert external.get(f"{base}check/{asset.id}/").status_code == 403
    assert (
        external.post(
            base, {"entity_type": "PAGE_DESCRIPTION", "entity_identifier": str(note.id)}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.parametrize("role", [5, 15, 20])
def test_private_notepad_member_access_requires_invitation(session_client, workspace, note, guest, role):
    WorkspaceMember.objects.create(workspace=workspace, member=guest, role=role)
    member = client(guest)
    assert member.get(url(workspace, note)).status_code == 404
    note.notepad_collaborators = [str(guest.id)]
    note.save(update_fields=["notepad_collaborators"])
    assert member.get(url(workspace, note)).json()["can_edit"] is True
    assert member.patch(url(workspace, note), {"name": "Invited edit"}, format="json").status_code == 200
    assert member.get(url(workspace, note, "collaborators/")).status_code == 403
    session_client.delete(url(workspace, note, "collaborators/"), {"only_me": True}, format="json")
    assert member.get(url(workspace, note)).status_code == 404


def test_worker_sends_invitation_and_skips_revoked_invites(
    session_client, workspace, note, guest, django_capture_on_commit_callbacks
):
    from django.core import mail
    from plane.bgtasks.notepad_invitation_task import notepad_invitation

    token = invite(session_client, workspace, note, guest, django_capture_on_commit_callbacks)
    connection = mail.get_connection("django.core.mail.backends.locmem.EmailBackend")
    with patch(
        "plane.bgtasks.notepad_invitation_task.get_email_configuration",
        return_value=("localhost", "", "", 25, "0", "0", "pms@example.com"),
    ), patch("plane.bgtasks.notepad_invitation_task.get_connection", return_value=connection):
        notepad_invitation.run(str(note.id), guest.email, token, "https://pms.example.com")
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [guest.email]
        assert f"/shared/notepads/{workspace.slug}/{note.id}/?invitation=" in mail.outbox[0].body
        assert "not its workspace or linked projects" in mail.outbox[0].body
        session_client.delete(url(workspace, note, "collaborators/"), {"only_me": True}, format="json")
        notepad_invitation.run(str(note.id), guest.email, token, "https://pms.example.com")
        assert len(mail.outbox) == 1
