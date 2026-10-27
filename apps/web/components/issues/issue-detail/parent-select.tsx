/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import Link from "next/link";

import { useTranslation } from "@plane/i18n";
import { CloseOutline, EditOutline } from "@makeplane/propel/icons";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { ParentIssuesListModal } from "../parent-issues-list-modal";

type TIssueParentSelect = {
  className?: string;
  disabled?: boolean;
  issueId: string;
  projectId: string;
  workspaceSlug: string;
  handleParentIssue: (_issueId?: string | null) => Promise<void>;
  handleRemoveSubIssue: (
    workspaceSlug: string,
    projectId: string,
    parentIssueId: string,
    issueId: string
  ) => Promise<void>;
  workItemLink: string;
};

export const IssueParentSelect = observer(function IssueParentSelect(props: TIssueParentSelect) {
  const {
    className = "",
    disabled = false,
    issueId,
    projectId,
    workspaceSlug,
    handleParentIssue,
    handleRemoveSubIssue,
    workItemLink,
  } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { isParentIssueModalOpen, toggleParentIssueModal } = useIssueDetail();

  // derived values
  const issue = getIssueById(issueId);
  const parentIssue = issue?.parent_id ? getIssueById(issue.parent_id) : undefined;
  const parentIssueProjectDetails =
    parentIssue && parentIssue.project_id ? getProjectById(parentIssue.project_id) : undefined;
  const { isMobile } = usePlatformOS();

  if (!issue) return <></>;

  return (
    <>
      <ParentIssuesListModal
        projectId={projectId}
        issueId={issueId}
        isOpen={isParentIssueModalOpen === issueId}
        handleClose={() => toggleParentIssueModal(null)}
        onChange={(issue: any) => handleParentIssue(issue?.id)}
      />
      <div
        className={cn(
          "group relative flex max-w-full min-w-0 items-center justify-between gap-2 rounded-sm px-2 py-0.5",
          {
            "cursor-not-allowed": disabled,
            "hover:bg-layer-transparent-hover": !disabled,
            "bg-layer-transparent-selected": isParentIssueModalOpen,
          },
          className
        )}
      >
        <button
          type="button"
          className="absolute inset-0 rounded-sm outline-none focus-visible:ring-2"
          aria-label={t("issue.add.parent")}
          onClick={() => toggleParentIssueModal(issue.id)}
          disabled={disabled}
        />
        {issue.parent_id && parentIssue ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <Tooltip
              label={
                parentIssueProjectDetails
                  ? `${parentIssueProjectDetails.identifier}-${parentIssue.sequence_id}: ${parentIssue.name}`
                  : parentIssue.name
              }
              layout="stacked"
              disabled={isMobile}
            >
              <Link
                href={workItemLink}
                target="_blank"
                rel="noopener noreferrer"
                className="relative min-w-0 truncate text-body-xs-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {parentIssue.name}
              </Link>
            </Tooltip>

            {!disabled && (
              <Tooltip label={t("common.remove")} side="bottom" disabled={isMobile}>
                <button
                  type="button"
                  aria-label={t("common.remove")}
                  className="relative shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveSubIssue(workspaceSlug, projectId, parentIssue.id, issueId);
                  }}
                >
                  <CloseOutline className="h-2.5 w-2.5 text-tertiary hover:text-danger-primary" />
                </button>
              </Tooltip>
            )}
          </div>
        ) : (
          <span className="pointer-events-none text-body-xs-medium text-placeholder">{t("issue.add.parent")}</span>
        )}
        {!disabled && (
          <span
            className={cn("pointer-events-none flex-shrink-0 p-1 opacity-0 group-hover:opacity-100", {
              "text-placeholder": !issue.parent_id && !parentIssue,
            })}
          >
            <EditOutline className="h-2.5 w-2.5 flex-shrink-0" />
          </span>
        )}
      </div>
    </>
  );
});
