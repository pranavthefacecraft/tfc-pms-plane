# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.html import escape
from django.utils import timezone
from kombu.exceptions import OperationalError
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers.user import UserLiteSerializer
from plane.app.views.base import BaseAPIView
from plane.bgtasks.workspace_message_task import send_workspace_message_email
from plane.db.models import Notification, User, Workspace, WorkspaceMember, WorkspaceMessage, WorkspaceMessageRecipient
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.exception_logger import log_exception


class MessageInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    subject = serializers.CharField(max_length=255)
    body = serializers.CharField(max_length=20000)
    recipients = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=100)

    def validate_subject(self, value):
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise serializers.ValidationError("Subject must be a single line without control characters.")
        return value

    def validate_recipients(self, value):
        return sorted(set(value))


def message_data(message):
    return {
        "id": str(message.id),
        "subject": message.subject,
        "body": message.body,
        "created_at": message.created_at,
        "sender": UserLiteSerializer(message.sender).data,
        "recipients": UserLiteSerializer(
            [delivery.recipient for delivery in message.recipients.select_related("recipient")], many=True
        ).data,
    }


class WorkspaceMessageEndpoint(BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, pk=None):
        if pk is not None:
            raise MethodNotAllowed("POST")
        serializer = MessageInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if request.user.id in data["recipients"]:
            return Response({"error": "Choose another workspace member as a recipient."}, status=400)
        if not get_email_configuration()[0]:
            return Response(
                {
                    "error": (
                        "Email is not configured. Ask your administrator to configure email before sending messages."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        with transaction.atomic():
            # Serialize sends for this user so retried/concurrent requests cannot notify twice.
            User.objects.select_for_update().get(pk=request.user.pk)
            workspace = get_object_or_404(Workspace, slug=slug)
            members = set(data["recipients"])
            message = WorkspaceMessage.objects.filter(pk=data["id"]).first()
            created = message is None
            if message:
                if (
                    message.sender_id != request.user.id
                    or message.workspace_id != workspace.id
                    or message.subject != data["subject"]
                    or message.body != data["body"]
                    or set(message.recipients.values_list("recipient_id", flat=True)) != members
                ):
                    return Response(
                        {"error": "This message ID was already used. Start a new draft to send a different message."},
                        status=status.HTTP_409_CONFLICT,
                    )
            else:
                active_members = set(
                    WorkspaceMember.objects.filter(
                        workspace=workspace,
                        member_id__in=members,
                        is_active=True,
                        member__is_active=True,
                        member__is_bot=False,
                    ).values_list("member_id", flat=True)
                )
                if active_members != members:
                    return Response({"error": "All recipients must be active members of this workspace."}, status=400)
                message = WorkspaceMessage.objects.create(
                    id=data["id"], workspace=workspace, sender=request.user, subject=data["subject"], body=data["body"]
                )
                for member_id in sorted(members):
                    notification = Notification.objects.create(
                        workspace=workspace,
                        receiver_id=member_id,
                        triggered_by=request.user,
                        entity_identifier=message.id,
                        entity_name="workspace_message",
                        sender="workspace_message.sent",
                        title=message.subject,
                        message_stripped=message.body,
                        message_html=f"<p>{escape(message.body)}</p>",
                        data={"message_id": str(message.id)},
                    )
                    WorkspaceMessageRecipient.objects.create(
                        message=message, recipient_id=member_id, notification=notification
                    )

            delivery_ids = list(message.recipients.filter(email_sent_at__isnull=True).values_list("id", flat=True))

        try:
            for delivery_id in delivery_ids:
                send_workspace_message_email.delay(str(delivery_id))
        except OperationalError as error:
            log_exception(error)
            return Response(
                {
                    "error": (
                        "Message saved in Inbox, but email could not be queued. "
                        "Retry Send to queue email without duplicating the message."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(message_data(message), status=201 if created else 200)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, pk=None):
        if pk is None:
            raise MethodNotAllowed("GET")
        message = get_object_or_404(
            WorkspaceMessage.objects.select_related("sender")
            .filter(Q(sender=request.user) | Q(recipients__recipient=request.user))
            .distinct(),
            workspace__slug=slug,
            pk=pk,
        )
        Notification.objects.filter(
            receiver=request.user,
            workspace__slug=slug,
            entity_name="workspace_message",
            entity_identifier=pk,
            read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response(message_data(message))
