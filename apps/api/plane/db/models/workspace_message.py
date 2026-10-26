# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from .base import BaseModel


class WorkspaceMessage(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="sent_workspace_messages")
    subject = models.CharField(max_length=255)
    body = models.TextField()

    class Meta:
        db_table = "workspace_messages"
        ordering = ("-created_at",)


class WorkspaceMessageRecipient(BaseModel):
    message = models.ForeignKey(WorkspaceMessage, on_delete=models.CASCADE, related_name="recipients")
    recipient = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="workspace_message_deliveries")
    notification = models.OneToOneField(
        "db.Notification", on_delete=models.SET_NULL, null=True, related_name="workspace_message_delivery"
    )
    email_sent_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "workspace_message_recipients"
        constraints = [
            models.UniqueConstraint(fields=["message", "recipient"], name="unique_workspace_message_recipient")
        ]
