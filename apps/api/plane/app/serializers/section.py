# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.app.serializers.base import BaseSerializer
from plane.db.models import Section


class SectionSerializer(BaseSerializer):
    icon = serializers.RegexField(r"^[a-z0-9_]{1,100}$", allow_blank=True, required=False)
    icon_color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", required=False)

    class Meta:
        model = Section
        fields = ["id", "name", "sort_order", "icon", "icon_color"]
        read_only_fields = ["id"]
