from importlib import import_module
from uuid import uuid4

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import override_settings
from django.utils import timezone

from plane.api.serializers.issue import IssueSerializer as ExternalIssueSerializer
from plane.app.serializers.draft import DraftIssueCreateSerializer
from plane.app.serializers.issue import IssueCreateSerializer
from plane.db.models import DraftIssue, Issue, Project, ProjectMember, Section


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name=f"Default {uuid4().hex[:8]}", identifier="DEFAULT", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    return project


@pytest.mark.contract
@pytest.mark.django_db
def test_default_section_is_real_editable_and_deletable(session_client, project, workspace, monkeypatch):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", lambda *args, **kwargs: None)
    default = Section.objects.get(project=project, is_default=True)
    assert default.name == "Untitled section"
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/sections/"
    response = session_client.get(url)
    assert [str(section["id"]) for section in response.data] == [str(default.id)]
    response = session_client.patch(
        f"{url}{default.id}/", {"name": "Planning", "icon": "palette", "icon_color": "#ff0088"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["name"] == "Planning"
    assert response.data["icon"] == "palette"
    assert response.data["icon_color"] == "#ff0088"
    assert response.data["is_default"] is True
    issue = Issue.objects.create(project=project, workspace=workspace, name="Keep task", section=default)
    draft = DraftIssue.objects.create(project=project, workspace=workspace, name="Keep draft", section=default)
    state_id = issue.state_id
    assert session_client.delete(f"{url}{default.id}/").status_code == 204
    issue.refresh_from_db()
    draft.refresh_from_db()
    assert issue.section_id is None
    assert draft.section_id is None
    assert issue.state_id == state_id
    assert session_client.get(url).data == []
    assert not Section.objects.filter(project=project, is_default=True).exists()


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize(
    "serializer_class", [IssueCreateSerializer, ExternalIssueSerializer, DraftIssueCreateSerializer]
)
def test_new_tasks_use_default_but_explicit_null_and_other_sections_are_preserved(project, workspace, serializer_class):
    default = Section.objects.get(project=project, is_default=True)
    other = Section.objects.create(project=project, workspace=workspace, name="Other")
    context = {"project_id": project.id, "workspace_id": workspace.id, "default_assignee_id": None}
    for data, expected in [({}, default.id), ({"section_id": None}, None), ({"section_id": str(other.id)}, other.id)]:
        serializer = serializer_class(data={"name": "Task", **data}, context=context)
        assert serializer.is_valid(), serializer.errors
        issue = serializer.save()
        assert issue.section_id == expected
    Section.objects.filter(id=default.id).update(deleted_at=timezone.now())
    serializer = serializer_class(data={"name": "No default"}, context=context)
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().section_id is None


@pytest.mark.contract
@pytest.mark.django_db
def test_migration_assigns_legacy_tasks_and_drafts_without_changing_status(project, workspace):
    Section.objects.filter(project=project, is_default=True).delete(soft=False)
    assigned_section = Section.objects.create(project=project, workspace=workspace, name="Existing")
    assigned = Issue.objects.create(
        project=project, workspace=workspace, name="Already assigned", section=assigned_section
    )
    active = Issue.objects.create(project=project, workspace=workspace, name="Legacy task")
    archived = Issue.objects.create(
        project=project, workspace=workspace, name="Archived task", archived_at=timezone.now()
    )
    deleted = Issue.objects.create(project=project, workspace=workspace, name="Deleted task", deleted_at=timezone.now())
    draft = DraftIssue.objects.create(project=project, workspace=workspace, name="Legacy draft")
    deleted_draft = DraftIssue.objects.create(
        project=project, workspace=workspace, name="Deleted draft", deleted_at=timezone.now()
    )
    before = {item.id: item.state_id for item in (active, archived, deleted)}
    with override_settings(MIGRATION_MODULES={}):
        apps = MigrationExecutor(connection).loader.project_state([("db", "0133_default_project_sections")]).apps
    migration = import_module("plane.db.migrations.0133_default_project_sections")
    with connection.schema_editor(atomic=False) as schema_editor:
        migration.create_default_sections(apps, schema_editor)
    default = Section.objects.get(project=project, is_default=True)
    for item in (active, archived, deleted, draft, deleted_draft):
        item.refresh_from_db()
        assert item.section_id == default.id
        if item.id in before:
            assert item.state_id == before[item.id]
    assigned.refresh_from_db()
    assert assigned.section_id == assigned_section.id
    assert archived.archived_at is not None
    assert deleted.deleted_at is not None
    assert deleted_draft.deleted_at is not None
