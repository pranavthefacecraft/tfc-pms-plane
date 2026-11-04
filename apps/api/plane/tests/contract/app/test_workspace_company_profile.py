# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Workspace, WorkspaceMember


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceCompanyProfile:
    def test_admin_saves_and_reads_company_details(self, workspace, session_client):
        payload = {
            "name": "Company Test",
            "website": "https://example.com",
            "billing_email": "billing@example.com",
            "timezone": "Asia/Makassar",
            "currency": "IDR",
        }
        response = session_client.patch(f"/api/workspaces/{workspace.slug}/", payload, format="json")
        assert response.status_code == 200
        workspace.refresh_from_db()
        for field, value in payload.items():
            assert getattr(workspace, field) == value
            assert response.data[field] == value
        response = session_client.get("/api/users/me/workspaces/")
        assert response.status_code == 200
        saved = next(item for item in response.data if str(item["id"]) == str(workspace.id))
        for field, value in payload.items():
            assert saved[field] == value

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("website", "javascript:alert(1)"),
            ("website", "ftp://example.com"),
            ("billing_email", "not-an-email"),
            ("currency", "usd"),
            ("currency", "US"),
            ("timezone", "Unknown/Zone"),
            ("name", "---"),
        ],
    )
    def test_rejects_invalid_company_values(self, workspace, session_client, field, value):
        original = getattr(workspace, field)
        response = session_client.patch(f"/api/workspaces/{workspace.slug}/", {field: value}, format="json")
        assert response.status_code == 400
        assert field in response.data
        workspace.refresh_from_db()
        assert getattr(workspace, field) == original

    def test_optional_details_can_be_cleared_without_changing_other_fields(self, workspace, session_client):
        workspace.website = "https://example.com"
        workspace.billing_email = "billing@example.com"
        workspace.currency = "USD"
        workspace.save()
        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/",
            {"website": "", "billing_email": "", "currency": ""},
            format="json",
        )
        assert response.status_code == 200
        workspace.refresh_from_db()
        assert workspace.website == workspace.billing_email == workspace.currency == ""
        assert workspace.name == "Test Workspace"
        assert workspace.timezone == "UTC"

    @pytest.mark.parametrize("role", [15, 5])
    def test_non_admin_cannot_edit(self, workspace, create_user, session_client, role):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role)
        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/", {"billing_email": "changed@example.com"}, format="json"
        )
        assert response.status_code == 403
        workspace.refresh_from_db()
        assert workspace.billing_email == ""

    def test_workspace_scope_is_enforced(self, workspace, create_user, session_client):
        other = Workspace.objects.create(name="Other Company", slug="other-company", owner=create_user)
        response = session_client.patch(f"/api/workspaces/{other.slug}/", {"currency": "USD"}, format="json")
        assert response.status_code == 403
        other.refresh_from_db()
        assert other.currency == ""
