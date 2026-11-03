/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";

export type TProjectPageTab = "overview" | "list" | "board" | "calendar" | "timeline" | "files";

const TABS: { id: TProjectPageTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
  { id: "calendar", label: "Project Calendar" },
  { id: "timeline", label: "Timeline" },
  { id: "files", label: "Files" },
];

const tabClass = (active: boolean) =>
  `-mb-px border-b-2 px-2 pt-1 pb-2.5 text-13 whitespace-nowrap transition-colors ${
    active ? "border-[#135DDD] font-medium text-primary" : "border-transparent text-secondary hover:text-primary"
  }`;

/** Figma project header: letter tile, project name and the Overview / List / Board / Calendar / Timeline / Files tabs. */
export const ProjectPageHeader = observer(function ProjectPageHeader({
  workspaceSlug,
  projectId,
  name,
  active,
}: {
  workspaceSlug: string;
  projectId: string;
  name: string;
  active: TProjectPageTab;
}) {
  const base = `/${workspaceSlug}/projects/${projectId}`;

  return (
    <header className="px-6 pt-6 md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-md bg-[#EAF1FD] text-15 font-semibold text-[#135DDD]"
        >
          {name.trim().charAt(0).toUpperCase() || "P"}
        </span>
        <h1 className="truncate text-24 font-semibold text-primary">{name}</h1>
      </div>
      <nav aria-label="Project views" className="mt-6 flex gap-4 overflow-x-auto border-b border-subtle">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`${base}/${tab.id}`}
            aria-current={active === tab.id ? "page" : undefined}
            className={tabClass(active === tab.id)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
});
