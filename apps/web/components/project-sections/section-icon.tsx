/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ModuleOutline } from "@makeplane/propel/icons";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import type { TProjectSection } from "@/services/project/project-section.service";

export function SectionIcon({ section }: { section?: Pick<TProjectSection, "icon" | "icon_color"> }) {
  return section?.icon ? (
    <Logo logo={{ in_use: "icon", icon: { name: section.icon, color: section.icon_color ?? "#6d7b8a" } }} size={14} />
  ) : (
    <ModuleOutline className="size-3.5" style={{ color: section?.icon_color }} />
  );
}
