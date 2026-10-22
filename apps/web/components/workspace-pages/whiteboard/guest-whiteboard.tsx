/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
import { useTheme } from "next-themes";
import { useWorkspaceToolPage } from "../use-workspace-tool-page";
import { useWhiteboardCollaboration } from "./collaboration";

const WhiteboardCanvas = lazy(() => import("./canvas"));

export function GuestWhiteboard({ workspaceSlug, pageId }: { workspaceSlug: string; pageId: string }) {
  const { resolvedTheme } = useTheme();
  const { page, error, isLoading } = useWorkspaceToolPage(workspaceSlug, pageId);
  const collaboration = useWhiteboardCollaboration(workspaceSlug, pageId);
  if (isLoading)
    return (
      <p role="status" className="m-auto">
        Loading whiteboard...
      </p>
    );
  if (error || !page)
    return (
      <p role="alert" className="m-auto">
        Whiteboard unavailable. Guest access may have been removed.
      </p>
    );
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b border-subtle px-page-x py-3">
        <h1 className="truncate text-18 font-bold">{page.name || "Untitled whiteboard"}</h1>
        <span className="text-13 text-secondary">
          Guest · {collaboration.state?.role === "editor" ? "Editor" : "Viewer"}
        </span>
      </header>
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<p role="status">Loading canvas...</p>}>
          <WhiteboardCanvas
            workspaceSlug={workspaceSlug}
            boardId={pageId}
            initialScene={page.description_json}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            collaboration={collaboration}
          />
        </Suspense>
      </div>
    </div>
  );
}
