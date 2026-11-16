# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Teammates added from the Create Project form.

Existing workspace members join the project right away. Anyone else gets a workspace
invitation email plus a pending project invite that is applied when they join the workspace.
"""

import secrets
import json
from functools import partial

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from django.db.models import Min, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.bgtasks.workspace_invitation_task import workspace_invitation
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    ProjectUserProperty,
    WorkspaceMember,
    WorkspaceMemberInvite,
    Issue,
    IssueAssignee,
    PendingTaskAssignee,
    User,
)
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.host import base_host
from plane.utils.project_invitation import PENDING_COLLABORATOR_INVITE

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
    invites = (
        ProjectMemberInvite.objects.filter(
            email__iexact=user.email, message=PENDING_COLLABORATOR_INVITE, project__archived_at__isnull=True
        )
        .filter(Q(responded_at__isnull=True) | Q(accepted=True))
        .select_related("project")
    )
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
        apply_pending_task_assignments(invite, user)
        invite.delete()


def apply_pending_task_assignments(invite, user):
    if (
        user.email.lower() != invite.email.lower()
        or invite.deleted_at is not None
        or invite.project.archived_at is not None
    ):
        return
    if invite.responded_at is not None and not invite.accepted:
        return
    membership = ProjectMember.objects.filter(
        project=invite.project, member=user, is_active=True, role__gte=ROLE.MEMBER.value
    )
    workspace_membership = WorkspaceMember.objects.filter(
        workspace_id=invite.workspace_id, member=user, is_active=True, role__gte=ROLE.MEMBER.value
    ).exists()
    if not membership.exists() or not workspace_membership or not user.is_active or user.is_bot:
        return
    assignments = PendingTaskAssignee.objects.filter(invitation=invite).select_related("issue")
    for assignment in assignments:
        issue = assignment.issue
        if issue.deleted_at is not None or issue.archived_at is not None or issue.project_id != invite.project_id:
            continue
        project_role = (
            ProjectMember.objects.filter(
                project_id=issue.project_id,
                member_id=assignment.inviter_id,
                is_active=True,
            )
            .values_list("role", flat=True)
            .first()
        )
        workspace_role = (
            WorkspaceMember.objects.filter(
                workspace_id=issue.workspace_id,
                member_id=assignment.inviter_id,
                is_active=True,
                role__gte=ROLE.MEMBER.value,
                member__is_active=True,
                member__is_bot=False,
            )
            .values_list("role", flat=True)
            .first()
        )
        if project_role is None or workspace_role is None or ROLE.ADMIN.value not in (project_role, workspace_role):
            continue
        assign_invited_teammate(issue, user.id, assignment.inviter_id)


def assign_invited_teammate(issue, user_id, actor_id):
    current_ids = [
        str(value) for value in IssueAssignee.objects.filter(issue=issue).values_list("assignee_id", flat=True)
    ]
    _, created = IssueAssignee.objects.get_or_create(
        issue=issue, assignee_id=user_id, defaults={"project_id": issue.project_id, "workspace_id": issue.workspace_id}
    )
    if created:
        transaction.on_commit(
            partial(
                issue_activity.delay,
                type="issue.activity.updated",
                requested_data=json.dumps({"assignee_ids": [*current_ids, str(user_id)]}),
                current_instance=json.dumps({"assignee_ids": current_ids}),
                actor_id=str(actor_id),
                issue_id=str(issue.id),
                project_id=str(issue.project_id),
                epoch=int(timezone.now().timestamp()),
                notification=True,
                origin=base_host(request=None, is_app=True),
            )
        )


class ProjectCollaboratorInvitesEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN])
    @transaction.atomic
    def post(self, request, slug, project_id):
        project = Project.objects.filter(id=project_id, workspace__slug=slug, archived_at__isnull=True).first()
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
        issue = None
        if "issue_id" in request.data:
            issue_id = serializers.UUIDField().run_validation(request.data["issue_id"])
            issue = get_object_or_404(Issue.issue_objects, pk=issue_id, project=project, workspace__slug=slug)
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
            if issue is not None and role != ROLE.MEMBER.value:
                return Response({"error": "Task assignees must be Editors."}, status=status.HTTP_400_BAD_REQUEST)
            cleaned[email] = role

        requester = WorkspaceMember.objects.get(workspace__slug=slug, member=request.user, is_active=True)
        members = {
            member.member.email.lower(): member
            for member in WorkspaceMember.objects.filter(
                workspace__slug=slug,
                member__email__in=list(cleaned),
                is_active=True,
                member__is_active=True,
                member__is_bot=False,
            ).select_related("member")
        }
        new_emails = [email for email in cleaned if email not in members]
        if new_emails and requester.role < ROLE.MEMBER.value:
            return Response(
                {"error": "Only workspace members and admins can invite new people"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if issue is not None:
            ineligible = any(member.role < ROLE.MEMBER.value for member in members.values())
            ineligible = (
                ineligible
                or WorkspaceMember.objects.filter(
                    workspace_id=project.workspace_id, member__email__in=new_emails
                ).exists()
            )
            ineligible = (
                ineligible
                or User.objects.filter(email__in=new_emails).filter(Q(is_bot=True) | Q(is_active=False)).exists()
            )
            ineligible = (
                ineligible
                or ProjectMember.objects.filter(
                    project=project,
                    member_id__in=[member.member_id for member in members.values()],
                    is_active=True,
                    role__lt=ROLE.MEMBER.value,
                ).exists()
            )
            ineligible = (
                ineligible
                or WorkspaceMemberInvite.objects.filter(
                    workspace_id=project.workspace_id, email__in=new_emails, role__lt=ROLE.MEMBER.value
                ).exists()
            )
            if ineligible:
                return Response(
                    {"error": "Suspended teammates and workspace viewers cannot be assigned tasks."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_emails:
                if not get_email_configuration()[0]:
                    return Response(
                        {"error": "Email invitations are unavailable until SMTP is configured."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        added = []
        for email, member in members.items():
            add_project_member(
                project, member.member_id, project_role_for(member.role, cleaned[email]), request.user.id
            )
            added.append(email)
            if issue is not None:
                assign_invited_teammate(issue, member.member_id, request.user.id)

        current_site = base_host(request=request, is_app=True)
        for email in new_emails:
            role = min(cleaned[email], requester.role)
            workspace_invite = WorkspaceMemberInvite.objects.filter(
                workspace_id=project.workspace_id, email=email
            ).first()
            new_workspace_invite = workspace_invite is None
            if workspace_invite is None:
                workspace_invite = WorkspaceMemberInvite.objects.create(
                    workspace_id=project.workspace_id,
                    email=email,
                    token=secrets.token_urlsafe(32),
                    role=role,
                    created_by=request.user,
                )
            project_invite, new_project_invite = ProjectMemberInvite.objects.update_or_create(
                project=project,
                workspace_id=project.workspace_id,
                email=email,
                message=PENDING_COLLABORATOR_INVITE,
                defaults={"role": role, "token": secrets.token_urlsafe(32), "created_by": request.user},
            )
            if issue is not None:
                PendingTaskAssignee.objects.get_or_create(
                    issue=issue, invitation=project_invite, defaults={"inviter": request.user}
                )
            if new_workspace_invite or new_project_invite:
                transaction.on_commit(
                    partial(
                        workspace_invitation.delay,
                        email,
                        project.workspace_id,
                        workspace_invite.token,
                        current_site,
                        request.user.email,
                    )
                )

        return Response({"added": added, "invited": new_emails}, status=status.HTTP_200_OK)
