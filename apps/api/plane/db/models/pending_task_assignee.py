from django.db import models
from django.conf import settings

from .base import BaseModel


class PendingTaskAssignee(BaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="pending_assignees")
    invitation = models.ForeignKey("db.ProjectMemberInvite", on_delete=models.CASCADE, related_name="task_assignments")
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pending_task_invitations"
    )

    class Meta:
        db_table = "pending_task_assignees"
        constraints = [
            models.UniqueConstraint(fields=["issue", "invitation"], name="pending_task_assignee_unique_invitation")
        ]
