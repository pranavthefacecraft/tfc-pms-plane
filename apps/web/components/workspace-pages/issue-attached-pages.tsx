/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
// plane imports
import { AddOutline, PagesOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { calculateTimeAgo } from "@plane/utils";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// services
import { WorkspacePageService } from "@/services/page/workspace-page.service";
// local imports
import {
  ISSUE_WORKSPACE_PAGES_SWR_KEY,
  WORKSPACE_PAGES_SWR_KEY,
  getWorkspacePageHref,
  getWorkspacePageName,
} from "./helpers";

const workspacePageService = new WorkspacePageService();

type Props = {
  workspaceSlug: string;
  issueId: string;
  disabled: boolean;
};

export const IssueAttachedPages = observer(function IssueAttachedPages({ workspaceSlug, issueId, disabled }: Props) {
  const router = useAppRouter();
  const [isCreating, setIsCreating] = useState(false);

  const { data: pages } = useSWR(
    workspaceSlug && issueId ? ISSUE_WORKSPACE_PAGES_SWR_KEY(workspaceSlug, issueId) : null,
    workspaceSlug && issueId ? () => workspacePageService.list(workspaceSlug, { issue_id: issueId }) : null,
    { revalidateOnFocus: false }
  );

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const page = await workspacePageService.create(workspaceSlug, { name: "" });
      await workspacePageService.attach(workspaceSlug, page.id, { entity_type: "issue", entity_id: issueId });
      void globalMutate(WORKSPACE_PAGES_SWR_KEY(workspaceSlug));
      void globalMutate(ISSUE_WORKSPACE_PAGES_SWR_KEY(workspaceSlug, issueId));
      router.push(getWorkspacePageHref(workspaceSlug, page.id));
    } catch (error: unknown) {
      const message = (error as { error?: string } | undefined)?.error ?? "Could not create the page.";
      setToast({ type: "error", title: "Error", message });
    } finally {
      setIsCreating(false);
    }
  };

  if (disabled && (!pages || pages.length === 0)) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-14 font-medium text-primary">Pages</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isCreating}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-12 text-tertiary hover:bg-layer-1-hover hover:text-secondary disabled:opacity-60"
          >
            <AddOutline className="size-3.5" />
            {isCreating ? "Creating..." : "New page"}
          </button>
        )}
      </div>
      {pages && pages.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={getWorkspacePageHref(workspaceSlug, page.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-13 text-secondary hover:bg-layer-1-hover"
            >
              <PagesOutline className="size-4 flex-shrink-0 text-tertiary" />
              <span className="truncate">{getWorkspacePageName(page)}</span>
              <span className="ml-auto flex-shrink-0 text-11 text-placeholder">
                {calculateTimeAgo(page.updated_at)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-12 text-placeholder">
          No pages attached. Create one here or attach an existing page from Tool → Pages.
        </p>
      )}
    </div>
  );
});
