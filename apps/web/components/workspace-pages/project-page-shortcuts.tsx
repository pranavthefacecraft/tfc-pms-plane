/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import useSWR from "swr";
import { WorkspacePageService } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGES_SWR_KEY, getToolTypeIcon, getWorkspacePageHref, getWorkspacePageName } from "./helpers";

const workspacePageService = new WorkspacePageService();

export function ProjectPageShortcuts({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  // Share the tool caches so attachment and title changes refresh these links too.
  const pagesResult = useSWR(
    WORKSPACE_PAGES_SWR_KEY(workspaceSlug),
    () => workspacePageService.list(workspaceSlug, { type: "page" }),
    { refreshInterval: 30_000 }
  );
  const boardsResult = useSWR(
    WORKSPACE_PAGES_SWR_KEY(workspaceSlug, "whiteboard"),
    () => workspacePageService.list(workspaceSlug, { type: "whiteboard" }),
    { refreshInterval: 30_000 }
  );
  const error = pagesResult.error || boardsResult.error;
  const pages = [...(pagesResult.data ?? []), ...(boardsResult.data ?? [])].filter(
    (page) =>
      page.attachment?.entity_type === "project" &&
      page.attachment.project_id === projectId &&
      page.attachment.is_accessible
  );

  async function retry() {
    try {
      await Promise.all([pagesResult.mutate(), boardsResult.mutate()]);
    } catch (refreshError) {
      console.error("Could not refresh project page shortcuts", refreshError);
    }
  }

  if (!error && !pages?.length) return null;

  return (
    <nav
      aria-label="Project pages and whiteboards"
      className="flex max-w-[35%] min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-l border-subtle px-2"
    >
      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-1 text-12 text-secondary">
          <span>Could not refresh pages or whiteboards.</span>
          <button type="button" onClick={() => void retry()} className="text-accent-primary hover:underline">
            Retry
          </button>
        </div>
      )}
      {pages?.map((page) => {
        const Icon = getToolTypeIcon(page.tool_type);
        const name = getWorkspacePageName(page);
        return (
          <Link
            key={page.id}
            href={getWorkspacePageHref(workspaceSlug, page.id, page.tool_type)}
            title={name}
            className="focus-visible:outline-accent-primary flex max-w-44 shrink-0 items-center gap-1.5 rounded px-2 py-1 text-13 text-secondary hover:bg-layer-1-hover hover:text-primary focus-visible:outline focus-visible:outline-2"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 text-tertiary" />
            <span className="truncate">{name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
