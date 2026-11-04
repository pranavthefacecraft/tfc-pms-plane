from urllib.parse import quote
from smtplib import SMTPException

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core import signing

from plane.db.models import Page
from plane.license.utils.instance_value import get_email_configuration


@shared_task(autoretry_for=(OSError, SMTPException), retry_backoff=True, max_retries=3)
def notepad_invitation(page_id, email, token, current_site):
    page = (
        Page.objects.filter(pk=page_id, tool_type=Page.TOOL_TYPE_PAGE, archived_at__isnull=True)
        .select_related("workspace", "owned_by")
        .first()
    )
    if page is None or email not in page.notepad_invitations:
        return
    try:
        payload = signing.loads(token, salt="notepad-invitation", max_age=7 * 86400)
    except signing.BadSignature:
        return
    if page.notepad_invitations[email] != payload["nonce"]:
        return
    host, username, password, port, tls, ssl, sender = get_email_configuration()
    url = f"{current_site}/shared/notepads/{page.workspace.slug}/{page.id}/?invitation={quote(token)}"
    body = (
        f"{page.owned_by.display_name or page.owned_by.first_name} invited you to edit the notepad "
        f'"{page.name or "Untitled Page"}".\n\n{url}\n\n'
        f"Sign in or create an account using {email}, then accept. This invitation expires in 7 days. "
        "It grants access to this notepad only, not its workspace or linked projects."
    )
    connection = get_connection(
        host=host,
        port=int(port),
        username=username,
        password=password,
        use_tls=tls == "1",
        use_ssl=ssl == "1",
    )
    EmailMultiAlternatives(
        subject="You are invited to collaborate on a notepad",
        body=body,
        from_email=sender,
        to=[email],
        connection=connection,
    ).send(fail_silently=False)
