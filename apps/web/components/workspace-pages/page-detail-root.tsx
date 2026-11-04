/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import { EFileAssetType } from "@plane/types";
import type { EditorRefApi } from "@plane/editor";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// components
import { DescriptionInput } from "@/components/editor/rich-text/description-input/root";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
// local imports
import { AttachWorkspacePageModal } from "./attach-page-modal";
import { getWorkspacePageName, getWorkspaceToolListHref } from "./helpers";
import { WorkspaceToolPageMetaBar } from "./page-meta-bar";
import { WorkspaceToolPageTitleInput } from "./page-title-input";
import { useWorkspaceToolPage } from "./use-workspace-tool-page";
import { NotepadToolbar } from "./notepad-toolbar";

type Props = {
  workspaceSlug: string;
  pageId: string;
};

export const WorkspacePageDetailRoot = observer(function WorkspacePageDetailRoot({ workspaceSlug, pageId }: Props) {
  // states
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  const editorRef = useRef<EditorRefApi | null>(null);
  // store hooks
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const canEdit = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const { page, error, isLoading, saveStatus, setSaveStatus, applyUpdate, updatePage, detach, toggleAccess } =
    useWorkspaceToolPage(workspaceSlug, pageId);

  // Freeze the editor's initial content per page so autosave responses don't reset it mid-typing.
  const initialDescription = useMemo(
    () => page?.description_html ?? "<p></p>",
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [page?.id]
  );

  if (isLoading) return <div className="p-page-x py-6 text-13 text-placeholder">Loading page...</div>;
  if (error || !page)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-14 font-medium text-primary">Page not found</p>
        <Link href={getWorkspaceToolListHref(workspaceSlug)} className="text-13 text-accent-primary hover:underline">
          Back to pages
        </Link>
      </div>
    );

  const save = async (data: Parameters<typeof updatePage>[0]) => {
    try {
      const updated = await updatePage(data);
      setSaveError("");
      return updated;
    } catch (cause) {
      setSaveError("Could not save your changes. Please try editing again.");
      throw cause;
    }
  };
  const collaborators = [
    ...new Map([page.owner, page.updated_by].filter((user) => user !== null).map((user) => [user.id, user])).values(),
  ];

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-7">
      <h1 className="text-24 font-semibold">Notepad</h1>
      <div className="my-6 flex items-center justify-between gap-4 text-12">
        <nav aria-label="Notepad breadcrumb" className="flex min-w-0 items-center gap-3">
          <Link href={getWorkspaceToolListHref(workspaceSlug)} className="shrink-0 text-secondary hover:underline">
            All pages
          </Link>
          <span aria-hidden="true" className="text-tertiary">
            /
          </span>
          <span className="truncate font-medium">
            {page.name?.trim() ? getWorkspacePageName(page) : "Untitled page"}
          </span>
        </nav>
        <p role="status" className={`shrink-0 text-12 ${saveError ? "text-danger-primary" : "text-tertiary"}`}>
          {saveError ? "Not saved" : saveStatus === "submitting" ? "Saving..." : "Saved"}
        </p>
      </div>
      <section
        aria-label="Notepad editor"
        className="min-h-[600px] rounded-lg border border-[#E2E6EF] bg-surface-1 p-5 md:px-8 md:py-7"
      >
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          <WorkspaceToolPageTitleInput
            page={page}
            onSave={(name) => save({ name })}
            setSaveStatus={setSaveStatus}
            className="text-24 !font-semibold"
            placeholder="Untitled Page"
            disabled={!canEdit}
          />
          <div className="flex flex-wrap items-center gap-2 text-12 text-secondary">
            <span title="Owner and most recent editor">Collaborators:</span>
            {collaborators.map((user) => (
              <span key={user.id} className="rounded-full bg-layer-1 px-2 py-1">
                {user.display_name || user.first_name}
              </span>
            ))}
            <span className="text-tertiary">
              {page.access === 1 ? "Private · Owner access" : "Public · Workspace access"}
            </span>
          </div>
          <NotepadToolbar
            editorRef={editorRef}
            ready={editorReady}
            disabled={!canEdit}
            onAttach={() => setIsAttachModalOpen(true)}
          />
          {saveError && (
            <p role="alert" className="text-12 text-danger-primary">
              {saveError}
            </p>
          )}
          <DescriptionInput
            key={page.id}
            entityId={page.id}
            workspaceSlug={workspaceSlug}
            fileAssetType={EFileAssetType.PAGE_DESCRIPTION}
            initialValue={initialDescription}
            editorRef={editorRef}
            onEditorReady={setEditorReady}
            disabled={!canEdit}
            containerClassName="min-h-[400px] !pl-0 border-none"
            placeholder="Start writing or type / for options"
            setIsSubmitting={setSaveStatus}
            onSubmit={async ({ description_html }) => {
              await save({ description_html });
            }}
          />
          <details className="border-t border-subtle pt-3 text-12 text-secondary">
            <summary className="cursor-pointer">Attachment and access settings</summary>
            <WorkspaceToolPageMetaBar
              workspaceSlug={workspaceSlug}
              page={page}
              isOwner={page.owned_by === currentUser?.id}
              saveStatus={saveStatus}
              onAttachClick={() => setIsAttachModalOpen(true)}
              onDetach={() => void detach()}
              onToggleAccess={toggleAccess}
              readOnly={!canEdit}
              className="mt-3"
            />
          </details>
        </div>
      </section>

      {canEdit && (
        <AttachWorkspacePageModal
          isOpen={isAttachModalOpen}
          onClose={() => setIsAttachModalOpen(false)}
          workspaceSlug={workspaceSlug}
          page={page}
          onAttached={applyUpdate}
        />
      )}
    </div>
  );
});
