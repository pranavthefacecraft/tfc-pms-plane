/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { GlobeOutline, LinkPageOutline, LockOutline, ProjectsOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { EFileAssetType } from "@plane/types";
import type { TNameDescriptionLoader } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
// components
import { DescriptionInput } from "@/components/editor/rich-text/description-input/root";
// hooks
import { useUser } from "@/hooks/store/user";
// services
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGE_ACCESS, WorkspacePageService } from "@/services/page/workspace-page.service";
// local imports
import { AttachWorkspacePageModal } from "./attach-page-modal";
import { WORKSPACE_PAGES_SWR_KEY, getAttachmentHref, getAttachmentLabel } from "./helpers";

const workspacePageService = new WorkspacePageService();

type Props = {
  workspaceSlug: string;
  pageId: string;
};

export const WORKSPACE_PAGE_DETAIL_SWR_KEY = (workspaceSlug: string, pageId: string) =>
  `WORKSPACE_TOOL_PAGE_${workspaceSlug}_${pageId}`;

export const WorkspacePageDetailRoot = observer(function WorkspacePageDetailRoot({ workspaceSlug, pageId }: Props) {
  // states
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<TNameDescriptionLoader>("saved");
  const [title, setTitle] = useState("");
  const lastSavedTitle = useRef("");
  // store hooks
  const { data: currentUser } = useUser();
  // fetch
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

  useEffect(() => {
    if (!page) return;
    setTitle(page.name);
    lastSavedTitle.current = page.name;
    // only sync the title when a different page is loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);

  // Freeze the editor's initial content per page so autosave responses don't reset it mid-typing.
  const initialDescription = useMemo(
    () => page?.description_html ?? "<p></p>",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page?.id]
  );

  const applyUpdate = useCallback(
    async (updatedPage: TWorkspacePage) => {
      await mutate(updatedPage, { revalidate: false });
      void globalMutate(WORKSPACE_PAGES_SWR_KEY(workspaceSlug));
    },
    [mutate, workspaceSlug]
  );

  const updatePage = useCallback(
    async (data: Parameters<WorkspacePageService["update"]>[2]) => {
      try {
        const updatedPage = await workspacePageService.update(workspaceSlug, pageId, data);
        await applyUpdate(updatedPage);
      } catch (err: unknown) {
        const message = (err as { error?: string } | undefined)?.error ?? "Could not save the page.";
        setToast({ type: "error", title: "Error", message });
        throw err;
      }
    },
    [applyUpdate, pageId, workspaceSlug]
  );

  const saveTitle = async () => {
    if (title === lastSavedTitle.current) return;
    setSaveStatus("submitting");
    try {
      await updatePage({ name: title });
      lastSavedTitle.current = title;
    } finally {
      setSaveStatus("submitted");
    }
  };

  const handleDetach = async () => {
    try {
      await workspacePageService.detach(workspaceSlug, pageId);
      if (page) await applyUpdate({ ...page, attachment: null });
      setToast({ type: "success", title: "Page detached", message: "The page is no longer attached." });
    } catch (err: unknown) {
      const message = (err as { error?: string } | undefined)?.error ?? "Could not detach the page.";
      setToast({ type: "error", title: "Error", message });
    }
  };

  useEffect(() => {
    if (saveStatus !== "submitted") return;
    const timer = setTimeout(() => setSaveStatus("saved"), 1500);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  if (isLoading) return <div className="p-page-x py-6 text-13 text-placeholder">Loading page...</div>;
  if (error || !page)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-14 font-medium text-primary">Page not found</p>
        <Link href={`/${workspaceSlug}/tool/pages/`} className="text-13 text-accent-primary hover:underline">
          Back to pages
        </Link>
      </div>
    );

  const isOwner = page.owned_by === currentUser?.id;
  const isPrivate = page.access === WORKSPACE_PAGE_ACCESS.PRIVATE;
  const attachmentLabel = getAttachmentLabel(page.attachment);
  const attachmentHref = getAttachmentHref(workspaceSlug, page.attachment);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-page-x py-8">
        <div className="flex flex-wrap items-center gap-2 text-12 text-tertiary">
          <div className="flex items-center gap-1.5 rounded-md border border-subtle px-2 py-1">
            <LinkPageOutline className="size-3.5" />
            {page.attachment ? (
              <>
                <span>Attached to</span>
                {page.attachment.entity_type === "issue" ? (
                  <WorkItemsOutline className="size-3.5" />
                ) : (
                  <ProjectsOutline className="size-3.5" />
                )}
                {attachmentHref ? (
                  <Link href={attachmentHref} className="max-w-[240px] truncate text-secondary hover:underline">
                    {attachmentLabel}
                  </Link>
                ) : (
                  <span className="max-w-[240px] truncate">{attachmentLabel}</span>
                )}
              </>
            ) : (
              <span>Not attached</span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={page.attachment ? "Change" : "Attach to task or project"}
            onClick={() => setIsAttachModalOpen(true)}
          />
          {page.attachment && (
            <Button variant="secondary" size="sm" stretch="auto" label="Detach" onClick={() => void handleDetach()} />
          )}
          <button
            type="button"
            disabled={!isOwner}
            title={isOwner ? "Toggle access" : "Only the owner can change access"}
            onClick={() =>
              void updatePage({
                access: isPrivate ? WORKSPACE_PAGE_ACCESS.PUBLIC : WORKSPACE_PAGE_ACCESS.PRIVATE,
              })
            }
            className="flex items-center gap-1.5 rounded-md border border-subtle px-2 py-1 hover:bg-layer-1-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPrivate ? <LockOutline className="size-3.5" /> : <GlobeOutline className="size-3.5" />}
            {isPrivate ? "Private" : "Public"}
          </button>
          <span className="ml-auto">
            {saveStatus === "submitting"
              ? "Saving..."
              : saveStatus === "submitted"
                ? "Saved"
                : `Edited ${calculateTimeAgo(page.updated_at)}`}
          </span>
        </div>

        <textarea
          value={title}
          onChange={(event) => setTitle(event.target.value.replace(/\n/g, ""))}
          onBlur={() => void saveTitle()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder="Untitled"
          rows={1}
          maxLength={255}
          aria-label="Page title"
          className="w-full resize-none bg-transparent text-[2rem] leading-tight font-bold text-primary outline-none placeholder:text-placeholder"
        />

        <DescriptionInput
          key={page.id}
          entityId={page.id}
          workspaceSlug={workspaceSlug}
          fileAssetType={EFileAssetType.PAGE_DESCRIPTION}
          initialValue={initialDescription}
          containerClassName="min-h-[400px] !pl-0 border-none"
          placeholder="Start writing..."
          setIsSubmitting={setSaveStatus}
          onSubmit={async ({ description_html }) => {
            await updatePage({ description_html });
          }}
        />
      </div>

      <AttachWorkspacePageModal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        workspaceSlug={workspaceSlug}
        page={page}
        onAttached={(updatedPage) => void applyUpdate(updatedPage)}
      />
    </div>
  );
});
