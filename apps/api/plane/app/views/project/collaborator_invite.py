# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Teammates added from the Create Project form.

Existing workspace members join the project right away. Anyone else gets a workspace
invitation email plus a pending project invite that is applied when they join the workspace.
"""

import secrets

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Min
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.bgtasks.workspace_invitation_task import workspace_invitation
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    ProjectUserProperty,
    WorkspaceMember,
    WorkspaceMemberInvite,
)
from plane.utils.host import base_host

# Marks invites created here so the email-based project invitation flow is left untouched.
PENDING_COLLABORATOR_INVITE = "pending-create-project-collaborator"
MAX_INVITES = 20
INVITE_ROLES = (ROLE.MEMBER.value, ROLE.GUEST.value)


def project_role_for(workspace_role, requested_role):
    """Workspace admins are always project admins; guests can only be viewers."""
    if workspace_role == ROLE.ADMIN.value:
        return ROLE.ADMIN.value
    return min(requested_role, workspace_role)


def add_project_member(project, user_id, role, created_by_id=None):
    member = ProjectMember.objects.filter(project=project, member_id=user_id).first()
    if member is not None:
        if not member.is_active:
            member.is_active = True
            member.role = role
            member.save(update_fields=["is_active", "role"])
        return
    ProjectMember.objects.create(
        project=project, workspace_id=project.workspace_id, member_id=user_id, role=role, created_by_id=created_by_id
    )
    min_sort_order = ProjectUserProperty.objects.filter(workspace_id=project.workspace_id, user_id=user_id).aggregate(
        value=Min("sort_order")
    )["value"]
    ProjectUserProperty.objects.get_or_create(
        project=project,
        workspace_id=project.workspace_id,
        user_id=user_id,
        defaults={"sort_order": min_sort_order - 10000 if min_sort_order is not None else 65535},
    )


def apply_pending_project_invites(user, workspace_ids=None):
    """Add a user who just joined a workspace to the projects they were invited to from Create Project."""
    invites = ProjectMemberInvite.objects.filter(
        email__iexact=user.email, message=PENDING_COLLABORATOR_INVITE, project__archived_at__isnull=True
    ).select_related("project")
    if workspace_ids is not None:
        invites = invites.filter(workspace_id__in=workspace_ids)
    for invite in invites:
        workspace_member = WorkspaceMember.objects.filter(
            workspace_id=invite.workspace_id, member=user, is_active=True
        ).first()
        if workspace_member is None:
            continue
        add_project_member(
            invite.project, user.id, project_role_for(workspace_member.role, invite.role), invite.created_by_id
        )
        invite.delete()


class ProjectCollaboratorInvitesEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        project = Project.objects.filter(id=project_id, workspace__slug=slug, archived_at__isnull=True).first()
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
        invites = request.data.get("invites")
        if not isinstance(invites, list) or not invites or len(invites) > MAX_INVITES:
            return Response(
                {"error": f"Provide between 1 and {MAX_INVITES} invites"}, status=status.HTTP_400_BAD_REQUEST
            )

        cleaned = {}
        for invite in invites:
            email = str((invite or {}).get("email", "")).strip().lower()
            role = (invite or {}).get("role", ROLE.MEMBER.value)
            try:
                validate_email(email)
            except ValidationError:
                return Response({"error": f"Invalid email: {email or '(empty)'}"}, status=status.HTTP_400_BAD_REQUEST)
            if role not in INVITE_ROLES:
                return Response({"error": "Role must be Editor or Viewer"}, status=status.HTTP_400_BAD_REQUEST)
            cleaned[email] = role

        requester = WorkspaceMember.objects.get(workspace__slug=slug, member=request.user, is_active=True)
        members = {
            member.member.email.lower(): member
            for member in WorkspaceMember.objects.filter(
                workspace__slug=slug, member__email__in=list(cleaned), is_active=True
            ).select_related("member")
        }
        new_emails = [email for email in cleaned if email not in members]
        if new_emails and requester.role < ROLE.MEMBER.value:
            return Response(
                {"error": "Only workspace members and admins can invite new people"},
                status=status.HTTP_403_FORBIDDEN,
            )

        added = []
        for email, member in members.items():
            add_project_member(
                project, member.member_id, project_role_for(member.role, cleaned[email]), request.user.id
            )
            added.append(email)

        current_site = base_host(request=request, is_app=True)
        for email in new_emails:
            role = min(cleaned[email], requester.role)
            workspace_invite = WorkspaceMemberInvite.objects.filter(
                workspace_id=project.workspace_id, email=email
            ).first()
            if workspace_invite is None:
                workspace_invite = WorkspaceMemberInvite.objects.create(
                    workspace_id=project.workspace_id,
                    email=email,
                    token=secrets.token_urlsafe(32),
                    role=role,
                    created_by=request.user,
                )
                workspace_invitation.delay(
                    email, project.workspace_id, workspace_invite.token, current_site, request.user.email
                )
            ProjectMemberInvite.objects.update_or_create(
                project=project,
                workspace_id=project.workspace_id,
                email=email,
                message=PENDING_COLLABORATOR_INVITE,
                defaults={"role": role, "token": secrets.token_urlsafe(32), "created_by": request.user},
            )

        return Response({"added": added, "invited": new_emails}, status=status.HTTP_200_OK)
