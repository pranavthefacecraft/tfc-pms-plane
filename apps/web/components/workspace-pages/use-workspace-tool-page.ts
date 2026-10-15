/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { setToast } from "@plane/blocks/toast";
import type { TNameDescriptionLoader } from "@plane/types";
// services
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGE_ACCESS, WorkspacePageService } from "@/services/page/workspace-page.service";
// local imports
import { TOOL_TYPE_LABELS, WORKSPACE_PAGES_SWR_KEY, WORKSPACE_PAGE_DETAIL_SWR_KEY } from "./helpers";

const workspacePageService = new WorkspacePageService();

const getErrorMessage = (error: unknown, fallback: string) =>
  (error as { error?: string } | undefined)?.error ?? fallback;

export const useWorkspaceToolPage = (workspaceSlug: string, pageId: string) => {
  const [saveStatus, setSaveStatus] = useState<TNameDescriptionLoader>("saved");

  const {
    data: page,
    error,
    isLoading,
    mutate,
  } = useSWR(
    workspaceSlug && pageId ? WORKSPACE_PAGE_DETAIL_SWR_KEY(workspaceSlug, pageId) : null,
    workspaceSlug && pageId ? () => workspacePageService.retrieve(workspaceSlug, pageId) : null,
    { revalidateOnFocus: false }
  );

  const label = TOOL_TYPE_LABELS[page?.tool_type ?? "page"].singular;

  const applyUpdate = useCallback(
    async (updatedPage: TWorkspacePage) => {
      await mutate(updatedPage, { revalidate: false });
      void globalMutate(WORKSPACE_PAGES_SWR_KEY(workspaceSlug, updatedPage.tool_type));
    },
    [mutate, workspaceSlug]
  );

  const updatePage = useCallback(
    async (data: Parameters<WorkspacePageService["update"]>[2]) => {
      try {
        const updatedPage = await workspacePageService.update(workspaceSlug, pageId, data);
        await applyUpdate(updatedPage);
        return updatedPage;
      } catch (err: unknown) {
        setToast({ type: "error", title: "Error", message: getErrorMessage(err, `Could not save the ${label}.`) });
        throw err;
      }
    },
    [applyUpdate, label, pageId, workspaceSlug]
  );

  const detach = useCallback(async () => {
    if (!page) return;
    try {
      await workspacePageService.detach(workspaceSlug, pageId);
      await applyUpdate({ ...page, attachment: null });
      setToast({ type: "success", title: "Detached", message: `The ${label} is no longer attached.` });
    } catch (err: unknown) {
      setToast({ type: "error", title: "Error", message: getErrorMessage(err, `Could not detach the ${label}.`) });
    }
  }, [applyUpdate, label, page, pageId, workspaceSlug]);

  const toggleAccess = useCallback(() => {
    if (!page) return;
    const access =
      page.access === WORKSPACE_PAGE_ACCESS.PRIVATE ? WORKSPACE_PAGE_ACCESS.PUBLIC : WORKSPACE_PAGE_ACCESS.PRIVATE;
    void updatePage({ access }).catch(() => undefined);
  }, [page, updatePage]);

  useEffect(() => {
    if (saveStatus !== "submitted") return;
    const timer = setTimeout(() => setSaveStatus("saved"), 1500);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  return {
    page,
    error,
    isLoading,
    label,
    saveStatus,
    setSaveStatus,
    applyUpdate,
    updatePage,
    detach,
    toggleAccess,
  };
};
