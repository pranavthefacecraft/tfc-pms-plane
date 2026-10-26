# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging
from smtplib import SMTPException

from celery import shared_task
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from plane.db.models import WorkspaceMember, WorkspaceMessageRecipient
from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html, render_email_template


@shared_task
def queue_workspace_message_emails():
    membership = WorkspaceMember.objects.filter(
        workspace_id=OuterRef("message__workspace_id"), member_id=OuterRef("recipient_id"), is_active=True
    )
    deliveries = (
        WorkspaceMessageRecipient.objects.filter(
            email_sent_at__isnull=True,
            message__deleted_at__isnull=True,
            message__workspace__deleted_at__isnull=True,
            recipient__is_active=True,
        )
        .filter(Exists(membership))
        .values_list("id", flat=True)
    )
    for delivery_id in deliveries.iterator(chunk_size=100):
        send_workspace_message_email.delay(str(delivery_id))


@shared_task(autoretry_for=(SMTPException, OSError), retry_backoff=True, retry_jitter=True, max_retries=8)
def send_workspace_message_email(delivery_id):
    with transaction.atomic():
        delivery = (
            WorkspaceMessageRecipient.objects.select_for_update(of=("self",))
            .select_related("message__workspace", "message__sender", "recipient")
            .filter(pk=delivery_id, message__deleted_at__isnull=True, message__workspace__deleted_at__isnull=True)
            .first()
        )
        if not delivery or delivery.email_sent_at:
            return
        if not WorkspaceMember.objects.filter(
            workspace=delivery.message.workspace, member=delivery.recipient, is_active=True, member__is_active=True
        ).exists():
            logging.getLogger("plane.worker").info("Skipping workspace message email: recipient membership removed")
            return
        host, username, password, port, tls, ssl, from_email = get_email_configuration()
        origin = settings.WEB_URL or settings.APP_BASE_URL
        if not host or not origin:
            raise ImproperlyConfigured("Email and WEB_URL must be configured to deliver workspace messages.")
        message = delivery.message
        html = render_email_template(
            "emails/notifications/workspace_message.html",
            {
                "subject": message.subject,
                "body": message.body,
                "sender_name": message.sender.display_name or message.sender.first_name,
                "workspace_name": message.workspace.name,
                "abs_url": f"{origin.rstrip('/')}/{message.workspace.slug}/notifications/?message={message.id}",
            },
        )
        connection = get_connection(
            host=host,
            port=int(port),
            username=username,
            password=password,
            use_tls=tls == "1",
            use_ssl=ssl == "1",
            timeout=30,
        )
        email = EmailMultiAlternatives(
            subject=message.subject,
            body=generate_plain_text_from_html(html),
            from_email=from_email,
            to=[delivery.recipient.email],
            connection=connection,
        )
        email.attach_alternative(html, "text/html")
        if email.send() != 1:
            raise SMTPException("Workspace message email was not accepted by the mail backend.")
        delivery.email_sent_at = timezone.now()
        delivery.save(update_fields=["email_sent_at"])
