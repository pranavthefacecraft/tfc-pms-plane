/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState, useSyncExternalStore } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import useKeypress from "@/hooks/use-keypress";
import usePeekOverviewOutsideClickDetector from "@/hooks/use-peek-overview-outside-click";
// local imports
import type { TIssueOperations } from "../issue-detail";
import { IssueActivity } from "../issue-detail/issue-activity";
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { IssueDetailWidgetModals } from "../issue-detail-widgets/issue-detail-widget-modals";
import { PeekDrawerWidgets } from "./drawer-widgets";
import { IssuePeekOverviewError } from "./error";
import type { TPeekModes } from "./header";
import { IssuePeekOverviewHeader } from "./header";
import { PeekOverviewIssueDetails } from "./issue-detail";
import { IssuePeekOverviewLoader } from "./loader";

// The shell owns the portal for the lifetime of the task view.
const subscribeToPortal = () => () => {};
const getServerPortal = () => null;
const getFullScreenPortal = () => document.getElementById("full-screen-portal");
const getSidePeekPortal = () => document.getElementById("project-task-details-portal") ?? getFullScreenPortal();

interface IIssueView {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  isLoading?: boolean;
  isError?: boolean;
  is_archived: boolean;
  disabled?: boolean;
  embedIssue?: boolean;
  embedRemoveCurrentNotification?: () => void;
  issueOperations: TIssueOperations;
}

export const IssueView = observer(function IssueView(props: IIssueView) {
  const {
    workspaceSlug,
    projectId,
    issueId,
    isLoading,
    isError,
    is_archived,
    disabled = false,
    embedIssue = false,
    embedRemoveCurrentNotification,
    issueOperations,
  } = props;
  // states
  const [peekMode, setPeekMode] = useState<TPeekModes>("side-peek");
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  const [isDeleteIssueModalOpen, setIsDeleteIssueModalOpen] = useState(false);
  const [isArchiveIssueModalOpen, setIsArchiveIssueModalOpen] = useState(false);
  const [isDuplicateIssueModalOpen, setIsDuplicateIssueModalOpen] = useState(false);
  const [isEditIssueModalOpen, setIsEditIssueModalOpen] = useState(false);
  // ref
  const issuePeekOverviewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorRefApi>(null);
  // store hooks
  const {
    setPeekIssue,
    isAnyModalOpen,
    issue: { getIssueById },
  } = useIssueDetail();
  const { isAnyModalOpen: isAnyEpicModalOpen } = useIssueDetail(EIssueServiceType.EPICS);
  const issue = getIssueById(issueId);
  // remove peek id
  const removeRoutePeekId = () => {
    setPeekIssue(undefined);
    if (embedIssue && embedRemoveCurrentNotification) embedRemoveCurrentNotification();
  };

  const toggleDeleteIssueModal = (value: boolean) => setIsDeleteIssueModalOpen(value);
  const toggleArchiveIssueModal = (value: boolean) => setIsArchiveIssueModalOpen(value);
  const toggleDuplicateIssueModal = (value: boolean) => setIsDuplicateIssueModalOpen(value);
  const toggleEditIssueModal = (value: boolean) => setIsEditIssueModalOpen(value);

  const isAnyLocalModalOpen =
    isDeleteIssueModalOpen || isArchiveIssueModalOpen || isDuplicateIssueModalOpen || isEditIssueModalOpen;

  usePeekOverviewOutsideClickDetector(
    issuePeekOverviewRef,
    () => {
      const isAnyDropbarOpen = editorRef.current?.isAnyDropbarOpen();
      if (!embedIssue) {
        if (!isAnyModalOpen && !isAnyEpicModalOpen && !isAnyLocalModalOpen && !isAnyDropbarOpen) {
          removeRoutePeekId();
        }
      }
    },
    issueId,
    ["main-sidebar"]
  );

  const handleKeyDown = () => {
    const editorImageFullScreenModalElement = document.querySelector(".editor-image-full-screen-modal");
    const dropdownElement = document.activeElement?.tagName === "INPUT";
    const isAnyDropbarOpen = editorRef.current?.isAnyDropbarOpen();
    if (
      !isAnyModalOpen &&
      !isAnyLocalModalOpen &&
      !dropdownElement &&
      !isAnyDropbarOpen &&
      !editorImageFullScreenModalElement
    ) {
      removeRoutePeekId();
      const issueElement = document.getElementById(`issue-${issueId}`);
      if (issueElement) issueElement?.focus();
    }
  };

  useKeypress("Escape", () => !embedIssue && handleKeyDown());

  const handleRestore = async () => {
    if (!issueOperations.restore) return;
    await issueOperations.restore(workspaceSlug, projectId, issueId);
    removeRoutePeekId();
  };

  const peekOverviewIssueClassName = cn(
    !embedIssue
      ? "absolute z-[25] flex flex-col overflow-hidden rounded-sm border border-subtle bg-surface-1 transition-all duration-300"
      : `h-full w-full`,
    !embedIssue && {
      "pointer-events-auto top-0 right-0 bottom-0 w-full border-0 border-l md:w-[40vw]": peekMode === "side-peek",
      "top-[8.33%] left-[8.33%] size-5/6": peekMode === "modal",
      "absolute inset-0 m-4": peekMode === "full-screen",
    }
  );

  const portalContainer = useSyncExternalStore(
    subscribeToPortal,
    embedIssue ? getServerPortal : peekMode === "side-peek" ? getSidePeekPortal : getFullScreenPortal,
    getServerPortal
  );
  const showBackdrop = portalContainer?.id === "project-task-details-portal";

  const content = (
    <div className="w-full text-body-sm-regular">
      {issueId && showBackdrop && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/12" />
      )}
      {issueId && (
        <div
          ref={issuePeekOverviewRef}
          className={peekOverviewIssueClassName}
          style={{
            boxShadow:
              "0px 4px 8px 0px rgba(0, 0, 0, 0.12), 0px 6px 12px 0px rgba(16, 24, 40, 0.12), 0px 1px 16px 0px rgba(16, 24, 40, 0.12)",
          }}
        >
          {isError ? (
            <div className="relative h-screen w-full overflow-hidden">
              <IssuePeekOverviewError removeRoutePeekId={removeRoutePeekId} />
            </div>
          ) : (
            isLoading && <IssuePeekOverviewLoader removeRoutePeekId={removeRoutePeekId} />
          )}
          {!isLoading && !isError && issue && (
            <>
              {/* header */}
              <IssuePeekOverviewHeader
                peekMode={peekMode}
                setPeekMode={(value) => setPeekMode(value)}
                removeRoutePeekId={removeRoutePeekId}
                toggleDeleteIssueModal={toggleDeleteIssueModal}
                toggleArchiveIssueModal={toggleArchiveIssueModal}
                toggleDuplicateIssueModal={toggleDuplicateIssueModal}
                toggleEditIssueModal={toggleEditIssueModal}
                handleRestoreIssue={handleRestore}
                isArchived={is_archived}
                issueId={issueId}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                isSubmitting={isSubmitting}
                onChangeCompletion={(stateId) =>
                  issueOperations.update(workspaceSlug, projectId, issueId, { state_id: stateId })
                }
                disabled={disabled}
                embedIssue={embedIssue}
              />
              {/* content */}
              <div className="vertical-scrollbar relative scrollbar-md h-full w-full overflow-hidden overflow-y-auto">
                <div className={`relative flex flex-col gap-3 py-5 ${peekMode === "full-screen" ? "px-4" : "px-8"}`}>
                  <PeekOverviewIssueDetails
                    editorRef={editorRef}
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    issueId={issueId}
                    issueOperations={issueOperations}
                    disabled={disabled}
                    isArchived={is_archived}
                    isSubmitting={isSubmitting}
                    setIsSubmitting={(value) => setIsSubmitting(value)}
                  >
                    <PeekDrawerWidgets {...{ workspaceSlug, projectId, issueId }} disabled={disabled || is_archived} />
                    <IssueActivity
                      {...{ workspaceSlug, projectId, issueId }}
                      disabled={disabled || is_archived}
                      presentation="drawer"
                    />
                  </PeekOverviewIssueDetails>
                  <IssueDetailWidgets
                    {...{ workspaceSlug, projectId, issueId }}
                    disabled={disabled || is_archived}
                    issueServiceType={EIssueServiceType.ISSUES}
                    hideWidgets={["sub-work-items", "attachments"]}
                    renderWidgetModals={false}
                  />
                  <IssueDetailWidgetModals
                    {...{ workspaceSlug, projectId, issueId }}
                    issueServiceType={EIssueServiceType.ISSUES}
                  />
                  <IssueActivity
                    {...{ workspaceSlug, projectId, issueId }}
                    disabled={disabled || is_archived}
                    presentation="drawer"
                    activityOnly
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  return <>{portalContainer ? createPortal(content, portalContainer) : content}</>;
});
