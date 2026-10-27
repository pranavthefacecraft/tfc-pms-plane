from django.db import migrations, models


def create_default_sections(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    Section = apps.get_model("db", "Section")
    Issue = apps.get_model("db", "Issue")
    DraftIssue = apps.get_model("db", "DraftIssue")
    alias = schema_editor.connection.alias
    for project in Project.objects.using(alias).filter(deleted_at__isnull=True).iterator():
        section, _ = Section.objects.using(alias).get_or_create(
            project_id=project.id,
            is_default=True,
            deleted_at__isnull=True,
            defaults={
                "workspace_id": project.workspace_id,
                "name": "Untitled section",
                "sort_order": 0,
            },
        )
        Issue._base_manager.using(alias).filter(project_id=project.id, section_id__isnull=True).update(
            section_id=section.id
        )
        DraftIssue._base_manager.using(alias).filter(project_id=project.id, section_id__isnull=True).update(
            section_id=section.id
        )


class Migration(migrations.Migration):
    dependencies = [("db", "0132_section_icons")]

    operations = [
        migrations.AddField(
            model_name="section",
            name="is_default",
            field=models.BooleanField(default=False),
        ),
        migrations.AddConstraint(
            model_name="section",
            constraint=models.UniqueConstraint(
                fields=("project",),
                condition=models.Q(is_default=True, deleted_at__isnull=True),
                name="one_active_default_section_per_project",
            ),
        ),
        migrations.RunPython(create_default_sections, migrations.RunPython.noop),
    ]
