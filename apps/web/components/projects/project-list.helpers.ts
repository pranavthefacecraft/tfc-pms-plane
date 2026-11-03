/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssuePriorities } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
import { addDays } from "@/components/profile/my-tasks-filters.helpers";
import type { TProjectSection } from "@/services/project/project-section.service";
import type { TProjectListTask } from "@/services/project/project-task-list.service";

export const PRIORITY_LABELS: Record<TIssuePriorities, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export const LIST_STATUS_OPTIONS = [
  { id: "open", label: "Not completed" },
  { id: "completed", label: "Completed" },
] as const;
export const LIST_PRIORITY_OPTIONS = (["urgent", "high", "medium", "low", "none"] as const).map((id) => ({
  id,
  label: PRIORITY_LABELS[id],
}));
export const LIST_DUE_OPTIONS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "none", label: "No due date" },
] as const;
export const LIST_ASSIGNEE_OPTIONS = [
  { id: "me", label: "Assigned to me" },
  { id: "unassigned", label: "Unassigned" },
] as const;

/** Empty groups match everything; options inside a group are OR-ed, groups are AND-ed. */
export type TProjectListFilters = { statuses: string[]; priorities: string[]; due: string[]; assignees: string[] };
export type TProjectListFilterKey = keyof TProjectListFilters;

export const EMPTY_LIST_FILTERS: TProjectListFilters = { statuses: [], priorities: [], due: [], assignees: [] };

export type TProjectListGroup = { key: string; sectionId: string | null; name: string; tasks: TProjectListTask[] };

export const NO_SECTION_KEY = "no-section";

export const isCompleted = (task: TProjectListTask) => task.state_group === "completed";

export function listFilterCount(filters: TProjectListFilters): number {
  return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

function matchesDue(task: TProjectListTask, option: string, today: string): boolean {
  const due = task.target_date?.slice(0, 10);
  if (option === "none") return !due;
  if (!due) return false;
  if (option === "overdue") return due < today && !isCompleted(task);
  if (option === "today") return due === today;
  return due > today && due <= addDays(today, 7);
}

function matchesAssignee(task: TProjectListTask, option: string, userId?: string): boolean {
  if (option === "unassigned") return !task.assignee_ids.length;
  return Boolean(userId && task.assignee_ids.includes(userId));
}

export function matchesListFilters(
  task: TProjectListTask,
  filters: TProjectListFilters,
  today: string,
  userId?: string
): boolean {
  return (
    (!filters.statuses.length || filters.statuses.includes(isCompleted(task) ? "completed" : "open")) &&
    (!filters.priorities.length || filters.priorities.includes(task.priority ?? "none")) &&
    (!filters.due.length || filters.due.some((option) => matchesDue(task, option, today))) &&
    (!filters.assignees.length || filters.assignees.some((option) => matchesAssignee(task, option, userId)))
  );
}

/**
 * Groups tasks under the project's sections in section order, then "No section". "No section" is shown when it has
 * tasks or when the project has no sections, so there is always somewhere to add a task.
 */
export function groupTasksBySection(tasks: TProjectListTask[], sections: TProjectSection[]): TProjectListGroup[] {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy; the lib target lacks toSorted
  const ordered = [...sections].sort((left, right) => left.sort_order - right.sort_order);
  const known = new Set(ordered.map((section) => section.id));
  const groups: TProjectListGroup[] = ordered.map((section) => ({
    key: section.id,
    sectionId: section.id,
    name: section.name,
    tasks: tasks.filter((task) => task.section_id === section.id),
  }));
  const unsectioned = tasks.filter((task) => !task.section_id || !known.has(task.section_id));
  if (unsectioned.length || !groups.length)
    groups.push({ key: NO_SECTION_KEY, sectionId: null, name: "No section", tasks: unsectioned });
  return groups;
}

export function dueDateDetails(task: TProjectListTask, today: string) {
  const due = task.target_date?.slice(0, 10);
  if (!due) return { label: "—", className: "text-placeholder" };
  if (isCompleted(task)) return { label: renderFormattedDate(due) ?? due, className: "text-secondary" };
  if (due === today) return { label: "Today", className: "font-medium text-[#009E79]" };
  if (due < today) return { label: renderFormattedDate(due) ?? due, className: "text-[#DC3E42]" };
  return { label: renderFormattedDate(due) ?? due, className: "text-primary" };
}
