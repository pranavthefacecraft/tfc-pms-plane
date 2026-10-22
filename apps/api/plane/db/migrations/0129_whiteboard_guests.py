# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0128_project_overview")]

    operations = [
        migrations.AddField(
            model_name="page",
            name="whiteboard_guest_ids",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="page",
            name="whiteboard_guest_role",
            field=models.CharField(
                max_length=8,
                choices=[("disabled", "Disabled"), ("viewer", "Viewer"), ("editor", "Editor")],
                default="disabled",
            ),
        ),
    ]
