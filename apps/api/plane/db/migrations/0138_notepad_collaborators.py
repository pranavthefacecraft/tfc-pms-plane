from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("db", "0137_workspace_company_profile")]
    operations = [
        migrations.AddField(
            model_name="page", name="notepad_collaborators", field=models.JSONField(default=list, blank=True)
        ),
        migrations.AddField(
            model_name="page", name="notepad_invitations", field=models.JSONField(default=dict, blank=True)
        ),
    ]
