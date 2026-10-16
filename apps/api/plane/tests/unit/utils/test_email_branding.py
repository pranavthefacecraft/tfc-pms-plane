# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from pathlib import Path
import re
from unittest.mock import patch

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings

from plane.bgtasks.magic_link_code_task import magic_link
from plane.utils.email import generate_plain_text_from_html, render_email_template


TEMPLATES_ROOT = Path(__file__).resolve().parents[4] / "templates"
EMAIL_TEMPLATES = sorted(
    path.relative_to(TEMPLATES_ROOT).as_posix()
    for path in (TEMPLATES_ROOT / "emails").rglob("*.html")
    if path.name != "logo.html"
)


@pytest.mark.parametrize("template_name", EMAIL_TEMPLATES)
@override_settings(WEB_URL="https://pms.example.test/")
def test_email_templates_use_own_logo_and_branding(template_name):
    html = render_email_template(template_name, {"code": "123456", "email": "member@example.test"})
    assert 'src="https://pms.example.test/tfc-pms-logo.png"' in html
    assert 'alt="TFC PMS"' in html
    assert "media.docs.plane.so/logo" not in html
    text = generate_plain_text_from_html(html)
    assert "TFC PMS" in text
    assert "Plane Software, Inc." not in text
    assert not re.search(r"\bPlane\b", text)


def test_all_application_templates_are_covered():
    assert len(EMAIL_TEMPLATES) == 12


@override_settings(WEB_URL="")
def test_missing_web_url_is_explicit():
    with pytest.raises(ImproperlyConfigured, match="WEB_URL"):
        render_email_template("emails/auth/magic_signin.html")


@override_settings(WEB_URL="https://pms.example.test")
def test_login_email_preserves_code_and_recipient():
    with (
        patch(
            "plane.bgtasks.magic_link_code_task.get_email_configuration",
            return_value=("smtp.example.test", "login", "test-only", "2525", "1", "0", "sender@example.test"),
        ),
        patch("plane.bgtasks.magic_link_code_task.get_connection"),
        patch("plane.bgtasks.magic_link_code_task.EmailMultiAlternatives") as message,
    ):
        magic_link.run("member@example.test", "unused", "123456")
    assert message.call_args.kwargs["subject"] == "Your unique TFC PMS login code is 123456"
    assert message.call_args.kwargs["to"] == ["member@example.test"]
    assert "123456" in message.call_args.kwargs["body"]
    html = message.return_value.attach_alternative.call_args.args[0]
    assert "https://pms.example.test/tfc-pms-logo.png" in html
    message.return_value.send.assert_called_once()
