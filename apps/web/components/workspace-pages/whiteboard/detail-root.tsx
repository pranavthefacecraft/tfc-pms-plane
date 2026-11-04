/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Suspense, lazy, useCallback, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useTheme } from "next-themes";
// plane imports
// hooks
import { useUser } from "@/hooks/store/user";
import { useWhiteboardCollaboration } from "./collaboration";
import { WhiteboardSharing } from "./sharing";
// local imports
import { getWorkspaceToolListHref } from "../helpers";
import { WorkspaceToolPageMetaBar } from "../page-meta-bar";
import { WorkspaceToolPageTitleInput } from "../page-title-input";
import { useWorkspaceToolPage } from "../use-workspace-tool-page";
import { LinkWorkspacePagePopover } from "../link-page-popover";
import { Maximize2, Minimize2, MoreHorizontal, SquarePen, X } from "lucide-react";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";

const WhiteboardCanvas = lazy(() => import("./canvas"));

type Props = {
  workspaceSlug: string;
  pageId: string;
};

const CanvasFallback = () => (
  <div className="flex h-full w-full items-center justify-center text-13 text-placeholder">Loading whiteboard...</div>
);

export const WhiteboardDetailRoot = observer(function WhiteboardDetailRoot({ workspaceSlug, pageId }: Props) {
  // states
  const [expanded, setExpanded] = useState(false);
  // hooks
  const { resolvedTheme } = useTheme();
  const { data: currentUser } = useUser();
  const collaboration = useWhiteboardCollaboration(workspaceSlug, pageId);
  const { page, error, isLoading, saveStatus, setSaveStatus, applyUpdate, updatePage, detach, toggleAccess } =
    useWorkspaceToolPage(workspaceSlug, pageId);
  const canEdit =
    collaboration.connected &&
    !!collaboration.state &&
    collaboration.state.role !== "viewer" &&
    !collaboration.state.presenter;

  const handleDirtyChange = useCallback(
    (isDirty: boolean) => {
      setSaveStatus(isDirty ? "submitting" : "submitted");
    },
    [setSaveStatus]
  );

  if (isLoading) return <CanvasFallback />;
  if (error || !page || page.tool_type !== "whiteboard")
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-14 font-medium text-primary">Whiteboard not found</p>
        <Link
          href={getWorkspaceToolListHref(workspaceSlug, "whiteboard")}
          className="text-13 text-accent-primary hover:underline"
        >
          Back to whiteboards
        </Link>
      </div>
    );

  return (
    <div className={expanded ? "fixed inset-0 z-40 bg-surface-1 p-3" : "h-full w-full p-4 md:p-6"}>
      <section
        aria-label="Whiteboard editor"
        className="relative h-full min-h-[420px] overflow-hidden rounded-lg border border-[#E2E6EF] bg-surface-1 dark:border-subtle"
      >
        <Suspense fallback={<CanvasFallback />}>
          <WhiteboardCanvas
            key={page.id}
            workspaceSlug={workspaceSlug}
            boardId={page.id}
            initialScene={page.description_json}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            collaboration={collaboration}
            onDirtyChange={handleDirtyChange}
            header={
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-h-9 w-60 max-w-full items-center gap-2 rounded-md border border-[#E2E6EF] bg-surface-1 px-2 py-1.5 dark:border-subtle">
                  <SquarePen size={18} className="shrink-0 rounded bg-[#FFF2B8] p-0.5 text-[#B77900]" />
                  <WorkspaceToolPageTitleInput
                    page={page}
                    onSave={(name) => updatePage({ name })}
                    setSaveStatus={setSaveStatus}
                    className="min-w-0 flex-1 text-12 !font-semibold"
                    placeholder="Untitled Whiteboard"
                    disabled={!canEdit}
                  />
                </div>
                <LinkWorkspacePagePopover
                  workspaceSlug={workspaceSlug}
                  page={page}
                  onAttached={applyUpdate}
                  disabled={!canEdit}
                />
                <div className="flex min-h-9 items-center gap-1 rounded-md border border-[#E2E6EF] bg-surface-1 px-2 py-1 dark:border-subtle">
                  {page.owned_by === currentUser?.id && (
                    <WhiteboardSharing workspaceSlug={workspaceSlug} boardId={pageId} />
                  )}
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Whiteboard settings"
                          className="rounded p-1.5 text-secondary hover:bg-layer-1"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      }
                    />
                    <PopoverContent side="bottom" align="end" sideOffset={8}>
                      <PopoverBody>
                        <div className="w-72 max-w-[calc(100vw-32px)] space-y-3">
                          <h2 className="text-13 font-semibold">Whiteboard settings</h2>
                          <WorkspaceToolPageMetaBar
                            workspaceSlug={workspaceSlug}
                            page={page}
                            isOwner={page.owned_by === currentUser?.id}
                            readOnly={!canEdit}
                            saveStatus={saveStatus}
                            onDetach={() => void detach()}
                            onToggleAccess={toggleAccess}
                            attachmentControl={
                              <LinkWorkspacePagePopover
                                workspaceSlug={workspaceSlug}
                                page={page}
                                onAttached={applyUpdate}
                                disabled={!canEdit}
                              />
                            }
                          />
                        </div>
                      </PopoverBody>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    aria-label={expanded ? "Exit expanded whiteboard" : "Expand whiteboard"}
                    onClick={() => setExpanded((value) => !value)}
                    className="rounded p-1.5 text-secondary hover:bg-layer-1"
                  >
                    {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <Link
                    href={getWorkspaceToolListHref(workspaceSlug, "whiteboard")}
                    aria-label="Close whiteboard"
                    className="rounded p-1.5 text-secondary hover:bg-layer-1"
                  >
                    <X size={16} />
                  </Link>
                </div>
              </div>
            }
          />
        </Suspense>
      </section>
    </div>
  );
});
