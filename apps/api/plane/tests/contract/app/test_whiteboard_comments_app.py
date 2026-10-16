# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError
from django.core.files.uploadedfile import SimpleUploadedFile

from plane.db.models import (
    FileAsset,
    Notification,
    Page,
    User,
    UserNotificationPreference,
    WhiteboardComment,
    WhiteboardThread,
    WorkspaceMember,
)

STORAGE = "plane.app.views.page.whiteboard_comments.S3Storage"


@pytest.fixture
def board(workspace, create_user):
    return Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        is_global=True,
        tool_type=Page.TOOL_TYPE_WHITEBOARD,
    )


@pytest.fixture
def mentioned_user(workspace):
    user = User.objects.create(email=f"{uuid.uuid4().hex}@example.test", username=uuid.uuid4().hex)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5)
    return user


def url(workspace, board, thread_id=None):
    return f"/api/workspaces/{workspace.slug}/workspace-pages/{board.id}/threads/" + (
        f"{thread_id}/" if thread_id else ""
    )


def payload(**overrides):
    return {"body": "Canvas discussion", "x": 12.5, "y": -42, **overrides}


@pytest.mark.contract
@pytest.mark.django_db
class TestWhiteboardComments:
    def test_nonmembers_denied(self, session_client, workspace, board, create_user):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
        assert session_client.get(url(workspace, board)).status_code == 403
        assert session_client.post(url(workspace, board), payload(), format="json").status_code == 403

    def test_normal_page_denied(self, session_client, workspace, board):
        board.tool_type = Page.TOOL_TYPE_PAGE
        board.save()
        assert session_client.get(url(workspace, board)).status_code == 404
        assert session_client.post(url(workspace, board), payload(), format="json").status_code == 404

    @pytest.mark.parametrize("role", [5, 15, 20])
    def test_threads_replies_and_resolution(self, session_client, workspace, board, create_user, role):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
        created = session_client.post(url(workspace, board), payload(), format="json")
        assert created.status_code == 201
        data = created.json()
        assert (data["x"], data["y"]) == (12.5, -42)
        assert data["comments"][0]["author"]["id"] == str(create_user.id)
        thread_url = url(workspace, board, data["id"])
        reply = session_client.post(thread_url, {"body": "Reply"}, format="json")
        assert reply.status_code == 201
        assert len(reply.json()["comments"]) == 2
        resolved = session_client.patch(thread_url, {"resolved": True}, format="json")
        assert resolved.status_code == 200
        assert resolved.json()["resolved"]
        assert session_client.post(thread_url, {"body": "Not yet"}, format="json").status_code == 400
        assert session_client.patch(thread_url, {"resolved": False}, format="json").status_code == 200
        assert session_client.post(thread_url, {"body": "Again"}, format="json").status_code == 201
        listed = session_client.get(url(workspace, board)).json()
        assert len(listed["threads"]) == 1
        assert len(listed["threads"][0]["comments"]) == 3

    @pytest.mark.parametrize(
        "data",
        [
            {"body": "No anchor"},
            {"body": "", "x": 0, "y": 0},
            {"body": "a" * 10001, "x": 0, "y": 0},
            {"body": "Bad coordinate", "x": 1000001, "y": 0},
            {"body": "Bad coordinate", "x": "NaN", "y": 0},
            {"body": "Bad mention", "x": 0, "y": 0, "mentions": ["invalid"]},
        ],
    )
    def test_reject_invalid_input(self, session_client, workspace, board, data):
        assert session_client.post(url(workspace, board), data, format="json").status_code == 400
        assert not WhiteboardThread.objects.filter(page=board).exists()

    def test_private_board_denied(self, session_client, workspace, board, mentioned_user):
        board.owned_by = mentioned_user
        board.access = Page.PRIVATE_ACCESS
        board.save()
        assert session_client.get(url(workspace, board)).status_code == 404
        assert session_client.post(url(workspace, board), payload(), format="json").status_code == 404
        upload = url(workspace, board).replace("threads/", "comment-attachments/")
        assert session_client.post(upload, {}, format="multipart").status_code == 404

    def test_thread_cannot_cross_boards(self, session_client, workspace, board, create_user):
        other = Page.objects.create(workspace=workspace, owned_by=create_user, is_global=True, tool_type="whiteboard")
        thread = WhiteboardThread.objects.create(page=other, x=0, y=0)
        assert session_client.post(url(workspace, board, thread.id), {"body": "No"}, format="json").status_code == 404
        assert (
            session_client.patch(url(workspace, board, thread.id), {"resolved": True}, format="json").status_code == 404
        )

    def test_mention_notification(self, session_client, workspace, board, mentioned_user, create_user):
        response = session_client.post(
            url(workspace, board),
            payload(mentions=[str(mentioned_user.id), str(mentioned_user.id), str(create_user.id)]),
            format="json",
        )
        assert response.status_code == 201
        notification = Notification.objects.get(entity_name="whiteboard")
        assert notification.receiver_id == mentioned_user.id
        assert notification.triggered_by_id == create_user.id
        assert notification.data["thread_id"] == response.json()["id"]
        assert notification.entity_identifier == board.id
        assert Notification.objects.count() == 1

    @pytest.mark.parametrize("global_preference", [True, False])
    def test_respects_mention_preference(self, session_client, workspace, board, mentioned_user, global_preference):
        UserNotificationPreference.objects.create(
            user=mentioned_user,
            workspace=None if global_preference else workspace,
            mention=False,
        )
        assert (
            session_client.post(
                url(workspace, board),
                payload(mentions=[str(mentioned_user.id)]),
                format="json",
            ).status_code
            == 201
        )
        assert not Notification.objects.exists()

    def test_nonmember_and_private_mentions_rejected(self, session_client, workspace, board, mentioned_user):
        board.access = Page.PRIVATE_ACCESS
        board.save()
        assert (
            session_client.post(
                url(workspace, board),
                payload(mentions=[str(mentioned_user.id)]),
                format="json",
            ).status_code
            == 400
        )
        members = session_client.get(url(workspace, board)).json()["members"]
        assert len(members) == 1
        board.access = Page.PUBLIC_ACCESS
        board.save()
        WorkspaceMember.objects.filter(member=mentioned_user).update(is_active=False)
        assert (
            session_client.post(
                url(workspace, board),
                payload(mentions=[str(mentioned_user.id)]),
                format="json",
            ).status_code
            == 400
        )

    def test_notifications_visible_in_mentions_and_hidden_after_access_change(
        self, session_client, workspace, board, create_user, mentioned_user
    ):
        Notification.objects.create(
            workspace=workspace,
            receiver=create_user,
            entity_name="whiteboard",
            entity_identifier=board.id,
            title="Mention",
            sender="whiteboard.mentioned",
            data={"page_id": str(board.id), "thread_id": str(uuid.uuid4())},
        )
        notifications = f"/api/workspaces/{workspace.slug}/users/notifications/?mentioned=true"
        response = session_client.get(notifications)
        assert response.status_code == 200
        assert len(response.json()) == 1
        unread = f"/api/workspaces/{workspace.slug}/users/notifications/unread/"
        assert session_client.get(unread).json()["mention_unread_notifications_count"] == 1
        board.access = Page.PRIVATE_ACCESS
        board.owned_by = mentioned_user
        board.save()
        assert session_client.get(notifications).json() == []
        assert session_client.get(unread).json()["mention_unread_notifications_count"] == 0

    def test_guest_attachment_upload_and_comment(self, session_client, workspace, board, create_user):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
        upload_url = url(workspace, board).replace("threads/", "comment-attachments/")
        with patch(STORAGE):
            response = session_client.post(
                upload_url, {"file": SimpleUploadedFile("notes.txt", b"test")}, format="multipart"
            )
        assert response.status_code == 201
        asset_id = response.json()["id"]
        response = session_client.post(
            url(workspace, board),
            payload(body="", attachments=[asset_id]),
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["comments"][0]["attachments"][0]["name"] == "notes.txt"
        assert WhiteboardComment.objects.get().attachments.get().id == uuid.UUID(asset_id)

    def test_reject_foreign_attachment(self, session_client, workspace, board, mentioned_user):
        asset = FileAsset.objects.create(
            page=board, workspace=workspace, created_by=mentioned_user, asset="other", is_uploaded=True
        )
        assert (
            session_client.post(
                url(workspace, board),
                payload(attachments=[str(asset.id)]),
                format="json",
            ).status_code
            == 400
        )

    @pytest.mark.parametrize("name,data", [("bad.html", b"html"), ("empty.txt", b"")])
    def test_reject_attachment_input(self, session_client, workspace, board, name, data):
        upload_url = url(workspace, board).replace("threads/", "comment-attachments/")
        assert (
            session_client.post(upload_url, {"file": SimpleUploadedFile(name, data)}, format="multipart").status_code
            == 400
        )

    def test_attachment_size_limit(self, session_client, workspace, board, settings):
        settings.FILE_SIZE_LIMIT = 1
        upload_url = url(workspace, board).replace("threads/", "comment-attachments/")
        assert (
            session_client.post(
                upload_url, {"file": SimpleUploadedFile("test.txt", b"large")}, format="multipart"
            ).status_code
            == 400
        )

    def test_attachment_storage_failure(self, session_client, workspace, board):
        with patch(STORAGE) as storage:
            storage.return_value.s3_client.upload_fileobj.side_effect = ClientError(
                {"Error": {"Code": "ServiceUnavailable", "Message": "offline"}},
                "PutObject",
            )
            response = session_client.post(
                url(workspace, board).replace("threads/", "comment-attachments/"),
                {"file": SimpleUploadedFile("test.txt", b"test")},
                format="multipart",
            )
        assert response.status_code == 502
        assert not FileAsset.objects.filter(page=board).exists()
