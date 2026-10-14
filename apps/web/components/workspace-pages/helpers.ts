/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TWorkspacePage, TWorkspacePageAttachment } from "@/services/page/workspace-page.service";

export const WORKSPACE_PAGES_SWR_KEY = (workspaceSlug: string) => `WORKSPACE_TOOL_PAGES_${workspaceSlug}`;
export const ISSUE_WORKSPACE_PAGES_SWR_KEY = (workspaceSlug: string, issueId: string) =>
  `WORKSPACE_TOOL_PAGES_${workspaceSlug}_ISSUE_${issueId}`;

export const getWorkspacePageName = (page: Pick<TWorkspacePage, "name">) => page.name?.trim() || "Untitled";

export const getWorkspacePageHref = (workspaceSlug: string, pageId: string) =>
  `/${workspaceSlug}/tool/pages/${pageId}/`;

export const getAttachmentLabel = (attachment: TWorkspacePageAttachment | null): string => {
  if (!attachment) return "";
  if (!attachment.is_accessible) return attachment.entity_type === "issue" ? "Restricted task" : "Restricted project";
  if (attachment.entity_type === "issue")
    return `${attachment.project_identifier}-${attachment.issue_sequence_id} ${attachment.issue_name ?? ""}`.trim();
  return attachment.project_name ?? "";
};

export const getAttachmentHref = (workspaceSlug: string, attachment: TWorkspacePageAttachment | null) => {
  if (!attachment?.is_accessible) return undefined;
  if (attachment.entity_type === "issue")
    return `/${workspaceSlug}/browse/${attachment.project_identifier}-${attachment.issue_sequence_id}/`;
  return `/${workspaceSlug}/projects/${attachment.project_id}/issues/`;
};
