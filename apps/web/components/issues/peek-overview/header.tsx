/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { X } from "lucide-react";
import { observer } from "mobx-react";
import Link from "next/link";
import { ArrowNarrowRightOutline, DragDropOutline, LinkOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import {
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import type { TNameDescriptionLoader } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { copyUrlToClipboard, generateWorkItemLink } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { IssueSubscription } from "../issue-detail/subscription";
import { IssueLikeButton } from "../issue-detail/reactions/like-button";
import { WorkItemDetailQuickActions } from "../issue-layouts/quick-action-dropdowns";
import { NameDescriptionUpdateStatus } from "../issue-update-status";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { TaskCompletion } from "./task-completion";

export type TPeekModes = "side-peek" | "modal" | "full-screen";

function PeekTaskMenuItems({
  workspaceSlug,
  projectId,
  issueId,
  isArchived,
  canShowSubscription,
  onCopyLink,
  workItemLink,
  removeRoutePeekId,
  peekMode,
  setPeekMode,
}: Pick<
  PeekOverviewHeaderProps,
  "workspaceSlug" | "projectId" | "issueId" | "isArchived" | "removeRoutePeekId" | "peekMode" | "setPeekMode"
> & {
  canShowSubscription: boolean;
  onCopyLink: () => Promise<void>;
  workItemLink: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <IssueLikeButton
        key={issueId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        disabled={isArchived}
        presentation="menu"
      />
      {canShowSubscription && !isArchived && (
        <IssueSubscription workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} presentation="menu" />
      )}
      <MenuItem label={t("common.actions.copy_link")} onClick={onCopyLink} />
      <MenuItem
        label={t("issue.open_in_full_screen")}
        render={<Link href={workItemLink} />}
        onClick={removeRoutePeekId}
      />
      <MenuSubmenu>
        <MenuSubmenuTrigger label={t("common.toggle_peek_view_layout")} />
        <MenuSubmenuContent sizing="auto">
          <MenuRadioGroup
            value={peekMode}
            onValueChange={(value) => {
              const next = PEEK_OPTIONS.find((option) => option.key === value);
              if (next) setPeekMode(next.key);
            }}
          >
            {PEEK_OPTIONS.map((option) => (
              <MenuRadioItem key={option.key} value={option.key} label={t(option.i18n_title)} closeOnClick />
            ))}
          </MenuRadioGroup>
        </MenuSubmenuContent>
      </MenuSubmenu>
      <MenuSeparator />
    </>
  );
}

const PEEK_OPTIONS = [
  { key: "side-peek", i18n_title: "common.side_peek" },
  { key: "modal", i18n_title: "common.modal" },
  { key: "full-screen", i18n_title: "common.full_screen" },
] as const satisfies readonly { key: TPeekModes; i18n_title: string }[];

export type PeekOverviewHeaderProps = {
  peekMode: TPeekModes;
  setPeekMode: (value: TPeekModes) => void;
  removeRoutePeekId: () => void;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  isArchived: boolean;
  disabled: boolean;
  embedIssue: boolean;
  toggleDeleteIssueModal: (value: boolean) => void;
  toggleArchiveIssueModal: (value: boolean) => void;
  toggleDuplicateIssueModal: (value: boolean) => void;
  toggleEditIssueModal: (value: boolean) => void;
  handleRestoreIssue: () => Promise<void>;
  isSubmitting: TNameDescriptionLoader;
  onChangeCompletion: (stateId: string) => Promise<void>;
};

export const IssuePeekOverviewHeader = observer(function IssuePeekOverviewHeader(props: PeekOverviewHeaderProps) {
  const {
    peekMode,
    setPeekMode,
    workspaceSlug,
    projectId,
    issueId,
    isArchived,
    disabled,
    embedIssue = false,
    removeRoutePeekId,
    toggleDeleteIssueModal,
    toggleArchiveIssueModal,
    toggleDuplicateIssueModal,
    toggleEditIssueModal,
    handleRestoreIssue,
    isSubmitting,
    onChangeCompletion,
  } = props;
  // ref
  const parentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  // store hooks
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
    setPeekIssue,
    removeIssue,
    archiveIssue,
    getIsIssuePeeked,
  } = useIssueDetail();
  const { isMobile } = usePlatformOS();
  const { getProjectIdentifierById } = useProject();
  // derived values
  const issueDetails = getIssueById(issueId);
  const projectIdentifier = getProjectIdentifierById(issueDetails?.project_id);
  const {
    issues: { removeIssue: removeArchivedIssue },
  } = useIssues(EIssuesStoreType.ARCHIVED);

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issueDetails?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issueDetails?.sequence_id,
    isArchived,
  });

  const handleCopyText = async () => {
    try {
      await copyUrlToClipboard(workItemLink);
      setToast({
        type: "success",
        title: t("common.link_copied"),
        message: t("common.link_copied_to_clipboard"),
      });
    } catch {
      setToast({ type: "error", title: t("toast.error"), message: t("common.error.message") });
    }
  };

  const handleDeleteIssue = async () => {
    try {
      const deleteIssue = issueDetails?.archived_at ? removeArchivedIssue : removeIssue;

      return deleteIssue(workspaceSlug, projectId, issueId).then(() => {
        setPeekIssue(undefined);
      });
    } catch (_error) {
      setToast({
        title: t("toast.error"),
        type: "error",
        message: t("entity.delete.failed", { entity: t("issue.label", { count: 1 }) }),
      });
    }
  };

  const handleArchiveIssue = async () => {
    await archiveIssue(workspaceSlug, projectId, issueId);
    // check and remove if issue is peeked
    if (getIsIssuePeeked(issueId)) {
      removeRoutePeekId();
    }
  };

  const moreActions = issueDetails && (
    <WorkItemDetailQuickActions
      parentRef={parentRef}
      issue={issueDetails}
      handleDelete={handleDeleteIssue}
      handleArchive={handleArchiveIssue}
      handleRestore={handleRestoreIssue}
      readOnly={disabled}
      toggleDeleteIssueModal={toggleDeleteIssueModal}
      toggleArchiveIssueModal={toggleArchiveIssueModal}
      toggleDuplicateIssueModal={toggleDuplicateIssueModal}
      toggleEditIssueModal={toggleEditIssueModal}
      isPeekMode
      additionalMenuItems={
        !embedIssue && (
          <PeekTaskMenuItems
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            isArchived={isArchived}
            canShowSubscription={!!currentUser}
            onCopyLink={handleCopyText}
            workItemLink={workItemLink}
            removeRoutePeekId={removeRoutePeekId}
            peekMode={peekMode}
            setPeekMode={setPeekMode}
          />
        )
      }
    />
  );
  if (embedIssue)
    return (
      <div
        className={`relative flex items-center justify-between gap-2 p-4 ${
          peekMode === "full-screen" ? "border-b border-subtle" : ""
        }`}
      >
        <div className="flex items-center gap-4">
          <Tooltip label={t("common.close_peek_view")} disabled={isMobile}>
            <button type="button" onClick={removeRoutePeekId} aria-label={t("common.close_peek_view")}>
              <ArrowNarrowRightOutline className="h-4 w-4 text-tertiary hover:text-secondary" />
            </button>
          </Tooltip>

          <Tooltip label={t("issue.open_in_full_screen")} disabled={isMobile}>
            <Link href={workItemLink} onClick={() => removeRoutePeekId()}>
              <DragDropOutline className="h-4 w-4 text-tertiary hover:text-secondary" />
            </Link>
          </Tooltip>
        </div>
        <div className="flex items-center gap-x-4">
          <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
          <div className="flex items-center gap-2">
            <IssueLikeButton
              key={issueId}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              disabled={isArchived}
            />
            {currentUser && !isArchived && (
              <IssueSubscription workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} />
            )}
            <Tooltip label={t("common.actions.copy_link")} disabled={isMobile}>
              <IconButton
                variant="secondary"
                size="md"
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  void handleCopyText();
                }}
                icon={<Icon icon={LinkOutline} />}
                aria-label={t("common.actions.copy_link")}
              />
            </Tooltip>
            {moreActions}
          </div>
        </div>
      </div>
    );
  return (
    <header className="flex items-center justify-between gap-2 border-b border-subtle px-5 py-3">
      <div>
        {issueDetails?.state_id && (
          <TaskCompletion
            key={issueId}
            projectId={projectId}
            stateId={issueDetails.state_id}
            disabled={disabled || isArchived}
            onChange={onChangeCompletion}
          />
        )}
      </div>
      <div className="flex items-center gap-1">
        <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
        {moreActions}
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded text-[#6B7E99] hover:bg-layer-transparent-hover"
          aria-label={t("common.close_peek_view")}
          onClick={removeRoutePeekId}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </header>
  );
});
