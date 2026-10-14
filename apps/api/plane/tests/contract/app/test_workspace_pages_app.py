# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for workspace-level pages (Tool → Pages) and their attachments."""

import uuid

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    Page,
    PageEntityLink,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)


def _pages_url(slug, page_id=None, suffix=""):
    base = f"/api/workspaces/{slug}/workspace-pages/"
    if page_id:
        base = f"{base}{page_id}/"
    return f"{base}{suffix}"


def _make_project(workspace, identifier, member=None):
    project = Project.objects.create(name=f"Project {identifier}", identifier=identifier, workspace=workspace)
    if member:
        ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=20)
    return project


def _make_issue(workspace, project, name="Task"):
    state = State.objects.create(name="Todo", project=project, workspace=workspace, group="unstarted")
    return Issue.objects.create(name=name, project=project, workspace=workspace, state=state)


def _make_other_user(workspace):
    other = User.objects.create(email=f"other-{uuid.uuid4().hex[:6]}@plane.so", username=uuid.uuid4().hex[:10])
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
    return other


@pytest.mark.contract
class TestWorkspacePages:
    @pytest.mark.django_db
    def test_create_and_list_page(self, session_client, workspace, create_user):
        response = session_client.post(_pages_url(workspace.slug), {"name": "Roadmap"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["name"] == "Roadmap"
        assert body["owned_by"] == str(create_user.id)
        assert body["attachment"] is None
        assert Page.objects.get(pk=body["id"]).is_global is True

        listed = session_client.get(_pages_url(workspace.slug)).json()
        assert [p["id"] for p in listed] == [body["id"]]

    @pytest.mark.django_db
    def test_project_pages_are_not_listed(self, session_client, workspace, create_user):
        Page.objects.create(workspace=workspace, owned_by=create_user, name="Project page")

        assert session_client.get(_pages_url(workspace.slug)).json() == []

    @pytest.mark.django_db
    def test_private_page_of_other_user_hidden(self, session_client, workspace):
        other = _make_other_user(workspace)
        page = Page.objects.create(
            workspace=workspace, owned_by=other, name="Secret", access=Page.PRIVATE_ACCESS, is_global=True
        )

        assert session_client.get(_pages_url(workspace.slug)).json() == []
        assert session_client.get(_pages_url(workspace.slug, page.id)).status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_update_description_and_name(self, session_client, workspace, create_user):
        page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Old", is_global=True)

        response = session_client.patch(
            _pages_url(workspace.slug, page.id),
            {"name": "New", "description_html": "<p>Hello</p>"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.name == "New"
        assert page.description_stripped == "Hello"

    @pytest.mark.django_db
    def test_non_owner_cannot_change_access(self, session_client, workspace):
        other = _make_other_user(workspace)
        page = Page.objects.create(workspace=workspace, owned_by=other, name="Shared", is_global=True)

        response = session_client.patch(
            _pages_url(workspace.slug, page.id), {"access": Page.PRIVATE_ACCESS}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_attach_to_issue_replaces_project_attachment(self, session_client, workspace, create_user):
        project = _make_project(workspace, "PRJA", member=create_user)
        issue = _make_issue(workspace, project)
        page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Spec", is_global=True)

        response = session_client.put(
            _pages_url(workspace.slug, page.id, "attachment/"),
            {"entity_type": "project", "entity_id": str(project.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["attachment"]["project_name"] == project.name

        response = session_client.put(
            _pages_url(workspace.slug, page.id, "attachment/"),
            {"entity_type": "issue", "entity_id": str(issue.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        attachment = response.json()["attachment"]
        assert attachment["entity_type"] == "issue"
        assert attachment["issue_id"] == str(issue.id)
        assert PageEntityLink.objects.filter(page=page).count() == 1

        by_issue = session_client.get(_pages_url(workspace.slug), {"issue_id": str(issue.id)}).json()
        assert [p["id"] for p in by_issue] == [str(page.id)]

    @pytest.mark.django_db
    def test_cannot_attach_to_project_without_membership(self, session_client, workspace, create_user):
        project = _make_project(workspace, "PRJB")
        page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Spec", is_global=True)

        response = session_client.put(
            _pages_url(workspace.slug, page.id, "attachment/"),
            {"entity_type": "project", "entity_id": str(project.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not PageEntityLink.objects.filter(page=page).exists()

    @pytest.mark.django_db
    def test_attachment_names_hidden_for_non_members(self, session_client, workspace):
        other = _make_other_user(workspace)
        project = _make_project(workspace, "PRJC", member=other)
        page = Page.objects.create(workspace=workspace, owned_by=other, name="Public", is_global=True)
        PageEntityLink.objects.create(workspace=workspace, page=page, entity_type="project", project=project)

        attachment = session_client.get(_pages_url(workspace.slug)).json()[0]["attachment"]

        assert attachment["is_accessible"] is False
        assert "project_name" not in attachment

    @pytest.mark.django_db
    def test_detach_and_delete(self, session_client, workspace, create_user):
        project = _make_project(workspace, "PRJD", member=create_user)
        page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Spec", is_global=True)
        PageEntityLink.objects.create(workspace=workspace, page=page, entity_type="project", project=project)

        detach = session_client.delete(_pages_url(workspace.slug, page.id, "attachment/"))
        assert detach.status_code == status.HTTP_204_NO_CONTENT
        assert not PageEntityLink.objects.filter(page=page).exists()

        delete = session_client.delete(_pages_url(workspace.slug, page.id))
        assert delete.status_code == status.HTTP_204_NO_CONTENT
        assert not Page.objects.filter(pk=page.id).exists()

    @pytest.mark.django_db
    def test_member_cannot_delete_others_page(self, session_client, workspace, create_user):
        other = _make_other_user(workspace)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
        page = Page.objects.create(workspace=workspace, owned_by=other, name="Theirs", is_global=True)

        response = session_client.delete(_pages_url(workspace.slug, page.id))

        assert response.status_code == status.HTTP_403_FORBIDDEN
