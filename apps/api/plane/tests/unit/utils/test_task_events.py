# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from time import monotonic
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from django.db import transaction
from redis.exceptions import ConnectionError

from plane.db.models import FileAsset, Issue, IssueComment, Project, ProjectMember, User, Workspace, WorkspaceMember
from plane.settings.redis import redis_instance
from plane.utils.task_events import publish_task_update


pytestmark = [pytest.mark.unit, pytest.mark.django_db]


def test_publishes_only_after_commit(django_capture_on_commit_callbacks):
    workspace_id = uuid4()
    with patch("plane.utils.task_events._publisher") as publisher:
        with django_capture_on_commit_callbacks(execute=True):
            publish_task_update(workspace_id)
            publisher.assert_not_called()
        publisher.return_value.publish.assert_called_once_with(f"plane:task-updates:{workspace_id}", "invalidate")


def test_rolled_back_changes_are_not_announced():
    with patch("plane.utils.task_events._publisher") as publisher:
        with pytest.raises(ValueError), transaction.atomic():
            publish_task_update(uuid4())
            raise ValueError("Rollback")
        publisher.assert_not_called()


def test_redis_failure_is_logged_without_undoing_a_committed_save(django_capture_on_commit_callbacks):
    with (
        patch("plane.utils.task_events._publisher") as publisher,
        patch("plane.utils.task_events.log_exception") as log,
        django_capture_on_commit_callbacks(execute=True),
    ):
        publisher.return_value.publish.side_effect = ConnectionError("Offline")
        publish_task_update(uuid4())
    log.assert_called_once()


@pytest.mark.parametrize("model_name", ["Issue", "IssueComment", "CommentReaction", "IssueCustomFieldValue"])
def test_task_models_have_registered_receivers(model_name):
    from django.apps import apps
    from django.db.models.signals import post_save

    model = apps.get_model("db", model_name)
    assert post_save.has_listeners(model)


def test_non_task_assets_do_not_publish():
    from plane.db.task_events import task_changed

    with patch("plane.db.task_events.publish_task_update") as publish:
        task_changed(FileAsset, Mock(issue_id=None, comment_id=None), "default")
        publish.assert_not_called()


def test_two_subscribers_receive_committed_task_comment_and_upload_updates(
    create_user, django_capture_on_commit_callbacks
):
    workspace = Workspace.objects.create(name="Live tests", slug=f"live-{uuid4().hex}", owner=create_user)
    project = Project.objects.create(name="Live project", identifier="LIVE", workspace=workspace)
    channel = f"plane:task-updates:{workspace.id}"
    redis = redis_instance()
    first, second, other = (redis.pubsub() for _ in range(3))
    try:
        first.subscribe(channel)
        second.subscribe(channel)
        other.subscribe(f"plane:task-updates:{uuid4()}")
        for subscriber in (first, second, other):
            assert subscriber.get_message(timeout=2)["type"] == "subscribe"

        def verify(operation):
            start = monotonic()
            with django_capture_on_commit_callbacks(execute=True):
                operation()
            for subscriber in (first, second):
                message = subscriber.get_message(timeout=2)
                assert message and message["data"] == b"invalidate"
                assert message["channel"] == channel.encode()
            assert monotonic() - start < 1
            assert other.get_message(timeout=0.05) is None
            for subscriber in (first, second):
                while subscriber.get_message(timeout=0.01):
                    pass

        issue = Issue.objects.create(name="Live task", project=project, workspace=workspace)
        verify(lambda: Issue.objects.filter(pk=issue.id).get().save())
        verify(
            lambda: IssueComment.objects.create(
                issue=issue, project=project, workspace=workspace, comment_html="<p>Instant comment</p>"
            )
        )
        verify(
            lambda: FileAsset.objects.create(
                issue=issue,
                project=project,
                workspace=workspace,
                entity_type="ISSUE_ATTACHMENT",
                is_uploaded=True,
                asset="test.txt",
            )
        )
        issue.description_html = "<p>Instant description</p>"
        verify(issue.save)
    finally:
        for subscriber in (first, second, other):
            subscriber.close()
        redis.close()


def test_two_users_receive_rest_comment_edits_without_waiting_for_the_activity_worker(
    create_user, django_capture_on_commit_callbacks
):
    from rest_framework.test import APIClient

    workspace = Workspace.objects.create(name="Live API", slug=f"live-api-{uuid4().hex}", owner=create_user)
    project = Project.objects.create(name="Live API project", identifier="LAPI", workspace=workspace)
    second_user = User.objects.create(email=f"live-{uuid4().hex}@example.test", username=f"live-{uuid4().hex}")
    for user, role in ((create_user, 20), (second_user, 15)):
        WorkspaceMember.objects.get_or_create(workspace=workspace, member=user, defaults={"role": role})
        ProjectMember.objects.create(project=project, workspace=workspace, member=user, role=role)
    issue = Issue.objects.create(name="Live API task", project=project, workspace=workspace)
    first, second = APIClient(), APIClient()
    first.force_authenticate(create_user)
    second.force_authenticate(second_user)
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/{issue.id}/comments/"
    redis = redis_instance()
    subscriber = redis.pubsub()
    try:
        subscriber.subscribe(f"plane:task-updates:{workspace.id}")
        assert subscriber.get_message(timeout=2)["type"] == "subscribe"
        assert second.get(url).status_code == 200
        with (
            patch("plane.app.views.issue.comment.issue_activity.delay") as activity,
            patch("plane.app.views.issue.comment.model_activity.delay"),
        ):
            with django_capture_on_commit_callbacks(execute=True):
                response = first.post(url, {"comment_html": "<p>Instant comment</p>"}, format="json")
            assert response.status_code == 201, response.data
            assert subscriber.get_message(timeout=2)["data"] == b"invalidate"
            latest = second.get(url)
            assert latest.status_code == 200
            assert b"Instant comment" in latest.content
            comment_url = f"{url}{response.data['id']}/"
            with django_capture_on_commit_callbacks(execute=True):
                response = first.patch(comment_url, {"comment_html": "<p>Edited live</p>"}, format="json")
            assert response.status_code == 200, response.data
            assert subscriber.get_message(timeout=2)["data"] == b"invalidate"
            assert b"Edited live" in second.get(url).content
            assert activity.call_count == 2
    finally:
        subscriber.close()
        redis.close()
