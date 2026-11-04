/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import type { ReactNode } from "react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { GlobeOutline, LinkPageOutline, LockOutline, ProjectsOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import type { TNameDescriptionLoader } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
// services
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGE_ACCESS } from "@/services/page/workspace-page.service";
// local imports
import { getAttachmentHref, getAttachmentLabel } from "./helpers";

type Props = {
  workspaceSlug: string;
  page: TWorkspacePage;
  isOwner: boolean;
  saveStatus: TNameDescriptionLoader;
  onDetach: () => void;
  onToggleAccess: () => void;
  className?: string;
  readOnly?: boolean;
} & (
  | { onAttachClick: () => void; attachmentControl?: never }
  | { attachmentControl: ReactNode; onAttachClick?: never }
);

export function WorkspaceToolPageMetaBar(props: Props) {
  const {
    workspaceSlug,
    page,
    isOwner,
    saveStatus,
    onAttachClick,
    onDetach,
    onToggleAccess,
    className = "",
    readOnly = false,
    attachmentControl,
  } = props;
  const isPrivate = page.access === WORKSPACE_PAGE_ACCESS.PRIVATE;
  const attachmentLabel = getAttachmentLabel(page.attachment);
  const attachmentHref = getAttachmentHref(workspaceSlug, page.attachment);

  return (
    <div className={`flex flex-wrap items-center gap-2 text-12 text-tertiary ${className}`}>
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
      {attachmentControl ?? (
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={page.attachment ? "Change" : "Attach to task or project"}
          onClick={onAttachClick}
          disabled={readOnly}
        />
      )}
      {page.attachment && (
        <Button variant="secondary" size="sm" stretch="auto" label="Detach" onClick={onDetach} disabled={readOnly} />
      )}
      <button
        type="button"
        disabled={!isOwner || readOnly}
        title={!isOwner ? "Only the owner can change access" : readOnly ? "Editing is paused" : "Toggle access"}
        onClick={onToggleAccess}
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
  );
}
