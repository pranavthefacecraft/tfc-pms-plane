# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from .project import ProjectBaseModel


class ProjectCustomField(ProjectBaseModel):
    FIELD_TYPES = ("single_select", "multi_select", "text", "number", "date")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    field_type = models.CharField(max_length=20, choices=[(key, key) for key in FIELD_TYPES])
    options = models.JSONField(default=list)
    notify_collaborators = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "project_custom_fields"
        ordering = ("sort_order", "created_at", "id")
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "project",
                condition=Q(deleted_at__isnull=True),
                name="project_custom_field_unique_name",
            ),
        ]

    @classmethod
    def create_defaults(cls, project):
        for index, (name, labels) in enumerate(
            (
                ("Stage", ("Concept", "Design", "Copy", "Development", "Testing", "Done")),
                ("Status", ("On Track", "At Risk", "On Hold", "Blocked", "Completed")),
            )
        ):
            colors = ("#16A34A", "#2563EB", "#9333EA", "#D97706", "#DC2626", "#475569")
            cls.objects.create(
                project=project,
                workspace_id=project.workspace_id,
                name=name,
                field_type="single_select",
                sort_order=index,
                options=[
                    {"id": str(uuid.uuid4()), "name": label, "color": colors[i]} for i, label in enumerate(labels)
                ],
            )


class IssueCustomFieldValue(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="custom_field_values")
    field = models.ForeignKey(ProjectCustomField, on_delete=models.CASCADE, related_name="values")
    value = models.JSONField(null=True)

    class Meta:
        db_table = "issue_custom_field_values"
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "field"],
                condition=Q(deleted_at__isnull=True),
                name="issue_custom_field_unique_value",
            ),
        ]
