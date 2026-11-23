// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { EFileAssetType, EIssueServiceType } from "@plane/types";
import type { TNameDescriptionLoader } from "@plane/types";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
import { TaskCustomFields } from "@/components/projects/custom-fields/task-fields";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { useLiveIssueDetail } from "@/hooks/use-live-issue-detail";
// plane web components
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
// plane web hooks
// services
import { WorkItemVersionService } from "@/services/issue";
// local components
import type { TIssueOperations } from "../issue-detail";
import { IssueParentDetail } from "../issue-detail/parent";
import { IssueReaction } from "../issue-detail/reactions";
import { IssueAssignmentAndDueDate } from "../issue-detail/summary-properties";
import { IssueAttachmentActionButton } from "../issue-detail-widgets/attachments/quick-action-button";
import { IssueTitleInput } from "../title-input";
import { PeekOverviewPriority, PeekOverviewProperties, PeekOverviewSection } from "./properties";
import { PeekOverviewDependencies } from "./dependencies";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  children?: ReactNode;
  editorRef: React.RefObject<EditorRefApi | null>;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
  isArchived: boolean;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

export const PeekOverviewIssueDetails = observer(function PeekOverviewIssueDetails(props: Props) {
  const { editorRef, workspaceSlug, issueId, issueOperations, disabled, isArchived, isSubmitting, setIsSubmitting } =
    props;
  const { t } = useTranslation();
  useLiveIssueDetail(workspaceSlug, props.projectId, issueId);
  // store hooks
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const { getUserDetails } = useMember();
  const { getProjectById } = useProject();
  // reload confirmation
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      timer = setTimeout(() => setIsSubmitting("saved"), 2000);
    } else if (isSubmitting === "submitting") {
      setShowAlert(true);
    }
    return () => clearTimeout(timer);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;

  if (!issue || !issue.project_id) return <></>;

  const projectId = issue.project_id;
  const project = getProjectById(projectId);
  const propertyProps = { workspaceSlug, projectId, issueId, disabled: disabled || isArchived };
  const issueDescription = issue.description_html || "<p></p>";
  const description = (
    <section aria-label={t("common.description")} className="min-h-28 rounded-md border border-subtle px-3 py-2">
      <h3 className="text-14 font-semibold text-primary">{t("common.description")}</h3>
      <DescriptionInput
        issueSequenceId={issue.sequence_id}
        containerClassName="-mx-3 border-none text-secondary"
        disabled={propertyProps.disabled}
        editorRef={editorRef}
        entityId={issue.id}
        fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
        initialValue={issueDescription}
        key={issue.id}
        onSubmit={async (value, isMigrationUpdate) => {
          await issueOperations.update(workspaceSlug, projectId, issue.id, {
            description_html: value.description_html,
            ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
          });
        }}
        setIsSubmitting={setIsSubmitting}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
      />
    </section>
  );

  return (
    <div className="space-y-2">
      {issue.parent_id && (
        <IssueParentDetail
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issueId}
          issue={issue}
          issueOperations={issueOperations}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <IssueTypeSwitcher issueId={issueId} disabled={isArchived || disabled} />
      </div>
      <IssueTitleInput
        workspaceSlug={workspaceSlug}
        projectId={issue.project_id}
        issueId={issue.id}
        isSubmitting={isSubmitting}
        setIsSubmitting={(value) => setIsSubmitting(value)}
        issueOperations={issueOperations}
        disabled={disabled || isArchived}
        value={issue.name}
      />

      <div role="group" aria-label={t("common.properties")} className="space-y-4 py-2">
        <IssueAssignmentAndDueDate
          {...propertyProps}
          issueOperations={issueOperations}
          assigneeLabel="Assigned To"
          compactAssignee
          allowAssigneeInvites
        />
        <PeekOverviewPriority {...propertyProps} issueOperations={issueOperations} compact />
        <PeekOverviewSection {...propertyProps} issueOperations={issueOperations} />
        <TaskCustomFields
          {...propertyProps}
          primaryGroup={{
            names: ["stage", "status"],
            after: (
              <>
                <SidebarPropertyListItem appearance="task-detail" label="Attach File">
                  <IssueAttachmentActionButton
                    {...propertyProps}
                    issueServiceType={EIssueServiceType.ISSUES}
                    customButton={
                      <span className="inline-flex min-h-7.5 items-center text-body-sm-regular text-secondary">
                        Add file
                      </span>
                    }
                  />
                </SidebarPropertyListItem>
                <SidebarPropertyListItem appearance="task-detail" label="Link To Project" childrenClassName="min-w-0">
                  {project ? (
                    <Link
                      href={`/${workspaceSlug}/projects/${projectId}/issues`}
                      className="max-w-full truncate text-body-sm-regular text-primary"
                    >
                      {project.name}
                    </Link>
                  ) : (
                    <span className="text-body-sm-regular text-tertiary">{t("common.none")}</span>
                  )}
                </SidebarPropertyListItem>
                <PeekOverviewDependencies {...propertyProps} />
                {description}
                {props.children}
                <PeekOverviewProperties {...propertyProps} issueOperations={issueOperations} hidePriority hideSection />
              </>
            ),
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {currentUser && (
          <IssueReaction
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            issueId={issueId}
            currentUser={currentUser}
            disabled={isArchived}
          />
        )}
        {!disabled && (
          <DescriptionVersionsRoot
            className="flex-shrink-0"
            entityInformation={{
              createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
              createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
              id: issueId,
              isRestoreDisabled: disabled || isArchived,
            }}
            fetchHandlers={{
              listDescriptionVersions: (issueId) =>
                workItemVersionService.listDescriptionVersions(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  issueId
                ),
              retrieveDescriptionVersion: (issueId, versionId) =>
                workItemVersionService.retrieveDescriptionVersion(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  issueId,
                  versionId
                ),
            }}
            handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
            projectId={issue.project_id}
            workspaceSlug={workspaceSlug}
          />
        )}
      </div>
    </div>
  );
});
