# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.app.serializers.base import BaseSerializer
from plane.db.models import Section


class SectionSerializer(BaseSerializer):
    class Meta:
        model = Section
        fields = ["id", "name", "sort_order"]
        read_only_fields = ["id"]
