# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import html
import re

# Django imports
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def render_email_template(template_name, context=None):
    if not settings.WEB_URL:
        raise ImproperlyConfigured("WEB_URL is required to render application emails.")
    return render_to_string(
        template_name,
        {
            **(context or {}),
            "email_logo_url": f"{settings.WEB_URL.rstrip('/')}/tfc-pms-logo.png",
        },
    )


def generate_plain_text_from_html(html_content):
    """
    Generate clean plain text from HTML email template.
    Removes all HTML tags, CSS styles, and excessive whitespace, and decodes
    HTML character references so the text/plain part reads as literal text.

    Args:
        html_content (str): The HTML content to convert to plain text

    Returns:
        str: Clean plain text without HTML tags, styles, excessive whitespace,
            or HTML character references
    """
    # Remove style tags and their content
    html_content = re.sub(r"<style[^>]*>.*?</style>", "", html_content, flags=re.DOTALL | re.IGNORECASE)

    # Strip HTML tags, then decode character references. `strip_tags` re-emits
    # entity refs verbatim, so URLs escaped for the HTML part would otherwise
    # reach the text/plain part as `?a=1&amp;b=2` and break when pasted.
    text_content = html.unescape(strip_tags(html_content))

    # Remove excessive empty lines
    text_content = re.sub(r"\n\s*\n\s*\n+", "\n\n", text_content)

    # Ensure there's a leading and trailing whitespace
    text_content = "\n\n" + text_content.lstrip().rstrip() + "\n\n"

    return text_content
