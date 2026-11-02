# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for project start/due dates and project file attachments."""

from datetime import date
from unittest import mock

import pytest
from rest_framework import status

from plane.db.models import FileAsset, Project, ProjectMember

S3_STORAGE_PATH = "plane.app.views.asset.v2.S3Storage"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Dated", identifier="DTD", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


@pytest.mark.contract
class TestProjectDates:
    @pytest.mark.django_db
    def test_create_project_with_dates(self, session_client, workspace):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/",
            {"name": "Launch", "identifier": "LCH", "start_date": "2026-11-01", "target_date": "2026-11-30"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["start_date"] == "2026-11-01"
        assert response.data["target_date"] == "2026-11-30"
        project = Project.objects.get(identifier="LCH")
        assert project.start_date == date(2026, 11, 1)
        assert project.target_date == date(2026, 11, 30)

    @pytest.mark.django_db
    def test_create_project_rejects_due_before_start(self, session_client, workspace):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/",
            {"name": "Backwards", "identifier": "BWD", "start_date": "2026-11-30", "target_date": "2026-11-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "target_date" in response.data
        assert not Project.objects.filter(identifier="BWD").exists()

    @pytest.mark.django_db
    def test_update_due_date_validates_against_saved_start(self, session_client, workspace, project):
        project.start_date = date(2026, 11, 10)
        project.save(update_fields=["start_date"])
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
        response = session_client.patch(url, {"target_date": "2026-11-01"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        response = session_client.patch(url, {"target_date": "2026-11-20"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.target_date == date(2026, 11, 20)


@pytest.mark.contract
class TestProjectAttachmentUpload:
    def url(self, workspace, project):
        return f"/api/assets/v2/workspaces/{workspace.slug}/projects/{project.id}/"

    @pytest.mark.django_db
    @mock.patch(S3_STORAGE_PATH)
    def test_project_attachment_accepts_documents(self, storage, session_client, workspace, project):
        storage.return_value.generate_presigned_post.return_value = {"url": "https://s3.test", "fields": {}}
        response = session_client.post(
            self.url(workspace, project),
            {
                "name": "brief.pdf",
                "type": "application/pdf",
                "size": 1024,
                "entity_type": "PROJECT_ATTACHMENT",
                "entity_identifier": str(project.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        asset = FileAsset.objects.get(id=response.data["asset_id"])
        assert asset.entity_type == FileAsset.EntityTypeContext.PROJECT_ATTACHMENT
        assert asset.project_id == project.id

    @pytest.mark.django_db
    @mock.patch(S3_STORAGE_PATH)
    def test_project_attachment_rejects_unknown_types(self, storage, session_client, workspace, project):
        response = session_client.post(
            self.url(workspace, project),
            {
                "name": "run.exe",
                "type": "application/x-msdownload",
                "size": 1024,
                "entity_type": "PROJECT_ATTACHMENT",
                "entity_identifier": str(project.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not FileAsset.objects.filter(entity_type="PROJECT_ATTACHMENT").exists()

    @pytest.mark.django_db
    @mock.patch(S3_STORAGE_PATH)
    def test_project_cover_still_requires_images(self, storage, session_client, workspace, project):
        response = session_client.post(
            self.url(workspace, project),
            {
                "name": "brief.pdf",
                "type": "application/pdf",
                "size": 1024,
                "entity_type": "PROJECT_COVER",
                "entity_identifier": str(project.id),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
