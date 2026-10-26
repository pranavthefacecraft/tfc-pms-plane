from datetime import date
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status

from plane.api.serializers.issue import IssueSerializer as ExternalIssueSerializer
from plane.app.serializers.draft import DraftIssueCreateSerializer
from plane.app.serializers.issue import IssueCreateSerializer
from plane.db.models import (
    DraftIssue,
    Issue,
    Project,
    ProjectMember,
    ProjectUserProperty,
    Section,
    User,
    WorkspaceMember,
)
from plane.db.models.issue import get_default_display_filters
from plane.db.models.project import get_default_props
from plane.utils.grouper import issue_group_values
from plane.utils.issue_filters import issue_filters

SECTIONS_URL = "/api/workspaces/{slug}/projects/{project_id}/sections/"
ISSUES_URL = "/api/workspaces/{slug}/projects/{project_id}/issues/"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name=f"Section Project {uuid4().hex[:8]}",
        identifier=f"SP{uuid4().hex[:6]}",
        workspace=workspace,
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


@pytest.fixture
def another_project(db, workspace, create_user):
    project = Project.objects.create(
        name=f"Other Section Project {uuid4().hex[:8]}",
        identifier=f"OP{uuid4().hex[:6]}",
        workspace=workspace,
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


def _sections_url(workspace, project):
    return SECTIONS_URL.format(slug=workspace.slug, project_id=project.id)


def _issue(project, workspace, name, section=None, **kwargs):
    return Issue.objects.create(
        name=name,
        project=project,
        workspace=workspace,
        section=section,
        **kwargs,
    )


@pytest.mark.contract
@pytest.mark.django_db
def test_section_crud_is_project_scoped_and_returns_section_fields(
    session_client, workspace, project, another_project
):
    collection_url = _sections_url(workspace, project)
    other_section = Section.objects.create(name="Other", project=another_project, workspace=workspace)

    response = session_client.post(collection_url, {"name": "Planning", "sort_order": 10}, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    section_id = response.data["id"]
    assert response.data == {"id": section_id, "name": "Planning", "sort_order": 10.0}
    assert (
        session_client.post(collection_url, {"name": "x" * 101}, format="json").status_code
        == status.HTTP_400_BAD_REQUEST
    )

    response = session_client.get(collection_url)
    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.data] == [section_id]

    detail_url = f"{collection_url}{section_id}/"
    response = session_client.patch(detail_url, {"name": "Design", "sort_order": 20}, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"id": section_id, "name": "Design", "sort_order": 20.0}

    other_detail_url = f"{collection_url}{other_section.id}/"
    response = session_client.get(other_detail_url)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert (
        session_client.get(
            f"/api/workspaces/not-{workspace.slug}/projects/{project.id}/sections/{section_id}/"
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )

    response = session_client.delete(detail_url)
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Section.objects.filter(id=section_id).exists()


@pytest.mark.contract
@pytest.mark.django_db
def test_guest_can_read_but_cannot_write_sections(api_client, workspace, project, create_user):
    guest = User.objects.create(
        email=f"section-guest-{uuid4().hex[:8]}@plane.so",
        username=f"section_guest_{uuid4().hex[:8]}",
        first_name="Section",
        last_name="Guest",
    )
    WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
    ProjectMember.objects.create(project=project, member=guest, workspace=workspace, role=5)
    section = Section.objects.create(name="Guest visible", project=project, workspace=workspace)
    api_client.force_authenticate(user=guest)
    collection_url = _sections_url(workspace, project)

    assert api_client.get(collection_url).status_code == status.HTTP_200_OK
    assert api_client.get(f"{collection_url}{section.id}/").status_code == status.HTTP_200_OK
    assert (
        api_client.post(collection_url, {"name": "Forbidden"}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        api_client.patch(f"{collection_url}{section.id}/", {"name": "Forbidden"}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert api_client.delete(f"{collection_url}{section.id}/").status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
@pytest.mark.django_db
def test_project_member_can_create_sections(api_client, workspace, project):
    member = User.objects.create(
        email=f"section-member-{uuid4().hex[:8]}@plane.so",
        username=f"section_member_{uuid4().hex[:8]}",
        first_name="Section",
        last_name="Member",
    )
    WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    ProjectMember.objects.create(project=project, member=member, workspace=workspace, role=15)
    api_client.force_authenticate(user=member)

    response = api_client.post(_sections_url(workspace, project), {"name": "Member section"}, format="json")
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.contract
@pytest.mark.django_db
def test_archived_project_is_read_only_for_sections(session_client, workspace, project):
    section = Section.objects.create(name="Archived project section", project=project, workspace=workspace)
    project.archived_at = timezone.now()
    project.save(update_fields=["archived_at"])
    collection_url = _sections_url(workspace, project)

    assert session_client.get(collection_url).status_code == status.HTTP_200_OK
    assert (
        session_client.post(collection_url, {"name": "No write"}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        session_client.patch(f"{collection_url}{section.id}/", {"sort_order": 5}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert session_client.delete(f"{collection_url}{section.id}/").status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
@pytest.mark.django_db
def test_deleting_section_unassigns_all_issues_and_drafts_without_deleting_them(
    monkeypatch, session_client, workspace, project
):
    monkeypatch.setattr("plane.db.mixins.soft_delete_related_objects.delay", lambda *args, **kwargs: None)
    section = Section.objects.create(name="Remove me", project=project, workspace=workspace)
    active = _issue(project, workspace, "Active", section)
    draft = _issue(project, workspace, "Draft", section, is_draft=True)
    archived = _issue(project, workspace, "Archived", section, archived_at=date.today())
    deleted = _issue(project, workspace, "Soft-deleted", section)
    Issue.all_objects.filter(id=deleted.id).update(deleted_at=timezone.now())
    separate_draft = DraftIssue.objects.create(
        name="Draft model row",
        project=project,
        workspace=workspace,
        section=section,
    )
    deleted_draft = DraftIssue.objects.create(
        name="Deleted draft row",
        project=project,
        workspace=workspace,
        section=section,
    )
    DraftIssue.all_objects.filter(id=deleted_draft.id).update(deleted_at=timezone.now())

    response = session_client.delete(f"{_sections_url(workspace, project)}{section.id}/")
    assert response.status_code == status.HTTP_204_NO_CONTENT

    rows = Issue.all_objects.filter(id__in=[active.id, draft.id, archived.id, deleted.id])
    assert rows.count() == 4
    assert set(rows.values_list("section_id", flat=True)) == {None}
    assert rows.get(id=draft.id).is_draft is True
    assert rows.get(id=archived.id).archived_at == date.today()
    assert rows.get(id=deleted.id).deleted_at is not None
    separate_draft.refresh_from_db()
    assert separate_draft.section_id is None
    deleted_draft.refresh_from_db()
    assert deleted_draft.section_id is None
    assert deleted_draft.deleted_at is not None


@pytest.mark.contract
@pytest.mark.django_db
def test_issue_serializers_reject_cross_project_sections_and_project_moves(
    workspace, project, another_project
):
    foreign_section = Section.objects.create(name="Foreign section", project=another_project, workspace=workspace)
    issue_data = {"name": "Cross-project item", "section_id": str(foreign_section.id)}
    context = {
        "project_id": project.id,
        "workspace_id": workspace.id,
        "default_assignee_id": None,
    }

    for serializer_class in (IssueCreateSerializer, ExternalIssueSerializer):
        serializer = serializer_class(data=issue_data, context=context)
        assert not serializer.is_valid()
        assert "section_id" in serializer.errors

    draft_serializer = DraftIssueCreateSerializer(data=issue_data, context=context)
    assert not draft_serializer.is_valid()
    assert "section_id" in draft_serializer.errors

    section = Section.objects.create(name="Current project section", project=project, workspace=workspace)
    valid_serializer = IssueCreateSerializer(
        data={"name": "Assigned item", "section_id": str(section.id)},
        context=context,
    )
    assert valid_serializer.is_valid(), valid_serializer.errors
    assert valid_serializer.validated_data["section"].id == section.id

    issue = _issue(project, workspace, "Existing item", section)
    assert str(ExternalIssueSerializer(issue).data["section_id"]) == str(section.id)
    move_context = {**context, "project_id": another_project.id}
    for serializer_class in (IssueCreateSerializer, ExternalIssueSerializer):
        serializer = serializer_class(issue, data={"name": "Unmoved item"}, partial=True, context=move_context)
        assert serializer.is_valid(), serializer.errors
    draft_issue = DraftIssue.objects.create(
        name="Draft to move",
        project=project,
        workspace=workspace,
        section=section,
    )
    move_draft_serializer = DraftIssueCreateSerializer(
        draft_issue,
        data={"project": str(another_project.id)},
        partial=True,
        context=move_context,
    )
    assert not move_draft_serializer.is_valid()
    assert "section_id" in move_draft_serializer.errors
    unassign_serializer = IssueCreateSerializer(
        issue,
        data={"section_id": None},
        partial=True,
        context=context,
    )
    assert unassign_serializer.is_valid(), unassign_serializer.errors
    assert unassign_serializer.validated_data["section"] is None


@pytest.mark.contract
@pytest.mark.django_db
def test_section_group_filter_supports_uuid_and_unassigned_values(
    session_client, workspace, project
):
    section = Section.objects.create(name="Grouped section", project=project, workspace=workspace)
    assigned = _issue(project, workspace, "Assigned", section)
    unassigned = _issue(project, workspace, "Unassigned")
    filters = issue_filters({"section": str(section.id)}, "GET")
    assert filters == {"section_id__in": [section.id]}
    assert list(Issue.issue_objects.filter(**filters).values_list("id", flat=True)) == [assigned.id]

    for null_value in ("None", "null"):
        filters = issue_filters({"section": null_value}, "GET")
        assert filters == {"section__isnull": True}
        assert set(Issue.issue_objects.filter(**filters).values_list("id", flat=True)) == {unassigned.id}

        assert {str(group_id) for group_id in issue_group_values("section_id", workspace.slug, project.id)} == {
            str(section.id),
            "None",
        }


@pytest.mark.contract
@pytest.mark.django_db
def test_section_group_pagination_filters_large_group(session_client, workspace, project, monkeypatch):
    monkeypatch.setattr("plane.app.views.issue.base.recent_visited_task.delay", lambda **kwargs: None)
    section = Section.objects.create(name="Page group", project=project, workspace=workspace)
    [_issue(project, workspace, f"Item {index}", section) for index in range(3)]
    _issue(project, workspace, "Other group")
    url = ISSUES_URL.format(slug=workspace.slug, project_id=project.id)

    response = session_client.get(
        url,
        {"group_by": "section_id", "section": str(section.id), "per_page": 1},
    )

    assert response.status_code == status.HTTP_200_OK, getattr(response, "data", None)
    assert response.data["grouped_by"] == "section_id"
    group = response.data["results"][str(section.id)]
    assert len(group["results"]) == 1
    assert group["total_results"] == 3
    assert group["results"][0]["section_id"] == section.id
    assert response.data["next_page_results"] is True

    response = session_client.get(
        url,
        {"group_by": "section_id", "section": "None", "per_page": 1},
    )
    assert response.status_code == status.HTTP_200_OK, getattr(response, "data", None)
    assert response.data["results"]["None"]["results"][0]["section_id"] is None


@pytest.mark.unit
def test_project_display_defaults_group_by_section():
    assert get_default_display_filters()["group_by"] == "section"
    assert get_default_display_filters()["show_empty_groups"] is True
    assert get_default_props()["display_filters"]["group_by"] == "section"
    assert get_default_props()["display_filters"]["show_empty_groups"] is True


@pytest.mark.contract
@pytest.mark.django_db
def test_persisted_project_defaults_use_ui_group_key(project, create_user):
    properties = ProjectUserProperty.objects.get(project=project, user=create_user)
    properties.refresh_from_db()
    assert properties.display_filters["group_by"] == "section"
    assert properties.display_filters["show_empty_groups"] is True
    member = ProjectMember.objects.get(project=project, member=create_user)
    assert member.view_props["display_filters"]["group_by"] == "section"
    properties.display_filters["group_by"] = "priority"
    properties.save()
    properties.refresh_from_db()
    assert properties.display_filters["group_by"] == "priority"


@pytest.mark.contract
@pytest.mark.django_db
def test_issue_create_and_update_endpoints_accept_section_id(
    session_client, workspace, project, another_project, monkeypatch
):
    for task_name in (
        "issue_activity",
        "model_activity",
        "issue_description_version_task",
        "recent_visited_task",
    ):
        monkeypatch.setattr(f"plane.app.views.issue.base.{task_name}.delay", lambda *args, **kwargs: None)
    section = Section.objects.create(name="Endpoint section", project=project, workspace=workspace)
    other = Section.objects.create(name="Another section", project=project, workspace=workspace)
    foreign = Section.objects.create(name="Foreign", project=another_project, workspace=workspace)
    url = ISSUES_URL.format(slug=workspace.slug, project_id=project.id)
    response = session_client.post(
        url, {"name": "API assigned issue", "section_id": str(section.id)}, format="json"
    )
    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert str(response.data["section_id"]) == str(section.id)
    issue = Issue.objects.get(id=response.data["id"])
    original_state = issue.state_id
    detail_url = f"{url}{issue.id}/"

    for section_id in (other.id, None):
        response = session_client.patch(
            detail_url, {"section_id": str(section_id) if section_id else None}, format="json"
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT, getattr(response, "data", None)
        issue.refresh_from_db()
        assert issue.section_id == section_id
        assert issue.state_id == original_state
        detail = session_client.get(detail_url)
        assert detail.status_code == status.HTTP_200_OK, detail.data
        assert detail.data["section_id"] == (str(section_id) if section_id else None)

    response = session_client.patch(detail_url, {"section_id": str(foreign.id)}, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST, response.data
    assert "section_id" in response.data
    response = session_client.post(
        url, {"name": "Invalid assignment", "section_id": str(foreign.id)}, format="json"
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST, response.data
