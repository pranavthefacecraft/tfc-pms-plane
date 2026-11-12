from io import BytesIO
from datetime import timedelta
import json
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import ClientError
from botocore.response import StreamingBody
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework.test import APIClient

from plane.app.views.workspace import recording as views
from plane.db.management.commands import cleanup_recordings, prepare_recordings
from plane.db.models import Recording, User, WorkspaceMember
from plane.tests.contract.app.test_pms_search_app import make_issue, make_project

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def url(workspace, pk=None, suffix=""):
    return f"/api/workspaces/{workspace.slug}/recordings/{str(pk) + '/' if pk else ''}{suffix}"


def make_recording(workspace, owner, **kwargs):
    return Recording.objects.create(
        workspace=workspace,
        owner=owner,
        name="Walkthrough",
        content_type="video/webm",
        size=kwargs.pop("size", 12),
        duration_ms=1000,
        object_key=f"recordings/{uuid4()}",
        upload_id="upload-1",
        **kwargs,
    )


@pytest.fixture
def storage(monkeypatch):
    storage = MagicMock()
    storage.aws_storage_bucket_name = "private-recordings"
    storage.s3_client.create_multipart_upload.return_value = {"UploadId": "upload-1"}
    monkeypatch.setattr(views, "recording_storage", lambda: storage)
    return storage


@pytest.fixture
def teammate(workspace):
    user = User.objects.create(email=f"{uuid4()}@example.test", username=uuid4().hex)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


def test_private_shared_and_revoked_access(session_client, workspace, create_user, teammate, storage):
    private = make_recording(workspace, teammate, ready=True)
    shared = make_recording(workspace, teammate, ready=True)
    shared.viewers.add(create_user)
    own = make_recording(workspace, create_user, ready=True)
    response = session_client.get(url(workspace))
    assert response.status_code == 200
    assert {item["id"] for item in response.data["results"]} == {str(shared.id), str(own.id)}
    assert not any("object_key" in item or "upload_id" in item for item in response.data["results"])
    assert session_client.get(url(workspace, private.id)).status_code == 404
    assert session_client.get(url(workspace, private.id, "playback/")).status_code == 404
    assert session_client.delete(url(workspace, shared.id)).status_code == 404
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
    assert session_client.get(url(workspace, shared.id, "playback/")).status_code == 403
    assert not storage.s3_client.get_object.called


def test_sharing_owner_only_and_active_workspace_humans(session_client, workspace, create_user, teammate):
    row = make_recording(workspace, create_user, ready=True)
    response = session_client.put(url(workspace, row.id, "share/"), {"user_ids": [str(teammate.id)]}, format="json")
    assert response.status_code == 200
    assert response.data["viewer_ids"] == [str(teammate.id)]
    external = User.objects.create(email="external-recorder@example.test", username=uuid4().hex)
    for user in (external,):
        assert (
            session_client.put(
                url(workspace, row.id, "share/"), {"user_ids": [str(user.id)]}, format="json"
            ).status_code
            == 400
        )
    teammate.is_bot = True
    teammate.save()
    assert (
        session_client.put(
            url(workspace, row.id, "share/"), {"user_ids": [str(teammate.id)]}, format="json"
        ).status_code
        == 400
    )
    teammate.is_bot = False
    teammate.save()
    WorkspaceMember.objects.filter(workspace=workspace, member=teammate).update(is_active=False)
    assert (
        session_client.put(
            url(workspace, row.id, "share/"), {"user_ids": [str(teammate.id)]}, format="json"
        ).status_code
        == 400
    )
    assert session_client.put(url(workspace, row.id, "share/"), {"user_ids": []}, format="json").status_code == 200
    assert row.viewers.count() == 0


@pytest.mark.parametrize(
    "field,value,expected",
    [
        ("size", views.MAX_SIZE, 201),
        ("size", views.MAX_SIZE + 1, 400),
        ("size", 0, 400),
        ("duration_ms", views.MAX_DURATION_MS, 201),
        ("duration_ms", views.MAX_DURATION_MS + 1, 400),
        ("duration_ms", 0, 400),
        ("content_type", "text/html", 400),
    ],
)
def test_upload_limits(session_client, workspace, field, value, expected, storage):
    data = {"name": "Test", "content_type": "video/webm", "size": 12, "duration_ms": 1000, field: value}
    assert session_client.post(url(workspace), data, format="json").status_code == expected


def test_raw_parts_validate_exact_size_header_and_owner(session_client, workspace, create_user, teammate, storage):
    row = make_recording(workspace, create_user)
    payload = b"\x1a\x45\xdf\xa3" + b"x" * 8
    headers = {
        "content_type": "application/octet-stream",
        "HTTP_CONTENT_DISPOSITION": 'attachment; filename="part.bin"',
    }
    endpoint = url(workspace, row.id, "parts/1/")
    assert session_client.put(endpoint, payload, **headers).status_code == 200
    assert storage.s3_client.upload_part.call_args.kwargs["Body"].size == 12
    assert session_client.put(endpoint, b"x" * 12, **headers).status_code == 400
    assert session_client.put(endpoint, payload[:-1], **headers).status_code == 400
    assert session_client.put(url(workspace, row.id, "parts/2/"), payload, **headers).status_code == 400
    row.owner = teammate
    row.save()
    assert session_client.put(endpoint, payload, **headers).status_code == 404


def test_complete_verifies_parts_and_is_retryable(session_client, workspace, create_user, storage):
    row = make_recording(workspace, create_user, size=views.PART_SIZE + 12)
    endpoint = url(workspace, row.id, "complete/")
    storage.s3_client.list_parts.return_value = {"Parts": [{"PartNumber": 1, "Size": views.PART_SIZE, "ETag": "one"}]}
    assert session_client.post(endpoint).status_code == 400
    storage.s3_client.list_parts.return_value["Parts"].append({"PartNumber": 2, "Size": 12, "ETag": "two"})
    assert session_client.post(endpoint).status_code == 200
    assert session_client.post(endpoint).status_code == 200
    assert storage.s3_client.complete_multipart_upload.call_count == 1


def test_complete_recovers_after_storage_completed_but_database_did_not(
    session_client, workspace, create_user, storage
):
    row = make_recording(workspace, create_user)
    storage.s3_client.list_parts.side_effect = ClientError({"Error": {"Code": "NoSuchUpload"}}, "ListParts")
    storage.s3_client.head_object.return_value = {"ContentLength": row.size, "ContentType": row.content_type}
    assert session_client.post(url(workspace, row.id, "complete/")).status_code == 200
    row.refresh_from_db()
    assert row.ready and not row.upload_id


def test_delete_recovers_an_expired_upload_and_is_retryable(session_client, workspace, create_user, storage):
    row = make_recording(workspace, create_user)
    storage.s3_client.abort_multipart_upload.side_effect = ClientError(
        {"Error": {"Code": "NoSuchUpload"}}, "AbortMultipartUpload"
    )
    endpoint = url(workspace, row.id)
    assert session_client.delete(endpoint).status_code == 204
    assert session_client.delete(endpoint).status_code == 204
    assert not Recording.objects.filter(pk=row.id).exists()
    assert storage.s3_client.delete_object.call_count == 1


@pytest.mark.parametrize("method,suffix", [("post", "complete/"), ("get", "playback/"), ("delete", "")])
def test_storage_failure_is_explicit(session_client, workspace, create_user, storage, method, suffix):
    row = make_recording(workspace, create_user, ready=method == "get")
    for operation in ("list_parts", "get_object", "abort_multipart_upload"):
        getattr(storage.s3_client, operation).side_effect = ClientError({"Error": {"Code": "Unavailable"}}, operation)
    assert getattr(session_client, method)(url(workspace, row.id, suffix)).status_code == 502
    assert Recording.objects.filter(pk=row.id).exists()


@pytest.mark.parametrize(
    "header,expected,body",
    [
        ("bytes=2-4", "bytes 2-4/12", b"234"),
        ("bytes=9-", "bytes 9-11/12", b"901"),
        ("bytes=-3", "bytes 9-11/12", b"901"),
    ],
)
def test_private_range_playback(session_client, workspace, create_user, storage, header, expected, body):
    row = make_recording(workspace, create_user, ready=True)
    stream = StreamingBody(BytesIO(body), len(body))
    storage.s3_client.get_object.return_value = {"Body": stream}
    response = session_client.get(url(workspace, row.id, "playback/"), HTTP_RANGE=header)
    assert response.status_code == 206
    assert response["Content-Range"] == expected
    assert response["Cache-Control"] == "private, no-store"
    assert b"".join(response.streaming_content) == body
    assert stream._raw_stream.closed


@pytest.mark.parametrize("header", ["bytes=12-", "bytes=4-2", "bytes=-0", "bytes=0-1,2-3", "bytes=" + "9" * 5000 + "-"])
def test_unsatisfiable_range_never_reads_storage(session_client, workspace, create_user, storage, header):
    row = make_recording(workspace, create_user, ready=True)
    response = session_client.get(url(workspace, row.id, "playback/"), HTTP_RANGE=header)
    assert response.status_code == 416
    assert response["Content-Range"] == "bytes */12"
    assert not storage.s3_client.get_object.called


def test_task_link_requires_write_permission_and_does_not_share(session_client, workspace, create_user, teammate):
    row = make_recording(workspace, create_user, ready=True)
    project, state = make_project(workspace, create_user)
    issue = make_issue(project, state, create_user)
    endpoint = url(workspace, row.id, "attach/")
    assert session_client.post(endpoint, {"issue_id": str(issue.id)}, format="json").status_code == 201
    assert session_client.post(endpoint, {"issue_id": str(issue.id)}, format="json").status_code == 201
    assert row.issue_links.count() == 1
    assert row.viewers.count() == 0
    private_project, state = make_project(workspace, teammate)
    hidden = make_issue(private_project, state, teammate)
    assert session_client.post(endpoint, {"issue_id": str(hidden.id)}, format="json").status_code == 404


def test_anonymous_bot_and_guest_upload_permissions(session_client, workspace, create_user, storage):
    assert APIClient().get(url(workspace)).status_code == 401
    create_user.is_bot = True
    create_user.save()
    assert session_client.get(url(workspace)).status_code == 403
    create_user.is_bot = False
    create_user.save()
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
    assert session_client.get(url(workspace)).status_code == 200
    assert session_client.post(url(workspace), {}, format="json").status_code == 403


def test_global_search_includes_only_ready_accessible_recordings(session_client, workspace, create_user, teammate):
    own = make_recording(workspace, create_user, ready=True)
    shared = make_recording(workspace, teammate, ready=True)
    shared.viewers.add(create_user)
    make_recording(workspace, teammate, ready=True)
    make_recording(workspace, create_user, ready=False)
    response = session_client.get("/api/search/pms/", {"search": "Walkthrough", "category": "files"})
    assert response.status_code == 200
    assert {item["id"] for item in response.data["results"]} == {str(own.id), str(shared.id)}
    assert all(item["detail"] == "Recording" for item in response.data["results"])
    response = session_client.get("/api/search/pms/", {"search": "recorder", "category": "navigation"})
    assert any(item["href"] == f"/{workspace.slug}/tool/recorder" for item in response.data["results"])


@pytest.mark.parametrize("public_policy", [True, False])
def test_preparation_rejects_public_storage(storage, monkeypatch, public_policy):
    monkeypatch.setattr(prepare_recordings, "recording_storage", lambda: storage)
    if public_policy:
        storage.s3_client.get_bucket_policy.return_value = {
            "Policy": json.dumps({"Statement": [{"Effect": "Allow", "Principal": "*", "Action": "s3:GetObject"}]})
        }
    else:
        storage.s3_client.get_bucket_policy.side_effect = ClientError(
            {"Error": {"Code": "NoSuchBucketPolicy"}}, "GetBucketPolicy"
        )
        storage.s3_client.get_bucket_acl.return_value = {
            "Grants": [{"Grantee": {"URI": "http://acs.amazonaws.com/groups/global/AllUsers"}}]
        }
    with pytest.raises(CommandError):
        call_command("prepare_recordings")


def test_cleanup_preserves_fresh_and_ready_recordings_and_aborts_orphans(workspace, create_user, storage, monkeypatch):
    monkeypatch.setattr(cleanup_recordings, "recording_storage", lambda: storage)
    old = make_recording(workspace, create_user)
    fresh = make_recording(workspace, create_user)
    ready = make_recording(workspace, create_user, ready=True)
    yesterday = timezone.now() - timedelta(days=2)
    Recording.objects.filter(pk__in=[old.id, ready.id]).update(created_at=yesterday)
    storage.s3_client.get_paginator.return_value.paginate.return_value = [
        {"Uploads": [{"Initiated": yesterday, "Key": "recordings/orphan", "UploadId": "orphan"}]}
    ]
    call_command("cleanup_recordings")
    assert not Recording.objects.filter(pk=old.id).exists()
    assert Recording.objects.filter(pk=fresh.id).exists()
    assert Recording.objects.filter(pk=ready.id).exists()
    assert storage.s3_client.abort_multipart_upload.call_count == 2


def test_real_private_minio_multipart_and_range(session_client, workspace, create_user, monkeypatch):
    monkeypatch.setenv("RECORDINGS_BUCKET_NAME", f"recorder-test-{uuid4().hex}")
    call_command("prepare_recordings")
    storage = views.recording_storage()
    client, bucket = storage.s3_client, storage.aws_storage_bucket_name
    pk = None
    try:
        data = b"\x1a\x45\xdf\xa3" + b"x" * (views.PART_SIZE + 12 - 4)
        response = session_client.post(
            url(workspace),
            {"name": "Real upload", "size": len(data), "content_type": "video/webm", "duration_ms": 1000},
            format="json",
        )
        assert response.status_code == 201
        pk = response.data["id"]
        headers = {
            "content_type": "application/octet-stream",
            "HTTP_CONTENT_DISPOSITION": 'attachment; filename="part.bin"',
        }
        for part, body in enumerate((data[: views.PART_SIZE], data[views.PART_SIZE :]), 1):
            assert session_client.put(url(workspace, pk, f"parts/{part}/"), body, **headers).status_code == 200
        assert session_client.post(url(workspace, pk, "complete/")).status_code == 200
        response = session_client.get(url(workspace, pk, "playback/"), HTTP_RANGE="bytes=0-31")
        assert response.status_code == 206
        assert b"".join(response.streaming_content) == data[:32]
        import boto3

        anonymous = boto3.client("s3", endpoint_url=client.meta.endpoint_url, config=Config(signature_version=UNSIGNED))
        with pytest.raises(ClientError) as denied:
            anonymous.get_object(Bucket=bucket, Key=Recording.objects.get(pk=pk).object_key)
        assert denied.value.response["ResponseMetadata"]["HTTPStatusCode"] == 403
        assert session_client.delete(url(workspace, pk)).status_code == 204
        pk = None
    finally:
        if pk:
            row = Recording.objects.get(pk=pk)
            views.delete_recording_object(storage, row)
        client.delete_bucket(Bucket=bucket)
