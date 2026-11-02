/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TaskRow } from "./my-tasks-board.helpers";

export const DUE_OPTIONS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "none", label: "No due date" },
  { id: "custom", label: "Custom date" },
] as const;
export type TDueOption = (typeof DUE_OPTIONS)[number]["id"];

export const ACCOUNT_OPTIONS = [
  { id: "personal", label: "Personal" },
  { id: "company", label: "Company" },
] as const;
export const STATUS_OPTIONS = [
  { id: "open", label: "Not completed" },
  { id: "completed", label: "Completed" },
] as const;

/** Empty groups match everything; options inside a group are OR-ed, groups are AND-ed. */
export type TTaskFilters = {
  due: TDueOption[];
  from: string;
  to: string;
  accounts: string[];
  projects: string[];
  statuses: string[];
};

export const EMPTY_FILTERS: TTaskFilters = { due: [], from: "", to: "", accounts: [], projects: [], statuses: [] };

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function filterCount(filters: TTaskFilters): number {
  return filters.due.length + filters.accounts.length + filters.projects.length + filters.statuses.length;
}

function matchesDue(row: TaskRow, option: TDueOption, today: string, filters: TTaskFilters): boolean {
  const due = row.due?.slice(0, 10);
  if (option === "none") return !due;
  if (!due) return false;
  if (option === "overdue") return due < today && !row.completed;
  if (option === "today") return due === today;
  if (option === "week") return due > today && due <= addDays(today, 7);
  return (!filters.from || due >= filters.from) && (!filters.to || due <= filters.to);
}

export function matchesTaskFilters(row: TaskRow, filters: TTaskFilters, today: string): boolean {
  const account = row.personal ? "personal" : "company";
  return (
    (!filters.due.length || filters.due.some((option) => matchesDue(row, option, today, filters))) &&
    (!filters.accounts.length || filters.accounts.includes(account)) &&
    (!filters.projects.length || (row.project ? filters.projects.includes(row.project.project_id) : false)) &&
    (!filters.statuses.length || filters.statuses.includes(row.completed ? "completed" : "open"))
  );
}
