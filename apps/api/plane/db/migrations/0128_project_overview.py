# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0127_whiteboard_collaboration")]

    operations = [
        migrations.AddField(
            model_name="project",
            name="health",
            field=models.CharField(
                max_length=16,
                choices=[("on_track", "On track"), ("at_risk", "At risk"), ("off_track", "Off track")],
                blank=True,
                default="",
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="overview_resources",
            field=models.JSONField(default=list, blank=True),
        ),
    ]
