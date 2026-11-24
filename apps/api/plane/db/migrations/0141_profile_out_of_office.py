from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0140_personal_stages_pending_assignees"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="out_of_office",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
    ]
