# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models.signals import post_delete, post_save

from plane.utils.task_events import publish_task_update


def task_changed(sender, instance, using, **kwargs):
    if sender.__name__ == "FileAsset" and not instance.issue_id and not instance.comment_id:
        return
    publish_task_update(instance.workspace_id, using=using)


def register_task_events(app):
    names = (
        "Issue",
        "IssueComment",
        "CommentReaction",
        "IssueReaction",
        "IssueSubscriber",
        "IssueAttachment",
        "FileAsset",
        "IssueLink",
        "IssueRelation",
        "IssueAssignee",
        "IssueLabel",
        "CycleIssue",
        "ModuleIssue",
        "IssueCustomFieldValue",
        "ProjectCustomField",
    )
    for name in names:
        model = app.get_model(name)
        for signal in (post_save, post_delete):
            signal.connect(
                task_changed,
                sender=model,
                dispatch_uid=f"task_updates.{signal}.{name}",
            )
