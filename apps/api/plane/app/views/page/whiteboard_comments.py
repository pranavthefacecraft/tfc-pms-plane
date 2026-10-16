# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import math
import uuid
from pathlib import Path

from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    FileAsset,
    Notification,
    Page,
    UserNotificationPreference,
    WhiteboardComment,
    WhiteboardThread,
    WorkspaceMember,
)
from plane.settings.storage import S3Storage
from plane.utils.exception_logger import log_exception
from plane.utils.path_validator import sanitize_filename

from ..base import BaseAPIView
from .workspace import WorkspacePageMixin, _serialize_user

ROLES = [ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST]
ATTACHMENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".zip": "application/zip",
}


class CommentInput(serializers.Serializer):
    body = serializers.CharField(max_length=10000, allow_blank=True, default="")
    mentions = serializers.ListField(child=serializers.UUIDField(), max_length=50, default=list)
    attachments = serializers.ListField(child=serializers.UUIDField(), max_length=10, default=list)
    x = serializers.FloatField(min_value=-1000000, max_value=1000000, required=False)
    y = serializers.FloatField(min_value=-1000000, max_value=1000000, required=False)

    def validate(self, data):
        if any(not math.isfinite(data[key]) for key in ("x", "y") if key in data):
            raise serializers.ValidationError("Canvas coordinates must be finite.")
        if not data["body"].strip() and not data["attachments"]:
            raise serializers.ValidationError("Write a comment or attach a file.")
        return data


def serialize_attachment(asset):
    return {"id": str(asset.id), "name": asset.attributes["name"], "size": asset.size}


def serialize_thread(thread):
    return {
        "id": str(thread.id),
        "x": thread.x,
        "y": thread.y,
        "resolved": thread.resolved_at is not None,
        "comments": [
            {
                "id": str(comment.id),
                "body": comment.body,
                "mentions": comment.mentions,
                "author": _serialize_user(comment.created_by),
                "created_at": comment.created_at,
                "attachments": [serialize_attachment(asset) for asset in comment.attachments.all()],
            }
            for comment in thread.comments.all()
        ],
    }


class WhiteboardCommentsMixin(WorkspacePageMixin):
    def get_board(self, request, slug, page_id):
        return self.get_pages(request, slug).filter(pk=page_id, tool_type=Page.TOOL_TYPE_WHITEBOARD).first()

    def members(self, page):
        members = WorkspaceMember.objects.filter(workspace_id=page.workspace_id, is_active=True)
        if page.access == Page.PRIVATE_ACCESS:
            members = members.filter(member_id=page.owned_by_id)
        return members.select_related("member")

    def threads(self, page):
        return WhiteboardThread.objects.filter(page=page).prefetch_related(
            "comments__created_by", "comments__attachments"
        )


class WhiteboardThreadEndpoint(WhiteboardCommentsMixin, BaseAPIView):
    @allow_permission(allowed_roles=ROLES, level="WORKSPACE")
    def get(self, request, slug, page_id):
        page = self.get_board(request, slug, page_id)
        if page is None:
            return Response({"error": "Whiteboard not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "threads": [serialize_thread(thread) for thread in self.threads(page)],
                "members": [_serialize_user(member.member) for member in self.members(page)],
                "file_size_limit": settings.FILE_SIZE_LIMIT,
            }
        )

    @allow_permission(allowed_roles=ROLES, level="WORKSPACE")
    @transaction.atomic
    def post(self, request, slug, page_id, thread_id=None):
        page = self.get_board(request, slug, page_id)
        if page is None:
            return Response({"error": "Whiteboard not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CommentInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        thread = (
            WhiteboardThread.objects.select_for_update().filter(page=page, pk=thread_id).first() if thread_id else None
        )
        if thread_id and thread is None:
            return Response({"error": "Thread not found"}, status=status.HTTP_404_NOT_FOUND)
        if thread and thread.resolved_at:
            return Response({"error": "Reopen this thread before replying."}, status=status.HTTP_400_BAD_REQUEST)
        if thread is None and ("x" not in data or "y" not in data):
            return Response({"error": "Choose a canvas location."}, status=status.HTTP_400_BAD_REQUEST)
        members = {str(member.member_id) for member in self.members(page)}
        mentions = {str(member_id) for member_id in data["mentions"]}
        if not mentions.issubset(members):
            return Response({"error": "Mentioned users must be able to view this whiteboard."}, status=400)
        asset_ids = set(data["attachments"])
        assets = list(
            FileAsset.objects.filter(
                pk__in=asset_ids,
                page=page,
                created_by=request.user,
                is_uploaded=True,
                is_deleted=False,
            )
        )
        if len(assets) != len(asset_ids):
            return Response({"error": "Invalid comment attachment."}, status=400)
        if thread is None:
            thread = WhiteboardThread.objects.create(page=page, x=data["x"], y=data["y"], created_by=request.user)
        comment = WhiteboardComment.objects.create(
            thread=thread,
            body=data["body"],
            mentions=sorted(mentions),
            created_by=request.user,
        )
        comment.attachments.set(assets)
        disabled = set(
            str(pk)
            for pk in UserNotificationPreference.objects.filter(
                user_id__in=mentions,
                mention=False,
                project__isnull=True,
            )
            .filter(Q(workspace_id=page.workspace_id) | Q(workspace__isnull=True))
            .values_list("user_id", flat=True)
        )
        for receiver in mentions - disabled - {str(request.user.id)}:
            Notification.objects.create(
                workspace_id=page.workspace_id,
                entity_identifier=page.id,
                entity_name="whiteboard",
                title=f"{request.user.display_name} mentioned you on {page.name or 'Untitled whiteboard'}",
                message_stripped=comment.body[:300],
                sender="whiteboard.mentioned",
                triggered_by=request.user,
                receiver_id=receiver,
                data={"page_id": str(page.id), "thread_id": str(thread.id)},
            )
        return Response(serialize_thread(self.threads(page).get(pk=thread.id)), status=201)

    @allow_permission(allowed_roles=ROLES, level="WORKSPACE")
    @transaction.atomic
    def patch(self, request, slug, page_id, thread_id):
        page = self.get_board(request, slug, page_id)
        thread = WhiteboardThread.objects.select_for_update().filter(page=page, pk=thread_id).first() if page else None
        if thread is None:
            return Response({"error": "Thread not found"}, status=404)
        resolved = serializers.BooleanField().run_validation(request.data.get("resolved"))
        thread.resolved_at = timezone.now() if resolved else None
        thread.save(update_fields=["resolved_at", "updated_at", "updated_by"])
        return Response(serialize_thread(self.threads(page).get(pk=thread.id)))


class WhiteboardCommentAttachmentEndpoint(WhiteboardCommentsMixin, BaseAPIView):
    parser_classes = [MultiPartParser]

    @allow_permission(allowed_roles=ROLES, level="WORKSPACE")
    def post(self, request, slug, page_id):
        page = self.get_board(request, slug, page_id)
        if page is None:
            return Response({"error": "Whiteboard not found"}, status=404)
        file = request.FILES.get("file")
        if file is None:
            return Response({"error": "A file is required"}, status=400)
        name = sanitize_filename(file.name)
        extension = Path(name or "").suffix.lower()
        if extension not in ATTACHMENT_TYPES:
            return Response({"error": "Use PDF, Word, Excel, PNG, JPG, TXT, CSV or ZIP."}, status=400)
        if not 0 < file.size <= settings.FILE_SIZE_LIMIT:
            return Response({"error": f"File must be between 1 and {settings.FILE_SIZE_LIMIT} bytes."}, status=400)
        storage = S3Storage()
        key = f"{page.workspace_id}/{uuid.uuid4().hex}-{name}"
        content_type = ATTACHMENT_TYPES[extension]
        try:
            storage.s3_client.upload_fileobj(
                file,
                storage.aws_storage_bucket_name,
                key,
                ExtraArgs={"ContentType": content_type},
            )
        except (BotoCoreError, ClientError) as exc:
            log_exception(exc)
            return Response({"error": "Attachment upload failed. Please retry."}, status=502)
        asset = FileAsset.objects.create(
            page=page,
            workspace_id=page.workspace_id,
            asset=key,
            size=file.size,
            is_uploaded=True,
            created_by=request.user,
            entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            attributes={"name": name, "type": content_type, "size": file.size},
        )
        return Response(serialize_attachment(asset), status=201)
