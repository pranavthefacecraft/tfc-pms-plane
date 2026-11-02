/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useNavigate } from "react-router";
import Link from "next/link";
import { EIssueFilterType } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";

export type TProjectPageTab = "overview" | "files";

const LAYOUT_TABS = [
  { label: "List", layout: EIssueLayoutTypes.LIST },
  { label: "Board", layout: EIssueLayoutTypes.KANBAN },
  { label: "Project Calendar", layout: EIssueLayoutTypes.CALENDAR },
  { label: "Timeline", layout: EIssueLayoutTypes.GANTT },
] as const;

const tabClass = (active: boolean) =>
  `-mb-px border-b-2 px-2 pt-1 pb-2.5 text-13 whitespace-nowrap transition-colors ${
    active ? "border-[#135DDD] font-medium text-primary" : "border-transparent text-secondary hover:text-primary"
  }`;

/** Figma project header: letter tile, project name and the Overview / layouts / Files tabs. */
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
  const navigate = useNavigate();
  const { issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  const base = `/${workspaceSlug}/projects/${projectId}`;

  async function openLayout(layout: EIssueLayoutTypes) {
    try {
      // Work item filters are not loaded yet when the project is opened on Overview or Files.
      if (!issuesFilter.getIssueFilters(projectId)) await issuesFilter.fetchFilters(workspaceSlug, projectId);
      await issuesFilter.updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout });
      navigate(`${base}/issues`);
    } catch (error) {
      console.error("Could not open the selected work item layout", error);
      setToast({ type: "error", title: "Could not open work items", message: "Please try again." });
    }
  }

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
        <Link
          href={`${base}/overview`}
          aria-current={active === "overview" ? "page" : undefined}
          className={tabClass(active === "overview")}
        >
          Overview
        </Link>
        {LAYOUT_TABS.map((tab) => (
          <button
            key={tab.layout}
            type="button"
            className={tabClass(false)}
            onClick={() => void openLayout(tab.layout)}
          >
            {tab.label}
          </button>
        ))}
        <Link
          href={`${base}/files`}
          aria-current={active === "files" ? "page" : undefined}
          className={tabClass(active === "files")}
        >
          Files
        </Link>
      </nav>
    </header>
  );
});
