# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import Section


def apply_default_section(data, project_id):
    if "section" not in data and project_id:
        data["section"] = Section.objects.filter(project_id=project_id, is_default=True).first()


def is_active_section_in_project(section, project_id):
    if section is None:
        return True

    return Section.objects.filter(
        id=section.id,
        project_id=project_id,
        deleted_at__isnull=True,
    ).exists()
