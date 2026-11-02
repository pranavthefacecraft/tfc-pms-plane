/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TProject } from "@plane/types";

export type TSortDirection = "asc" | "desc";

function modifiedTime(project: TProject): number {
  const value = project.updated_at ?? project.created_at;
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

export function browseProjects(projects: TProject[], query: string, direction: TSortDirection): TProject[] {
  const term = query.trim().toLocaleLowerCase();
  return (
    projects
      .filter(
        (project) =>
          !term ||
          project.name.toLocaleLowerCase().includes(term) ||
          project.identifier.toLocaleLowerCase().includes(term)
      )
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array from filter(); the lib target lacks toSorted
      .sort((a, b) => {
        const difference = modifiedTime(a) - modifiedTime(b);
        return (direction === "asc" ? difference : -difference) || a.name.localeCompare(b.name);
      })
  );
}

/** "Today" for the current local day, otherwise e.g. "Oct 26" (with the year when it differs). */
export function lastModifiedLabel(value: Date | string | undefined, now: Date): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (date.toDateString() === now.toDateString()) return "Today";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}
