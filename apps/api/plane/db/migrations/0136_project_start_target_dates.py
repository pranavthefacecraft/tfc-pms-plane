from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0135_personal_task_sharing"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="project",
            name="target_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
