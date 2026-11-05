/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useLiveTaskUpdates } from "@/hooks/use-live-task-updates";

export function useLiveIssueDetail(workspaceSlug: string, projectId: string, issueId: string) {
  const { issue } = useIssueDetail();
  useLiveTaskUpdates(workspaceSlug, () => issue.refreshIssue(workspaceSlug, projectId, issueId));
}
