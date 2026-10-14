/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { mutate } from "swr";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// services
import { WorkspacePageService } from "@/services/page/workspace-page.service";
// local imports
import { WORKSPACE_PAGES_SWR_KEY, getWorkspacePageHref } from "./helpers";

const workspacePageService = new WorkspacePageService();

export const useCreateWorkspacePage = (workspaceSlug: string) => {
  const router = useAppRouter();
  const [isCreating, setIsCreating] = useState(false);

  const createPage = useCallback(async () => {
    if (!workspaceSlug) return;
    setIsCreating(true);
    try {
      const page = await workspacePageService.create(workspaceSlug, { name: "" });
      await mutate(WORKSPACE_PAGES_SWR_KEY(workspaceSlug));
      router.push(getWorkspacePageHref(workspaceSlug, page.id));
    } catch (error: unknown) {
      const message = (error as { error?: string } | undefined)?.error ?? "Could not create the page.";
      setToast({ type: "error", title: "Error", message });
    } finally {
      setIsCreating(false);
    }
  }, [router, workspaceSlug]);

  return { createPage, isCreating };
};
