from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0131_project_sections")]

    operations = [
        migrations.AddField(
            model_name="section",
            name="icon",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="section",
            name="icon_color",
            field=models.CharField(default="#6d7b8a", max_length=7),
        ),
    ]
