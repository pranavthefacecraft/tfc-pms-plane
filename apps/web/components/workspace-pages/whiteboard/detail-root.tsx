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
import { EUserPermissionsLevel } from "@plane/constants";
import { EUserWorkspaceRoles } from "@plane/types";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
// local imports
import { AttachWorkspacePageModal } from "../attach-page-modal";
import { getWorkspaceToolListHref } from "../helpers";
import { WorkspaceToolPageMetaBar } from "../page-meta-bar";
import { WorkspaceToolPageTitleInput } from "../page-title-input";
import { useWorkspaceToolPage } from "../use-workspace-tool-page";

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
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  // hooks
  const { resolvedTheme } = useTheme();
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { page, error, isLoading, saveStatus, setSaveStatus, applyUpdate, updatePage, detach, toggleAccess } =
    useWorkspaceToolPage(workspaceSlug, pageId);
  const canEdit = allowPermissions(
    [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const handleSaveScene = useCallback(
    async (scene: Record<string, unknown>) => {
      setSaveStatus("submitting");
      await updatePage({ description_json: scene });
    },
    [setSaveStatus, updatePage]
  );

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
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-subtle px-page-x py-2">
        <WorkspaceToolPageTitleInput
          page={page}
          onSave={(name) => updatePage({ name })}
          setSaveStatus={setSaveStatus}
          className="max-w-md min-w-[200px] flex-1 text-18"
        />
        <WorkspaceToolPageMetaBar
          workspaceSlug={workspaceSlug}
          page={page}
          isOwner={page.owned_by === currentUser?.id}
          saveStatus={saveStatus}
          onAttachClick={() => setIsAttachModalOpen(true)}
          onDetach={() => void detach()}
          onToggleAccess={toggleAccess}
          className="flex-1"
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<CanvasFallback />}>
          <WhiteboardCanvas
            key={page.id}
            workspaceSlug={workspaceSlug}
            boardId={page.id}
            initialScene={page.description_json}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            readOnly={!canEdit}
            onSave={handleSaveScene}
            onDirtyChange={handleDirtyChange}
          />
        </Suspense>
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
