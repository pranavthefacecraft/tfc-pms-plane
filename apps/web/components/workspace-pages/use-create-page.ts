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
import type { TWorkspaceToolType } from "@/services/page/workspace-page.service";
// local imports
import { TOOL_TYPE_LABELS, WORKSPACE_PAGES_SWR_KEY, getWorkspacePageHref } from "./helpers";

const workspacePageService = new WorkspacePageService();

export const useCreateWorkspacePage = (workspaceSlug: string, toolType: TWorkspaceToolType = "page") => {
  const router = useAppRouter();
  const [isCreating, setIsCreating] = useState(false);

  const createPage = useCallback(async () => {
    if (!workspaceSlug) return;
    setIsCreating(true);
    try {
      const page = await workspacePageService.create(workspaceSlug, { name: "", tool_type: toolType });
      await mutate(WORKSPACE_PAGES_SWR_KEY(workspaceSlug, toolType));
      router.push(getWorkspacePageHref(workspaceSlug, page.id, toolType));
    } catch (error: unknown) {
      const message =
        (error as { error?: string } | undefined)?.error ??
        `Could not create the ${TOOL_TYPE_LABELS[toolType].singular}.`;
      setToast({ type: "error", title: "Error", message });
    } finally {
      setIsCreating(false);
    }
  }, [router, toolType, workspaceSlug]);

  return { createPage, isCreating };
};
