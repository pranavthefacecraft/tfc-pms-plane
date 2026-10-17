# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid
from pathlib import Path
from zipfile import BadZipFile, ZipFile

from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils.http import content_disposition_header
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.db.models import FileAsset, Page
from plane.settings.storage import S3Storage
from plane.utils.exception_logger import log_exception
from plane.utils.path_validator import sanitize_filename

from ..base import BaseAPIView
from .workspace import WorkspacePageMixin

DOCUMENT_TYPES = {
    ".pdf": ("application/pdf", None),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "word/document.xml"),
    ".xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xl/workbook.xml"),
}
MAX_EXPANDED_SIZE = 25 * 1024 * 1024


class WhiteboardDocumentEndpoint(WorkspacePageMixin, BaseAPIView):
    parser_classes = [MultiPartParser]

    def get_board(self, request, slug, page_id):
        return self.get_pages(request, slug).filter(pk=page_id, tool_type=Page.TOOL_TYPE_WHITEBOARD).first()

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def post(self, request, slug, page_id):
        page = self.get_board(request, slug, page_id)
        if page is None:
            return Response({"error": "Whiteboard not found"}, status=status.HTTP_404_NOT_FOUND)
        from .collaboration import require_board_editor

        require_board_editor(page, request.user)
        file = request.FILES.get("file")
        if file is None:
            return Response({"error": "A file is required"}, status=status.HTTP_400_BAD_REQUEST)
        name = sanitize_filename(file.name)
        extension = Path(name or "").suffix.lower()
        if extension not in DOCUMENT_TYPES:
            return Response({"error": "Use a PDF, DOCX or XLSX file"}, status=status.HTTP_400_BAD_REQUEST)
        if not 0 < file.size <= settings.FILE_SIZE_LIMIT:
            return Response(
                {"error": f"File must be between 1 and {settings.FILE_SIZE_LIMIT} bytes"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content_type, required_entry = DOCUMENT_TYPES[extension]
        try:
            if required_entry:
                with ZipFile(file) as archive:
                    valid = (
                        required_entry in archive.namelist()
                        and sum(item.file_size for item in archive.infolist()) <= MAX_EXPANDED_SIZE
                    )
            else:
                valid = file.read(5) == b"%PDF-"
        except BadZipFile:
            valid = False
        finally:
            file.seek(0)
        if not valid:
            return Response({"error": "Invalid or oversized document contents"}, status=status.HTTP_400_BAD_REQUEST)

        key = f"{page.workspace_id}/{uuid.uuid4().hex}-{name}"
        storage = S3Storage()
        try:
            storage.s3_client.upload_fileobj(
                file, storage.aws_storage_bucket_name, key, ExtraArgs={"ContentType": content_type}
            )
        except (BotoCoreError, ClientError) as exc:
            log_exception(exc)
            return Response({"error": "Document upload failed. Please retry."}, status=status.HTTP_502_BAD_GATEWAY)
        asset = FileAsset.objects.create(
            workspace_id=page.workspace_id,
            page=page,
            asset=key,
            attributes={"name": name, "type": content_type, "size": file.size},
            size=file.size,
            created_by=request.user,
            entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            is_uploaded=True,
        )
        return Response(
            {"id": str(asset.id), "name": name, "extension": extension},
            status=status.HTTP_201_CREATED,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, page_id, asset_id):
        page = self.get_board(request, slug, page_id)
        if page is None:
            return Response({"error": "Whiteboard not found"}, status=status.HTTP_404_NOT_FOUND)
        asset = FileAsset.objects.filter(
            pk=asset_id, page=page, workspace_id=page.workspace_id, is_uploaded=True, is_deleted=False
        ).first()
        if asset is None:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)
        storage = S3Storage()
        try:
            obj = storage.s3_client.get_object(Bucket=storage.aws_storage_bucket_name, Key=str(asset.asset))
        except (BotoCoreError, ClientError) as exc:
            log_exception(exc)
            return Response({"error": "Document could not be loaded"}, status=status.HTTP_502_BAD_GATEWAY)

        def chunks():
            try:
                yield from obj["Body"].iter_chunks(chunk_size=64 * 1024)
            finally:
                obj["Body"].close()

        response = StreamingHttpResponse(chunks(), content_type=asset.attributes["type"])
        response["Content-Disposition"] = content_disposition_header(True, asset.attributes["name"])
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
