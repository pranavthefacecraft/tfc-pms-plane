# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import ProjectMemberInvite

PENDING_COLLABORATOR_INVITE = "pending-create-project-collaborator"


def pending_invited_projects(workspace_id, email):
    invites = ProjectMemberInvite.objects.filter(
        workspace_id=workspace_id,
        email__iexact=email,
        message=PENDING_COLLABORATOR_INVITE,
        project__archived_at__isnull=True,
    ).order_by("project__name", "project_id")
    projects = {}
    for project_id, name in invites.values_list("project_id", "project__name"):
        projects[str(project_id)] = {"id": str(project_id), "name": name}
    return list(projects.values())
