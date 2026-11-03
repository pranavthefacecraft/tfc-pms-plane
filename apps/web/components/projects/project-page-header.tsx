/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { Settings } from "lucide-react";

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

/**
 * Figma project header: letter tile, project name, the Overview / List / Board / Calendar / Timeline / Files tabs
 * and a gear linking to project settings.
 */
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
      <div className="mt-6 flex items-end gap-4 border-b border-subtle">
        <nav aria-label="Project views" className="flex min-w-0 flex-1 gap-4 overflow-x-auto">
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
        <Link
          href={`/${workspaceSlug}/settings/projects/${projectId}`}
          aria-label="Project settings"
          title="Project settings"
          className="mb-1.5 grid size-8 shrink-0 place-items-center rounded text-secondary hover:bg-layer-1-hover hover:text-primary"
        >
          <Settings className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
});
