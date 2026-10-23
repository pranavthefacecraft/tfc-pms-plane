# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.utils import timezone
from rest_framework.test import APIClient
from plane.db.models import Page, Profile, User, Workspace, WorkspaceMember


@pytest.fixture
def board(workspace, create_user):
    return Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        is_global=True,
        tool_type=Page.TOOL_TYPE_WHITEBOARD,
        access=Page.PRIVATE_ACCESS,
    )


def url(board, suffix="session"):
    return f"/api/workspaces/{board.workspace.slug}/workspace-pages/{board.id}/{suffix}/"


def participant(board, role):
    user = User.objects.create(email=f"board-{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex)
    WorkspaceMember.objects.create(workspace=board.workspace, member=user, role=15)
    board.whiteboard_roles[str(user.id)] = role
    board.save()
    client = APIClient()
    client.force_authenticate(user)
    return user, client


def operation(client, board, action, **extra):
    return client.post(url(board), {"action": action, "client_id": str(uuid.uuid4()), **extra}, format="json")


def element(identifier, version=1, deleted=False, nonce=10):
    return {"id": identifier, "version": version, "versionNonce": nonce, "isDeleted": deleted}


@pytest.fixture
def joined_guest(board):
    user = User.objects.create(email=f"visitor-{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex)
    board.whiteboard_guest_role = "viewer"
    board.whiteboard_guest_ids = [str(user.id)]
    board.save()
    client = APIClient()
    client.force_authenticate(user)
    return user, client


@pytest.mark.contract
@pytest.mark.django_db
class TestWhiteboardGuestWorkspace:
    @pytest.mark.django_db(transaction=True)
    def test_concurrent_boards_provision_only_one_personal_workspace(self, board, joined_guest):
        guest, _ = joined_guest
        other_board = Page.objects.create(
            workspace=board.workspace,
            owned_by=board.owned_by,
            is_global=True,
            tool_type=Page.TOOL_TYPE_WHITEBOARD,
            whiteboard_guest_role="editor",
            whiteboard_guest_ids=[str(guest.id)],
        )
        barrier = Barrier(2)

        def prepare(shared_board):
            try:
                client = APIClient()
                client.force_authenticate(guest)
                barrier.wait(timeout=10)
                response = client.post(url(shared_board, "guest-workspace"), {}, format="json")
                assert response.status_code == 200
                return response.json()["workspace_slug"]
            finally:
                connections.close_all()

        with patch("plane.app.views.page.collaboration.workspace_seed.delay") as seed:
            with ThreadPoolExecutor(max_workers=2) as executor:
                slugs = list(executor.map(prepare, [board, other_board]))
        assert slugs[0] == slugs[1]
        assert Workspace.objects.filter(owner=guest).count() == 1
        seed.assert_called_once()

    def test_provisions_one_owned_workspace_and_keeps_board_access_scoped(
        self, board, joined_guest, django_capture_on_commit_callbacks
    ):
        guest, client = joined_guest
        with (
            patch("plane.app.views.page.collaboration.workspace_seed.delay") as seed,
            django_capture_on_commit_callbacks(execute=True),
        ):
            response = client.post(url(board, "guest-workspace"), {}, format="json")
            assert response.status_code == 200
            personal = Workspace.objects.get(slug=response.json()["workspace_slug"])
            assert personal.owner_id == guest.id
            assert personal.id != board.workspace_id
            assert WorkspaceMember.objects.get(workspace=personal, member=guest).role == 20
            assert not WorkspaceMember.objects.filter(workspace=board.workspace, member=guest).exists()
            profile = Profile.objects.get(user=guest)
            assert profile.is_onboarded is True
            assert all(profile.onboarding_step.values())
            assert profile.last_workspace_id == personal.id
            assert profile.has_marketing_email_consent is False
            again = client.post(url(board, "guest-workspace"), {}, format="json")
            assert again.json() == response.json()
            assert Workspace.objects.filter(owner=guest).count() == 1
        seed.assert_called_once_with(str(personal.id))
        assert client.get(f"/api/workspaces/{board.workspace.slug}/workspace-pages/").status_code == 403
        assert client.get(f"/api/workspaces/{personal.slug}/workspace-pages/").status_code == 200
        assert client.get(url(board)).json()["role"] == "viewer"
        assert operation(client, board, "scene", scene={"elements": []}).status_code == 403

    def test_reuses_owned_workspace_without_creating_or_seeding_another(self, board, joined_guest):
        guest, client = joined_guest
        owned = Workspace.objects.create(owner=guest, name="Existing workspace", slug=f"owned-{uuid.uuid4().hex}")
        WorkspaceMember.objects.create(workspace=owned, member=guest, role=20)
        with patch("plane.app.views.page.collaboration.workspace_seed.delay") as seed:
            response = client.post(url(board, "guest-workspace"), {}, format="json")
        assert response.status_code == 200
        assert response.json()["workspace_slug"] == owned.slug
        assert Workspace.objects.filter(owner=guest).count() == 1
        seed.assert_not_called()

    def test_does_not_use_another_owners_workspace(self, board, joined_guest):
        guest, client = joined_guest
        other = Workspace.objects.create(owner=board.owned_by, name="Other workspace", slug=f"other-{uuid.uuid4().hex}")
        WorkspaceMember.objects.create(workspace=other, member=guest, role=15)
        response = client.post(url(board, "guest-workspace"), {}, format="json")
        assert response.status_code == 200
        personal = Workspace.objects.get(slug=response.json()["workspace_slug"])
        assert personal.owner_id == guest.id
        assert personal.id != other.id

    def test_respects_disabled_workspace_creation(self, board, joined_guest):
        guest, client = joined_guest
        with patch("plane.app.views.page.collaboration.get_configuration_value", return_value=("1",)):
            response = client.post(url(board, "guest-workspace"), {}, format="json")
        assert response.status_code == 403
        assert not Workspace.objects.filter(owner=guest).exists()
        # Existing owners can still navigate their workspace when new creation is disabled.
        owned = Workspace.objects.create(owner=guest, name="Existing", slug=f"owned-{uuid.uuid4().hex}")
        WorkspaceMember.objects.create(workspace=owned, member=guest, role=20)
        with patch("plane.app.views.page.collaboration.get_configuration_value", return_value=("1",)):
            response = client.post(url(board, "guest-workspace"), {}, format="json")
        assert response.status_code == 200
        assert response.json()["workspace_slug"] == owned.slug

    @pytest.mark.parametrize("state", ["not-joined", "disabled", "bot", "not-whiteboard", "archived"])
    def test_denies_invalid_guest_access_without_creating_workspaces(self, board, joined_guest, state):
        guest, client = joined_guest
        if state == "not-joined":
            board.whiteboard_guest_ids = []
        elif state == "disabled":
            board.whiteboard_guest_role = "disabled"
        elif state == "bot":
            User.objects.filter(pk=guest.pk).update(is_bot=True)
            guest.refresh_from_db()
        elif state == "not-whiteboard":
            board.tool_type = Page.TOOL_TYPE_PAGE
        elif state == "archived":
            board.archived_at = timezone.now()
        board.save()
        response = client.post(url(board, "guest-workspace"), {}, format="json")
        assert response.status_code in (403, 404)
        assert not Workspace.objects.filter(owner=guest).exists()

    def test_requires_sign_in_and_does_not_provision_on_get(self, board):
        client = APIClient()
        assert client.post(url(board, "guest-workspace"), {}, format="json").status_code in (401, 403)
        assert client.get(url(board, "guest-workspace")).status_code in (401, 403, 405)


@pytest.mark.contract
@pytest.mark.django_db
class TestWhiteboardCollaboration:
    def test_sharing_hides_bots_without_changing_accounts_or_roles(self, session_client, board, create_user):
        human, _ = participant(board, "viewer")
        bot, _ = participant(board, "editor")
        User.objects.filter(pk=bot.pk).update(is_bot=True)

        response = session_client.get(url(board, "sharing"))

        assert response.status_code == 200
        members = {member["user"]["id"]: member for member in response.json()["members"]}
        assert set(members) == {str(create_user.id), str(human.id)}
        assert members[str(create_user.id)]["role"] == "owner"
        assert members[str(human.id)]["role"] == "viewer"
        assert User.objects.filter(pk=bot.pk, is_bot=True, is_active=True).exists()
        assert WorkspaceMember.objects.filter(workspace=board.workspace, member=bot, is_active=True).exists()
        board.refresh_from_db()
        assert board.whiteboard_roles[str(bot.id)] == "editor"

    def test_simultaneous_edits_merge_and_tombstones_do_not_resurrect(self, session_client, board):
        _, editor = participant(board, "editor")
        assert operation(session_client, board, "scene", scene={"elements": [element("a")]}).status_code == 200
        assert operation(editor, board, "scene", scene={"elements": [element("b")]}).status_code == 200
        operation(editor, board, "scene", scene={"elements": [element("a", 2, True)]})
        response = operation(session_client, board, "scene", scene={"elements": [element("a")]})
        elements = {value["id"]: value for value in response.json()["scene"]["elements"]}
        assert set(elements) == {"a", "b"}
        assert elements["a"]["isDeleted"] is True

    def test_equal_versions_resolve_by_nonce(self, session_client, board):
        operation(session_client, board, "scene", scene={"elements": [element("a", nonce=20)]})
        response = operation(session_client, board, "scene", scene={"elements": [element("a", nonce=10)]})
        assert response.json()["scene"]["elements"][0]["versionNonce"] == 10

    def test_viewer_can_read_but_cannot_edit_or_present(self, board):
        _, viewer = participant(board, "viewer")
        assert viewer.get(url(board)).status_code == 200
        assert operation(viewer, board, "scene", scene={"elements": [element("x")]}).status_code == 403
        assert operation(viewer, board, "present", viewport={"zoom": 1, "scrollX": 0, "scrollY": 0}).status_code == 403
        detail = url(board, "").rstrip("/") + "/"
        assert viewer.patch(detail, {"name": "Changed"}, format="json").status_code == 403
        assert viewer.post(url(board, "documents"), {}, format="multipart").status_code == 403
        assert viewer.post(url(board, "threads"), {"body": "No edit", "x": 0, "y": 0}, format="json").status_code == 403
        assert viewer.post(url(board, "comment-attachments"), {}, format="multipart").status_code == 403

    def test_explicit_guest_editor_can_edit_metadata_documents_and_comments(self, board):
        user, editor = participant(board, "editor")
        WorkspaceMember.objects.filter(workspace=board.workspace, member=user).update(role=5)
        detail = url(board, "").rstrip("/") + "/"
        assert editor.patch(detail, {"name": "Shared edit"}, format="json").status_code == 200
        assert operation(editor, board, "scene", scene={"elements": [element("guest")]}).status_code == 200
        with patch("plane.app.views.page.documents.S3Storage") as storage:
            response = editor.post(
                url(board, "documents"),
                {"file": SimpleUploadedFile("shared.pdf", b"%PDF-1.7\nshared")},
                format="multipart",
            )
        assert response.status_code == 201
        storage.return_value.s3_client.upload_fileobj.assert_called_once()
        response = editor.post(url(board, "threads"), {"body": "Shared comment", "x": 0, "y": 0}, format="json")
        assert response.status_code == 201

    def test_guest_still_cannot_edit_ordinary_notepad_pages(self, board):
        user, guest = participant(board, "editor")
        WorkspaceMember.objects.filter(workspace=board.workspace, member=user).update(role=5)
        board.tool_type = Page.TOOL_TYPE_PAGE
        board.access = Page.PUBLIC_ACCESS
        board.save()
        detail = url(board, "").rstrip("/") + "/"
        assert guest.patch(detail, {"name": "Denied"}, format="json").status_code == 403
        assert guest.put(url(board, "attachment"), {}, format="json").status_code == 403
        assert guest.delete(url(board, "attachment")).status_code == 403

    def test_only_owner_manages_sharing_and_outsiders_cannot_be_added(self, session_client, board):
        user, editor = participant(board, "editor")
        assert editor.get(url(board, "sharing")).status_code == 403
        outsider = User.objects.create(email=f"outside-{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex)
        assert (
            session_client.post(
                url(board, "sharing"),
                {
                    "user_id": str(outsider.id),
                    "role": "editor",
                },
                format="json",
            ).status_code
            == 400
        )
        shared = session_client.post(url(board, "sharing"), {"user_id": str(user.id), "role": "viewer"}, format="json")
        assert shared.status_code == 200, shared.json()
        assert editor.get(url(board)).json()["role"] == "viewer"

    def test_revocation_removes_private_board_and_member_departure_denies_access(self, session_client, board):
        user, editor = participant(board, "editor")
        assert editor.get(url(board)).status_code == 200
        session_client.post(url(board, "sharing"), {"user_id": str(user.id), "role": "remove"}, format="json")
        assert editor.get(url(board)).status_code == 404
        board.refresh_from_db()
        board.whiteboard_roles[str(user.id)] = "editor"
        board.save()
        WorkspaceMember.objects.filter(member=user, workspace=board.workspace).update(is_active=False)
        assert editor.get(url(board)).status_code == 403

    def test_presentation_pauses_all_edits_and_follows_viewport(self, session_client, board):
        _, editor = participant(board, "editor")
        client_id = str(uuid.uuid4())
        viewport = {"zoom": 1.5, "scrollX": 12, "scrollY": -50}
        response = session_client.post(
            url(board),
            {
                "action": "present",
                "client_id": client_id,
                "viewport": viewport,
            },
            format="json",
        )
        assert response.status_code == 200
        assert editor.get(url(board)).json()["presenter"]["viewport"] == viewport
        assert operation(editor, board, "scene", scene={"elements": []}).status_code == 403
        assert operation(session_client, board, "scene", scene={"elements": []}).status_code == 403
        assert editor.post(url(board, "threads"), {"body": "Paused", "x": 0, "y": 0}, format="json").status_code == 403
        assert editor.post(url(board, "documents"), {}, format="multipart").status_code == 403
        assert operation(editor, board, "stop").status_code == 403
        assert (
            session_client.post(url(board), {"action": "stop", "client_id": client_id}, format="json").status_code
            == 200
        )
        assert operation(editor, board, "scene", scene={"elements": []}).status_code == 200

    def test_disconnected_presenter_expires_and_presence_is_per_session(self, session_client, board):
        board.whiteboard_session = {
            "presenter": {"client_id": "expired", "expires": time.time() - 1},
            "participants": {"expired": {"user_id": str(board.owned_by_id), "expires": time.time() - 1}},
        }
        board.save()
        response = operation(session_client, board, "heartbeat")
        assert response.json()["presenter"] is None
        assert len(response.json()["participants"]) == 1
        assert operation(session_client, board, "scene", scene={"elements": []}).status_code == 200

    @pytest.mark.parametrize(
        "scene",
        [
            {"elements": [{"id": "bad"}]},
            {"elements": "bad"},
            {"files": []},
            {"elements": [element("bad", version=-1)]},
        ],
    )
    def test_invalid_scenes_rejected(self, session_client, board, scene):
        assert operation(session_client, board, "scene", scene=scene).status_code == 400

    def test_legacy_snapshot_endpoint_cannot_overwrite_collaboration(self, session_client, board):
        response = session_client.patch(
            url(board, "").rstrip("/") + "/",
            {"description_json": {"elements": []}},
            format="json",
        )
        assert response.status_code == 400

    def test_anonymous_cannot_join(self, board):
        assert APIClient().get(url(board)).status_code in (401, 403)

    @pytest.mark.parametrize("role", ["viewer", "editor"])
    def test_outsider_joins_only_shared_board_without_workspace_membership(self, session_client, board, role):
        guest = User.objects.create(email=f"guest-{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex)
        client = APIClient()
        client.force_authenticate(guest)
        assert client.get(url(board, "guest")).status_code == 404
        assert client.post(url(board, "guest"), {}, format="json").status_code == 403
        assert client.get(url(board)).status_code == 403
        sharing = session_client.post(url(board, "sharing"), {"guest_role": role}, format="json")
        assert sharing.status_code == 200
        assert sharing.json()["guest_role"] == role
        assert client.get(url(board, "guest")).json() == {
            "is_member": False,
            "joined": False,
            "guest_role": role,
        }
        # Knowing an enabled link does not grant access until the user chooses to join.
        assert client.get(url(board)).status_code == 403
        for _ in range(2):
            assert client.post(url(board, "guest"), {}, format="json").json()["joined"] is True
        board.refresh_from_db()
        assert board.whiteboard_guest_ids == [str(guest.id)]
        assert not WorkspaceMember.objects.filter(workspace=board.workspace, member=guest).exists()
        detail = url(board, "").rstrip("/") + "/"
        assert client.get(detail).status_code == 200
        assert client.get(detail).json()["attachment"] is None
        assert client.get(url(board)).json()["role"] == role
        heartbeat = operation(client, board, "heartbeat")
        assert heartbeat.status_code == 200
        assert any(entry["user"]["id"] == str(guest.id) for entry in heartbeat.json()["participants"])
        listed = session_client.get(url(board, "sharing")).json()
        assert listed["guests"][0]["id"] == str(guest.id)
        assert client.get(url(board, "sharing")).status_code == 403
        assert client.post(url(board, "sharing"), {"guest_role": "editor"}, format="json").status_code == 403
        assert operation(client, board, "present", viewport={"zoom": 1, "scrollX": 0, "scrollY": 0}).status_code == 403
        assert client.get(f"/api/workspaces/{board.workspace.slug}/workspace-pages/").status_code == 403
        assert client.delete(detail).status_code == 403
        assert client.put(url(board, "attachment"), {}, format="json").status_code == 403
        other = Page.objects.create(
            workspace=board.workspace,
            owned_by=board.owned_by,
            is_global=True,
            tool_type=Page.TOOL_TYPE_WHITEBOARD,
            access=Page.PUBLIC_ACCESS,
        )
        assert client.get(url(other)).status_code == 403
        assert client.get(url(other, "").rstrip("/") + "/").status_code == 403
        expected = 200 if role == "editor" else 403
        assert operation(client, board, "scene", scene={"elements": [element("guest")]}).status_code == expected
        assert client.patch(detail, {"name": "Guest edit"}, format="json").status_code == expected
        assert client.post(url(board, "threads"), {"body": "Hello", "x": 0, "y": 0}, format="json").status_code == (
            201 if role == "editor" else 403
        )
        assert client.get(url(board, "threads")).status_code == 200
        with patch("plane.app.views.page.documents.S3Storage"):
            response = client.post(
                url(board, "documents"),
                {"file": SimpleUploadedFile("guest.pdf", b"%PDF-1.7\nguest")},
                format="multipart",
            )
        assert response.status_code == (201 if role == "editor" else 403)
        asset_id = response.json().get("id")
        if asset_id:
            with patch("plane.app.views.page.documents.S3Storage") as storage:
                body = storage.return_value.s3_client.get_object.return_value["Body"]
                body.iter_chunks.return_value = iter([b"%PDF-1.7\nguest"])
                download = client.get(url(board, f"documents/{asset_id}"))
                assert download.status_code == 200
                assert b"".join(download.streaming_content) == b"%PDF-1.7\nguest"
                body.close.assert_called_once()
        with patch("plane.app.views.page.whiteboard_comments.S3Storage"):
            response = client.post(
                url(board, "comment-attachments"),
                {"file": SimpleUploadedFile("guest.txt", b"guest")},
                format="multipart",
            )
        assert response.status_code == (201 if role == "editor" else 403)
        assert session_client.post(url(board, "sharing"), {"guest_role": "disabled"}, format="json").status_code == 200
        assert client.get(url(board)).status_code == 403
        assert client.get(detail).status_code == 403
        assert operation(client, board, "scene", scene={"elements": []}).status_code == 403
        assert client.get(url(board, "threads")).status_code == 403
        if asset_id:
            assert client.get(url(board, f"documents/{asset_id}")).status_code == 403
        board.refresh_from_db()
        assert board.whiteboard_guest_ids == []
        assert User.objects.filter(pk=guest.pk).exists()

    def test_owner_controls_guest_role_and_can_remove_guest(self, session_client, board):
        _, editor = participant(board, "editor")
        assert editor.get(url(board, "guest")).json()["is_member"] is True
        assert editor.post(url(board, "sharing"), {"guest_role": "editor"}, format="json").status_code == 403
        assert session_client.post(url(board, "sharing"), {"guest_role": "owner"}, format="json").status_code == 400
        guest = User.objects.create(email=f"guest-{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex)
        client = APIClient()
        client.force_authenticate(guest)
        session_client.post(url(board, "sharing"), {"guest_role": "editor"}, format="json")
        assert client.post(url(board, "guest"), {}, format="json").status_code == 200
        assert client.get(url(board)).json()["role"] == "editor"
        session_client.post(url(board, "sharing"), {"guest_role": "viewer"}, format="json")
        assert client.get(url(board)).json()["role"] == "viewer"
        assert operation(client, board, "scene", scene={"elements": []}).status_code == 403
        session_client.post(url(board, "sharing"), {"user_id": str(guest.id), "role": "remove"}, format="json")
        assert client.get(url(board)).status_code == 403
        assert editor.get(url(board)).json()["role"] == "editor"

    def test_guest_entry_requires_sign_in_and_rejects_bots_and_non_boards(self, session_client, board):
        session_client.post(url(board, "sharing"), {"guest_role": "viewer"}, format="json")
        assert APIClient().post(url(board, "guest"), {}, format="json").status_code in (401, 403)
        assert APIClient().get(url(board, "guest")).status_code in (401, 403)
        bot = User.objects.create(email=f"bot-{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex, is_bot=True)
        client = APIClient()
        client.force_authenticate(bot)
        assert client.post(url(board, "guest"), {}, format="json").status_code == 403
        board.tool_type = Page.TOOL_TYPE_PAGE
        board.save()
        assert session_client.get(url(board, "guest")).status_code == 404
