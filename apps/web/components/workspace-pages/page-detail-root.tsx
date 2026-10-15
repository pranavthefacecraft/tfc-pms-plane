/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import { EFileAssetType } from "@plane/types";
// components
import { DescriptionInput } from "@/components/editor/rich-text/description-input/root";
// hooks
import { useUser } from "@/hooks/store/user";
// local imports
import { AttachWorkspacePageModal } from "./attach-page-modal";
import { getWorkspaceToolListHref } from "./helpers";
import { WorkspaceToolPageMetaBar } from "./page-meta-bar";
import { WorkspaceToolPageTitleInput } from "./page-title-input";
import { useWorkspaceToolPage } from "./use-workspace-tool-page";

type Props = {
  workspaceSlug: string;
  pageId: string;
};

export const WorkspacePageDetailRoot = observer(function WorkspacePageDetailRoot({ workspaceSlug, pageId }: Props) {
  // states
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  // store hooks
  const { data: currentUser } = useUser();
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

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-page-x py-8">
        <WorkspaceToolPageMetaBar
          workspaceSlug={workspaceSlug}
          page={page}
          isOwner={page.owned_by === currentUser?.id}
          saveStatus={saveStatus}
          onAttachClick={() => setIsAttachModalOpen(true)}
          onDetach={() => void detach()}
          onToggleAccess={toggleAccess}
        />

        <WorkspaceToolPageTitleInput
          page={page}
          onSave={(name) => updatePage({ name })}
          setSaveStatus={setSaveStatus}
          className="text-[2rem]"
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
