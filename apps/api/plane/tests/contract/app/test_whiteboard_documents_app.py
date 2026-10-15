# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import io
import uuid
from unittest.mock import patch
from zipfile import ZipFile

import pytest
from botocore.exceptions import ClientError
from django.core.files.uploadedfile import SimpleUploadedFile

from plane.db.models import FileAsset, Page, User, WorkspaceMember

STORAGE = "plane.app.views.page.documents.S3Storage"


@pytest.fixture
def board(workspace, create_user):
    return Page.objects.create(
        workspace=workspace, owned_by=create_user, is_global=True, tool_type=Page.TOOL_TYPE_WHITEBOARD
    )


def url(workspace, board, asset=None):
    base = f"/api/workspaces/{workspace.slug}/workspace-pages/{board.id}/documents/"
    return f"{base}{asset.id}/" if asset else base


def file_for(extension):
    if extension == "pdf":
        return SimpleUploadedFile("test.pdf", b"%PDF-1.7\npreview test")
    data = io.BytesIO()
    with ZipFile(data, "w") as archive:
        archive.writestr("word/document.xml" if extension == "docx" else "xl/workbook.xml", "<xml/>")
    return SimpleUploadedFile(f"test.{extension}", data.getvalue())


@pytest.mark.contract
@pytest.mark.django_db
class TestWhiteboardDocuments:
    @pytest.mark.parametrize("extension", ["pdf", "docx", "xlsx"])
    def test_upload(self, session_client, workspace, board, extension):
        with patch(STORAGE) as storage:
            response = session_client.post(url(workspace, board), {"file": file_for(extension)}, format="multipart")
        assert response.status_code == 201
        asset = FileAsset.objects.get(pk=response.json()["id"])
        assert asset.page_id == board.id
        assert asset.is_uploaded
        assert response.json()["extension"] == f".{extension}"
        storage.return_value.s3_client.upload_fileobj.assert_called_once()

    @pytest.mark.parametrize("name,content", [("bad.pdf", b"not pdf"), ("bad.docx", b"invalid"), ("old.xls", b"x")])
    def test_reject_invalid_documents(self, session_client, workspace, board, name, content):
        response = session_client.post(
            url(workspace, board), {"file": SimpleUploadedFile(name, content)}, format="multipart"
        )
        assert response.status_code == 400
        assert not FileAsset.objects.filter(page=board).exists()

    def test_size_limit(self, session_client, workspace, board, settings):
        settings.FILE_SIZE_LIMIT = 4
        assert (
            session_client.post(url(workspace, board), {"file": file_for("pdf")}, format="multipart").status_code == 400
        )

    def test_missing_file(self, session_client, workspace, board):
        assert session_client.post(url(workspace, board), {}, format="multipart").status_code == 400

    @pytest.mark.parametrize("expanded_limit,expected", [(6, 201), (5, 400)])
    def test_office_expanded_size_limit(self, session_client, workspace, board, expanded_limit, expected):
        with patch(STORAGE), patch("plane.app.views.page.documents.MAX_EXPANDED_SIZE", expanded_limit):
            response = session_client.post(url(workspace, board), {"file": file_for("docx")}, format="multipart")
        assert response.status_code == expected

    def test_normal_page_rejected(self, session_client, workspace, board):
        board.tool_type = Page.TOOL_TYPE_PAGE
        board.save()
        assert (
            session_client.post(url(workspace, board), {"file": file_for("pdf")}, format="multipart").status_code == 404
        )

    def test_document_routes_reject_wrong_methods(self, session_client, workspace, board):
        assert session_client.get(url(workspace, board)).status_code == 405
        assert session_client.post(f"{url(workspace, board)}{uuid.uuid4()}/", {}, format="multipart").status_code == 405

    def test_private_board_hidden(self, session_client, workspace, board):
        owner = User.objects.create(email=f"{uuid.uuid4().hex}@example.com", username=uuid.uuid4().hex)
        board.owned_by = owner
        board.access = Page.PRIVATE_ACCESS
        board.save()
        assert (
            session_client.post(url(workspace, board), {"file": file_for("pdf")}, format="multipart").status_code == 404
        )
        asset = FileAsset.objects.create(page=board, workspace=workspace, asset="private", is_uploaded=True)
        assert session_client.get(url(workspace, board, asset)).status_code == 404

    def test_guest_cannot_upload(self, session_client, workspace, board, create_user):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
        assert (
            session_client.post(url(workspace, board), {"file": file_for("pdf")}, format="multipart").status_code == 403
        )

    def test_download_scoped_to_board(self, session_client, workspace, board, create_user):
        other = Page.objects.create(
            workspace=workspace, owned_by=create_user, is_global=True, tool_type=Page.TOOL_TYPE_WHITEBOARD
        )
        asset = FileAsset.objects.create(page=other, workspace=workspace, asset="other", is_uploaded=True)
        assert session_client.get(url(workspace, board, asset)).status_code == 404

    @pytest.mark.parametrize("role", [15, 5])
    def test_download_and_close(self, session_client, workspace, board, create_user, role):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
        asset = FileAsset.objects.create(
            page=board,
            workspace=workspace,
            asset="pdf",
            is_uploaded=True,
            attributes={"name": "test.pdf", "type": "application/pdf"},
        )
        with patch(STORAGE) as storage:
            body = storage.return_value.s3_client.get_object.return_value["Body"]
            body.iter_chunks.return_value = [b"%PDF-test"]
            response = session_client.get(url(workspace, board, asset))
            assert response.status_code == 200
            assert b"".join(response.streaming_content) == b"%PDF-test"
            assert response["Cache-Control"] == "private, no-store"
            body.close.assert_called_once()

    @pytest.mark.parametrize("flags", [{"is_uploaded": False}, {"is_uploaded": True, "is_deleted": True}])
    def test_unavailable_assets_not_downloadable(self, session_client, workspace, board, flags):
        asset = FileAsset.objects.create(page=board, workspace=workspace, asset="unavailable", **flags)
        assert session_client.get(url(workspace, board, asset)).status_code == 404

    def test_storage_failure_is_explicit(self, session_client, workspace, board):
        with patch(STORAGE) as storage:
            storage.return_value.s3_client.upload_fileobj.side_effect = ClientError(
                {"Error": {"Code": "ServiceUnavailable", "Message": "offline"}}, "PutObject"
            )
            response = session_client.post(url(workspace, board), {"file": file_for("pdf")}, format="multipart")
        assert response.status_code == 502
        assert not FileAsset.objects.filter(page=board).exists()
