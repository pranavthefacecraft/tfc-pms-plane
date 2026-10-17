# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0126_project_custom_fields")]

    operations = [
        migrations.AddField("page", "whiteboard_roles", models.JSONField(default=dict, blank=True)),
        migrations.AddField("page", "whiteboard_session", models.JSONField(default=dict, blank=True)),
        migrations.AddField("page", "whiteboard_revision", models.PositiveBigIntegerField(default=0)),
    ]
