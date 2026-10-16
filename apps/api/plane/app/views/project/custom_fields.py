# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import math
import re
import uuid
from datetime import date

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueCustomFieldValue,
    IssueSubscriber,
    Notification,
    Project,
    ProjectCustomField,
    ProjectMember,
    UserNotificationPreference,
    WorkspaceMember,
)
from ..base import BaseAPIView


class OptionInput(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(max_length=100)
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$")


class FieldInput(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=2000, allow_blank=True, default="")
    field_type = serializers.ChoiceField(choices=ProjectCustomField.FIELD_TYPES)
    options = OptionInput(many=True, required=False)
    notify_collaborators = serializers.BooleanField(default=False)


def serialize_field(field):
    return {
        "id": str(field.id),
        "name": field.name,
        "description": field.description,
        "field_type": field.field_type,
        "options": field.options,
        "notify_collaborators": field.notify_collaborators,
    }


def validate_field(data, project, field=None):
    serializer = FieldInput(data=data, partial=field is not None)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    name = values.get("name", field.name if field else "")
    duplicates = ProjectCustomField.objects.filter(project=project, name__iexact=name)
    if field:
        duplicates = duplicates.exclude(pk=field.pk)
        if values.get("field_type", field.field_type) != field.field_type:
            raise ValidationError({"error": "Field type cannot be changed. Create a new field instead."})
    if duplicates.exists():
        raise ValidationError({"error": "A field with this name already exists in the project."})
    kind = values.get("field_type", field.field_type if field else None)
    options = values.get("options", field.options if field else [])
    if kind in ("single_select", "multi_select"):
        if not 1 <= len(options) <= 100:
            raise ValidationError({"error": "Select fields require between 1 and 100 options."})
        ids = [str(option["id"]) for option in options]
        names = [option["name"].casefold() for option in options]
        if len(set(ids)) != len(ids) or len(set(names)) != len(names):
            raise ValidationError({"error": "Option IDs and names must be unique."})
        if field:
            removed = {option["id"] for option in field.options} - set(ids)
            if removed:
                for value in field.values.values_list("value", flat=True):
                    if (isinstance(value, str) and value in removed) or (
                        isinstance(value, list) and removed.intersection(value)
                    ):
                        raise ValidationError({"error": "Clear task values before removing an option in use."})
        values["options"] = [{**option, "id": str(option["id"])} for option in options]
    elif options:
        raise ValidationError({"error": "Only select fields can have options."})
    return values


def validate_value(field, value):
    if value is None:
        return None
    kind = field.field_type
    options = {option["id"] for option in field.options}
    if kind == "text":
        valid = isinstance(value, str) and len(value) <= 10000
    elif kind == "number":
        valid = type(value) in (float, int) and abs(value) <= 1e15 and math.isfinite(value)
    elif kind == "date":
        valid = isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value))
        if valid:
            try:
                date.fromisoformat(value)
            except ValueError:
                valid = False
    elif kind == "single_select":
        valid = isinstance(value, str) and value in options
    else:
        valid = (
            isinstance(value, list)
            and len(value) <= 100
            and all(isinstance(item, str) and item in options for item in value)
            and len(value) == len(set(value))
        )
        if valid:
            value = sorted(value)
    if not valid:
        raise ValidationError({"error": f"Invalid value for {field.name} ({kind})."})
    return value


def display_value(field, value):
    if value is None or value == [] or value == "":
        return "None"
    if field.field_type in ("single_select", "multi_select"):
        ids = value if isinstance(value, list) else [value]
        return ", ".join(option["name"] for option in field.options if option["id"] in ids)
    return str(value)


def notify_change(issue, field, old_value, new_value, actor):
    if not field.notify_collaborators or old_value == new_value:
        return
    recipient_ids = set(IssueAssignee.objects.filter(issue=issue).values_list("assignee_id", flat=True))
    recipient_ids.update(IssueSubscriber.objects.filter(issue=issue).values_list("subscriber_id", flat=True))
    if issue.created_by_id:
        recipient_ids.add(issue.created_by_id)
    eligible = (
        ProjectMember.objects.filter(
            project_id=issue.project_id,
            member_id__in=recipient_ids,
            is_active=True,
            member__is_active=True,
            role__in=[15, 20],
        )
        .filter(
            member_id__in=WorkspaceMember.objects.filter(
                workspace_id=issue.workspace_id, is_active=True, role__in=[15, 20]
            ).values("member_id"),
        )
        .exclude(member=actor)
        .values_list("member_id", flat=True)
    )
    opted_out = (
        UserNotificationPreference.objects.filter(property_change=False)
        .filter(
            Q(workspace__isnull=True, project__isnull=True)
            | Q(workspace_id=issue.workspace_id, project__isnull=True)
            | Q(project_id=issue.project_id)
        )
        .values_list("user_id", flat=True)
    )
    message = f"{field.name}: {display_value(field, old_value)} -> {display_value(field, new_value)}"
    Notification.objects.bulk_create(
        [
            Notification(
                workspace_id=issue.workspace_id,
                project_id=issue.project_id,
                receiver_id=receiver,
                entity_name="issue",
                entity_identifier=issue.id,
                sender="custom_field.updated",
                triggered_by=actor,
                title=f"{actor.display_name or actor.first_name} updated {field.name}",
                message_stripped=message[:1000],
                data={
                    "custom_field_id": str(field.id),
                    "issue": {
                        "id": str(issue.id),
                        "name": issue.name,
                        "sequence_id": issue.sequence_id,
                        "identifier": issue.project.identifier,
                    },
                },
            )
            for receiver in set(eligible) - set(opted_out)
        ]
    )


class CustomFieldMixin:
    def project(self, request, slug, project_id, editing=False):
        project = get_object_or_404(Project, pk=project_id, workspace__slug=slug)
        if not WorkspaceMember.objects.filter(
            workspace_id=project.workspace_id, member=request.user, is_active=True
        ).exists():
            raise PermissionDenied("Active workspace membership is required.")
        if editing and project.archived_at:
            raise ValidationError({"error": "Archived projects are read-only."})
        return project


class ProjectCustomFieldsEndpoint(CustomFieldMixin, BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        project = self.project(request, slug, project_id)
        return Response([serialize_field(field) for field in ProjectCustomField.objects.filter(project=project)])

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        with transaction.atomic():
            project = self.project(request, slug, project_id, editing=True)
            Project.objects.select_for_update().get(pk=project.pk)
            if ProjectCustomField.objects.filter(project=project).count() >= 100:
                raise ValidationError({"error": "A project can have at most 100 custom fields."})
            values = validate_field(request.data, project)
            field = ProjectCustomField.objects.create(
                workspace_id=project.workspace_id,
                project=project,
                sort_order=ProjectCustomField.objects.filter(project=project).count(),
                **values,
            )
        return Response(serialize_field(field), status=status.HTTP_201_CREATED)


class ProjectCustomFieldEndpoint(CustomFieldMixin, BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, field_id):
        with transaction.atomic():
            project = self.project(request, slug, project_id, editing=True)
            Project.objects.select_for_update().get(pk=project.pk)
            field = get_object_or_404(ProjectCustomField.objects.select_for_update(), pk=field_id, project=project)
            for key, value in validate_field(request.data, project, field).items():
                setattr(field, key, value)
            field.save()
        return Response(serialize_field(field))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id, field_id):
        with transaction.atomic():
            project = self.project(request, slug, project_id, editing=True)
            field = get_object_or_404(ProjectCustomField.objects.select_for_update(), pk=field_id, project=project)
            field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueCustomFieldValuesEndpoint(CustomFieldMixin, BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id):
        project = self.project(request, slug, project_id)
        issue = get_object_or_404(Issue.objects.all(), pk=issue_id, project=project)
        # Match the task-detail endpoint's guest visibility rules.
        membership = ProjectMember.objects.get(project=project, member=request.user, is_active=True)
        if membership.role == 5 and not project.guest_view_all_features and issue.created_by_id != request.user.id:
            raise PermissionDenied("You cannot access this task.")
        return Response(
            {
                str(row.field_id): row.value
                for row in IssueCustomFieldValue.objects.filter(issue=issue, field__deleted_at__isnull=True)
            }
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def put(self, request, slug, project_id, issue_id):
        if not isinstance(request.data, dict) or set(request.data) != {"field_id", "value"}:
            raise ValidationError({"error": "Provide field_id and value."})
        try:
            field_id = uuid.UUID(str(request.data["field_id"]))
        except (TypeError, ValueError, AttributeError):
            raise ValidationError({"error": "field_id must be a UUID."})
        with transaction.atomic():
            project = self.project(request, slug, project_id, editing=True)
            field = get_object_or_404(ProjectCustomField.objects.select_for_update(), pk=field_id, project=project)
            issue = get_object_or_404(Issue.objects.select_for_update(), pk=issue_id, project=project)
            if issue.archived_at:
                raise ValidationError({"error": "Archived tasks are read-only."})
            value = validate_value(field, request.data["value"])
            row = IssueCustomFieldValue.objects.filter(issue=issue, field=field).first()
            old_value = row.value if row else None
            IssueCustomFieldValue.objects.update_or_create(
                issue=issue,
                field=field,
                defaults={"value": value, "project": project, "workspace_id": project.workspace_id},
            )
            notify_change(issue, field, old_value, value, request.user)
        return Response({"field_id": str(field.id), "value": value})
