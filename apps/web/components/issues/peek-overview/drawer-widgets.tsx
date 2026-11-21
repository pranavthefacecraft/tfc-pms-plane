/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Plus } from "lucide-react";
import { observer } from "mobx-react";
import { EIssueServiceType } from "@plane/types";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { IssueAttachmentActionButton } from "../issue-detail-widgets/attachments/quick-action-button";
import { IssueAttachmentsCollapsibleContent } from "../issue-detail-widgets/attachments/content";
import { SubIssuesCollapsibleContent } from "../issue-detail-widgets/sub-issues/content";
import { SubIssuesActionButton } from "../issue-detail-widgets/sub-issues/quick-action-button";

type Props = { workspaceSlug: string; projectId: string; issueId: string; disabled: boolean };

export const PeekDrawerWidgets = observer(function PeekDrawerWidgets(props: Props) {
  const { issueId, disabled } = props;
  const {
    issue: { getIssueById },
    subIssues: { subIssuesByIssueId },
    attachment: { getAttachmentsCountByIssueId, getAttachmentsUploadStatusByIssueId },
  } = useIssueDetail();
  const attachmentCount = getAttachmentsCountByIssueId(issueId);
  const hasUploads = !!getAttachmentsUploadStatusByIssueId(issueId)?.length;
  const hasSubtasks = !!(subIssuesByIssueId(issueId)?.length || getIssueById(issueId)?.sub_issues_count);

  return (
    <>
      <section aria-label="Subtasks" className="space-y-2 py-2">
        <h3 className="text-14 font-semibold text-primary">Subtasks</h3>
        {hasSubtasks && (
          <SubIssuesCollapsibleContent
            workspaceSlug={props.workspaceSlug}
            projectId={props.projectId}
            parentIssueId={issueId}
            disabled={disabled}
            presentation="drawer"
          />
        )}
        {!disabled && (
          <SubIssuesActionButton
            issueId={issueId}
            issueServiceType={EIssueServiceType.ISSUES}
            customButton={
              <button
                type="button"
                className="inline-flex items-center gap-1 text-13 text-accent-primary hover:underline"
              >
                <Plus aria-hidden="true" className="size-3.5" /> Add subtask
              </button>
            }
          />
        )}
      </section>
      <section aria-label="Attached Files" className="space-y-2 border-b border-subtle pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-14 font-semibold text-primary">Attached Files</h3>
          <span className="rounded bg-layer-1 px-1.5 text-12 text-tertiary">{attachmentCount}</span>
          {!disabled && (
            <IssueAttachmentActionButton
              {...props}
              issueServiceType={EIssueServiceType.ISSUES}
              customButton={<Plus aria-hidden="true" className="size-4 text-accent-primary" />}
              buttonLabel="Add attachment"
            />
          )}
        </div>
        {(!disabled || attachmentCount > 0 || hasUploads) && (
          <IssueAttachmentsCollapsibleContent {...props} presentation="cards" />
        )}
      </section>
    </>
  );
});
