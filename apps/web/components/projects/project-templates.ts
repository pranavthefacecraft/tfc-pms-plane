/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ProjectSectionService } from "@/services/project/project-section.service";

export type TProjectTemplate = "blank" | "general";

export const PROJECT_TEMPLATES: { id: TProjectTemplate; title: string; description: string }[] = [
  { id: "blank", title: "Blank Project", description: "Start with no stages." },
  { id: "general", title: "General Template", description: "Start with To Do, In Progress, Review, and Done." },
];

export const GENERAL_TEMPLATE_STAGES = ["To Do", "In Progress", "Review", "Done"] as const;

type TSectionApi = Pick<ProjectSectionService, "list" | "create" | "update" | "remove">;

/**
 * Every new project starts with one default "Untitled section". Blank projects drop it so they start with no
 * stages; the General template renames it to the first stage (so new tasks still land there) and adds the rest.
 */
export async function applyProjectTemplate(
  service: TSectionApi,
  workspaceSlug: string,
  projectId: string,
  template: TProjectTemplate
) {
  const sections = await service.list(workspaceSlug, projectId);
  const fallback = sections.find((section) => section.is_default);
  if (template === "blank") {
    if (fallback) await service.remove(workspaceSlug, projectId, fallback.id);
    return;
  }
  const [first, ...rest] = GENERAL_TEMPLATE_STAGES;
  if (fallback) await service.update(workspaceSlug, projectId, fallback.id, { name: first });
  else await service.create(workspaceSlug, projectId, first);
  // Created one after another so each stage gets the next sort order.
  await rest.reduce<Promise<unknown>>(
    (previous, name) => previous.then(() => service.create(workspaceSlug, projectId, name)),
    Promise.resolve()
  );
}
