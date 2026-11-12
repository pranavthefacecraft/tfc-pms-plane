from django.conf import settings
from django.db import models

from .base import BaseModel


class Recording(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="recordings")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recordings")
    viewers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="shared_recordings", blank=True)
    name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveBigIntegerField()
    duration_ms = models.PositiveIntegerField()
    object_key = models.CharField(max_length=800)
    upload_id = models.TextField(blank=True)
    ready = models.BooleanField(default=False)
    issue_links = models.ManyToManyField("db.IssueLink", related_name="recordings", blank=True)

    class Meta:
        db_table = "recordings"
        ordering = ("-created_at", "-id")
