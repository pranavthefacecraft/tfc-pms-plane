from django.conf import settings
from django.db import models

from .base import BaseModel
from .issue import Issue


class PersonalTask(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="personal_tasks")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="personal_tasks")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    priority = models.CharField(max_length=30, choices=Issue.PRIORITY_CHOICES, default="none")
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    moved_at = models.DateTimeField(null=True, blank=True)
    moved_issue = models.ForeignKey("db.Issue", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    share_token = models.UUIDField(null=True, blank=True, unique=True, editable=False)

    class Meta:
        db_table = "personal_tasks"
        ordering = ("-created_at", "-id")
