import math
import os
import re
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError
from django.db import transaction
from django.db.models import Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FileUploadParser
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import IssueLink, ProjectMember, Recording, Workspace, WorkspaceMember
from plane.settings.storage import S3Storage
from plane.utils.exception_logger import log_exception
from plane.utils.host import base_host

PART_SIZE = 5 * 1024 * 1024
MAX_SIZE = 500 * 1024 * 1024
MAX_DURATION_MS = 60 * 60 * 1000
CONTENT_TYPES = ("video/webm", "video/mp4")
STORAGE_ERRORS = (BotoCoreError, ClientError)


class RecordingInput(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    content_type = serializers.ChoiceField(choices=CONTENT_TYPES)
    size = serializers.IntegerField(min_value=1, max_value=MAX_SIZE)
    duration_ms = serializers.IntegerField(min_value=1, max_value=MAX_DURATION_MS)


class RecordingShareInput(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.UUIDField())


def recording_storage():
    storage = S3Storage()
    storage.aws_storage_bucket_name = os.environ.get(
        "RECORDINGS_BUCKET_NAME", f"{storage.aws_storage_bucket_name}-recordings"
    )
    return storage


class RecordingAPIView(BaseAPIView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user.is_bot:
            raise PermissionDenied("Recordings are available only to human workspace members.")

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response


def visible_recordings(user, slug):
    return Recording.objects.filter(workspace__slug=slug).filter(Q(owner=user) | Q(viewers=user)).distinct()


def serialize(recording, user):
    viewers = list(recording.viewers.all())
    return {
        "id": str(recording.id),
        "name": recording.name,
        "owner_id": str(recording.owner_id),
        "owner_name": recording.owner.display_name or recording.owner.first_name or recording.owner.email,
        "size": recording.size,
        "duration_ms": recording.duration_ms,
        "content_type": recording.content_type,
        "ready": recording.ready,
        "created_at": recording.created_at,
        "viewer_ids": [str(viewer.id) for viewer in viewers] if recording.owner_id == user.id else [],
        "shared": bool(viewers),
    }


def storage_failure(exc):
    log_exception(exc)
    return Response({"error": "Recording storage is unavailable. Please retry."}, status=status.HTTP_502_BAD_GATEWAY)


class RecordingsEndpoint(RecordingAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        serializer = serializers.IntegerField(min_value=0)
        offset = serializer.run_validation(request.query_params.get("offset", 0))
        recordings = visible_recordings(request.user, slug).select_related("owner").prefetch_related("viewers")
        query = request.query_params.get("query", "").strip()[:200]
        if query:
            recordings = recordings.filter(name__icontains=query)
        rows = list(recordings[offset : offset + 21])
        return Response(
            {
                "results": [serialize(item, request.user) for item in rows[:20]],
                "next_offset": offset + 20 if len(rows) > 20 else None,
                "limits": {"max_size": MAX_SIZE, "max_duration_ms": MAX_DURATION_MS, "part_size": PART_SIZE},
            }
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        data = RecordingInput(data=request.data)
        data.is_valid(raise_exception=True)
        workspace = get_object_or_404(Workspace, slug=slug)
        key = f"recordings/{workspace.id}/{request.user.id}/{uuid4().hex}"
        storage = recording_storage()
        try:
            upload = storage.s3_client.create_multipart_upload(
                Bucket=storage.aws_storage_bucket_name,
                Key=key,
                ContentType=data.validated_data["content_type"],
            )
        except STORAGE_ERRORS as exc:
            return storage_failure(exc)
        try:
            recording = Recording.objects.create(
                workspace=workspace,
                owner=request.user,
                object_key=key,
                upload_id=upload["UploadId"],
                **data.validated_data,
            )
        except Exception:
            try:
                storage.s3_client.abort_multipart_upload(
                    Bucket=storage.aws_storage_bucket_name,
                    Key=key,
                    UploadId=upload["UploadId"],
                )
            except STORAGE_ERRORS as exc:
                log_exception(exc)
            raise
        return Response({"id": str(recording.id), "part_size": PART_SIZE}, status=status.HTTP_201_CREATED)


class RecordingPartEndpoint(RecordingAPIView):
    parser_classes = [FileUploadParser]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def put(self, request, slug, pk, part):
        with transaction.atomic():
            recording = get_object_or_404(
                Recording.objects.select_for_update(),
                pk=pk,
                owner=request.user,
                workspace__slug=slug,
                ready=False,
            )
            count = math.ceil(recording.size / PART_SIZE)
            if part < 1 or part > count:
                raise serializers.ValidationError({"part": "Invalid recording part."})
            file = request.data.get("file")
            expected = min(PART_SIZE, recording.size - (part - 1) * PART_SIZE)
            if file is None or file.size != expected:
                raise serializers.ValidationError({"file": f"This part must contain exactly {expected} bytes."})
            if part == 1:
                header = file.read(12)
                file.seek(0)
                valid = (
                    header.startswith(b"\x1a\x45\xdf\xa3")
                    if recording.content_type == "video/webm"
                    else header[4:8] == b"ftyp"
                )
                if not valid:
                    raise serializers.ValidationError({"file": "Invalid recording contents."})
            storage = recording_storage()
            try:
                storage.s3_client.upload_part(
                    Bucket=storage.aws_storage_bucket_name,
                    Key=recording.object_key,
                    UploadId=recording.upload_id,
                    PartNumber=part,
                    Body=file,
                )
            except STORAGE_ERRORS as exc:
                return storage_failure(exc)
        return Response({"part": part})


class RecordingCompleteEndpoint(RecordingAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, pk):
        with transaction.atomic():
            recording = get_object_or_404(
                Recording.objects.select_for_update(),
                pk=pk,
                owner=request.user,
                workspace__slug=slug,
            )
            if not recording.ready:
                storage = recording_storage()
                try:
                    try:
                        parts = storage.s3_client.list_parts(
                            Bucket=storage.aws_storage_bucket_name,
                            Key=recording.object_key,
                            UploadId=recording.upload_id,
                        )
                    except ClientError as exc:
                        if exc.response["Error"]["Code"] != "NoSuchUpload":
                            raise
                        # Completion may have reached S3 before the database transaction committed.
                        obj = storage.s3_client.head_object(
                            Bucket=storage.aws_storage_bucket_name, Key=recording.object_key
                        )
                        if obj["ContentLength"] != recording.size or obj["ContentType"] != recording.content_type:
                            raise serializers.ValidationError({"error": "Stored recording does not match its upload."})
                        recording.ready = True
                        recording.upload_id = ""
                        recording.save(update_fields=["ready", "upload_id", "updated_at"])
                        return Response(serialize(recording, request.user))
                    rows = sorted(parts.get("Parts", []), key=lambda item: item["PartNumber"])
                    count = math.ceil(recording.size / PART_SIZE)
                    if (
                        parts.get("IsTruncated")
                        or len(rows) != count
                        or any(
                            row["PartNumber"] != index + 1
                            or row["Size"] != min(PART_SIZE, recording.size - index * PART_SIZE)
                            for index, row in enumerate(rows)
                        )
                    ):
                        raise serializers.ValidationError({"error": "Recording upload is incomplete."})
                    storage.s3_client.complete_multipart_upload(
                        Bucket=storage.aws_storage_bucket_name,
                        Key=recording.object_key,
                        UploadId=recording.upload_id,
                        MultipartUpload={
                            "Parts": [{"PartNumber": row["PartNumber"], "ETag": row["ETag"]} for row in rows]
                        },
                    )
                except STORAGE_ERRORS as exc:
                    return storage_failure(exc)
                recording.ready = True
                recording.upload_id = ""
                recording.save(update_fields=["ready", "upload_id", "updated_at"])
        return Response(serialize(recording, request.user))


class RecordingEndpoint(RecordingAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, pk):
        recording = get_object_or_404(visible_recordings(request.user, slug).select_related("owner"), pk=pk)
        return Response(serialize(recording, request.user))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request, slug, pk):
        with transaction.atomic():
            recording = get_object_or_404(
                Recording.all_objects.select_for_update(),
                pk=pk,
                owner=request.user,
                workspace__slug=slug,
            )
            if recording.deleted_at is not None:
                return Response(status=status.HTTP_204_NO_CONTENT)
            storage = recording_storage()
            try:
                delete_recording_object(storage, recording)
            except STORAGE_ERRORS as exc:
                return storage_failure(exc)
            recording.issue_links.all().delete()
            recording.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecordingShareEndpoint(RecordingAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def put(self, request, slug, pk):
        data = RecordingShareInput(data=request.data)
        data.is_valid(raise_exception=True)
        ids = set(data.validated_data["user_ids"])
        members = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            is_active=True,
            member__is_active=True,
            member__is_bot=False,
            member_id__in=ids,
        )
        if set(members.values_list("member_id", flat=True)) != ids:
            raise serializers.ValidationError({"user_ids": "Share only with active teammates in this workspace."})
        with transaction.atomic():
            recording = get_object_or_404(
                Recording.objects.select_for_update(),
                pk=pk,
                owner=request.user,
                workspace__slug=slug,
                ready=True,
            )
            recording.viewers.set(ids - {request.user.id})
        return Response(serialize(recording, request.user))


class RecordingAttachEndpoint(RecordingAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, pk):
        issue_id = serializers.UUIDField().run_validation(request.data.get("issue_id"))
        with transaction.atomic():
            recording = get_object_or_404(
                Recording.objects.select_for_update(),
                pk=pk,
                owner=request.user,
                workspace__slug=slug,
                ready=True,
            )
            from plane.db.models import Issue

            projects = ProjectMember.objects.filter(
                member=request.user, is_active=True, role__gte=ROLE.MEMBER.value
            ).values("project_id")
            issue = get_object_or_404(Issue.issue_objects, pk=issue_id, workspace__slug=slug, project_id__in=projects)
            url = f"{base_host(request)}/{slug}/tool/recorder/{recording.id}"
            link, _ = IssueLink.objects.get_or_create(
                workspace_id=recording.workspace_id,
                project_id=issue.project_id,
                issue=issue,
                url=url,
                defaults={"title": recording.name},
            )
            recording.issue_links.add(link)
        return Response({"id": str(link.id)}, status=status.HTTP_201_CREATED)


def byte_range(header, size):
    if not header:
        return 0, size - 1, False
    match = re.fullmatch(r"bytes=([0-9]{0,20})-([0-9]{0,20})", header)
    if not match or not any(match.groups()):
        raise ValueError("Invalid range")
    first, last = match.groups()
    if not first:
        length = int(last)
        if length < 1:
            raise ValueError("Invalid suffix")
        start, end = max(0, size - length), size - 1
    else:
        start, end = int(first), min(int(last) if last else size - 1, size - 1)
    if start >= size or start > end:
        raise ValueError("Unsatisfiable range")
    return start, end, True


def delete_recording_object(storage, recording):
    if recording.upload_id:
        try:
            storage.s3_client.abort_multipart_upload(
                Bucket=storage.aws_storage_bucket_name, Key=recording.object_key, UploadId=recording.upload_id
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "NoSuchUpload":
                raise
    storage.s3_client.delete_object(Bucket=storage.aws_storage_bucket_name, Key=recording.object_key)


class RecordingPlaybackEndpoint(RecordingAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, pk):
        recording = get_object_or_404(visible_recordings(request.user, slug), pk=pk, ready=True)
        try:
            start, end, partial = byte_range(request.headers.get("Range"), recording.size)
        except ValueError:
            return Response(status=416, headers={"Content-Range": f"bytes */{recording.size}"})
        storage = recording_storage()
        try:
            obj = storage.s3_client.get_object(
                Bucket=storage.aws_storage_bucket_name,
                Key=recording.object_key,
                Range=f"bytes={start}-{end}",
            )
        except STORAGE_ERRORS as exc:
            return storage_failure(exc)

        def chunks():
            try:
                yield from obj["Body"].iter_chunks(chunk_size=64 * 1024)
            except STORAGE_ERRORS as exc:
                log_exception(exc)
                raise
            finally:
                obj["Body"].close()

        response = StreamingHttpResponse(chunks(), status=206 if partial else 200, content_type=recording.content_type)
        response["Content-Length"] = end - start + 1
        response["Accept-Ranges"] = "bytes"
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        if partial:
            response["Content-Range"] = f"bytes {start}-{end}/{recording.size}"
        return response
