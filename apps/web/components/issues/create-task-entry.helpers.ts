/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EIssuesStoreType } from "@plane/types";
import type { TIssue } from "@plane/types";
import type { TNewTaskDraft } from "@/components/profile/new-task.helpers";

/** Prefilled values the New Task side form can represent. */
const PANEL_FIELDS = new Set([
  "project_id",
  "section_id",
  "state_id",
  "priority",
  "assignee_ids",
  "start_date",
  "target_date",
  "name",
]);
/** Stores whose create flow links the work item to context the side form cannot set. */
const POPUP_STORES = new Set<EIssuesStoreType>([
  EIssuesStoreType.CYCLE,
  EIssuesStoreType.MODULE,
  EIssuesStoreType.EPIC,
  EIssuesStoreType.WORKSPACE_DRAFT,
  EIssuesStoreType.ARCHIVED,
]);

const isBlank = (value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * New work items open in the New Task side form unless the context needs the full popup:
 * drafts, edits, cycles, modules, epics, sub-items, or prefilled fields such as labels.
 */
export function usesTaskPanel({
  data,
  storeType,
  isDraft,
  inCycleOrModule,
}: {
  data?: Partial<TIssue>;
  storeType?: EIssuesStoreType;
  isDraft?: boolean;
  inCycleOrModule: boolean;
}) {
  if (isDraft || inCycleOrModule || (storeType && POPUP_STORES.has(storeType))) return false;
  return Object.entries(data ?? {}).every(([key, value]) => PANEL_FIELDS.has(key) || isBlank(value));
}

export function taskPanelDefaults(data: Partial<TIssue> | undefined, routeProjectId?: string) {
  const defaults: Partial<TNewTaskDraft> = {};
  const projectId = data?.project_id || routeProjectId;
  if (projectId) defaults.projectId = projectId;
  if (data && "section_id" in data) defaults.sectionId = data.section_id ?? null;
  if (data?.state_id) defaults.stateId = data.state_id;
  if (data?.priority) defaults.priority = data.priority;
  if (data?.assignee_ids?.length) defaults.assignees = data.assignee_ids;
  if (data?.start_date) defaults.start_date = data.start_date;
  if (data?.target_date) defaults.target_date = data.target_date;
  if (data?.name) defaults.name = data.name;
  return defaults;
}
