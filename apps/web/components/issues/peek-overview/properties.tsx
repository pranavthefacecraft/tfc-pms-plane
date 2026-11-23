/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// i18n
import { useTranslation } from "@plane/i18n";
// components
import { EstimateSelect } from "@/components/dropdowns/estimate/estimate-select";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { SectionSelect } from "@/components/project-sections/section-select";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { TaskDetailChoice } from "@/components/common/task-detail-choice";
import { LIST_PRIORITY_OPTIONS, taskPriorityColors } from "@/components/projects/project-list.helpers";
// helpers
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
// plane web components
import { IssueParentSelectRoot } from "@/components/issues/parent-select-root";
import type { TIssueOperations } from "../issue-detail";
import { IssueCycleSelect } from "../issue-detail/cycle-select";
import { IssueLabel } from "../issue-detail/label";
import { IssueModuleSelect } from "../issue-detail/module-select";

interface IPeekOverviewProperties {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueOperations: TIssueOperations;
}

export const PeekOverviewPriority = observer(function PeekOverviewPriority({
  workspaceSlug,
  projectId,
  issueId,
  issueOperations,
  disabled,
  compact,
}: IPeekOverviewProperties & { compact?: boolean }) {
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const issue = getIssueById(issueId);
  if (!issue) return null;
  const priority = issue.priority ?? "none";
  const label = t("common.priority");
  const updatePriority = (value: typeof priority) =>
    issueOperations.update(workspaceSlug, projectId, issueId, { priority: value });

  return (
    <SidebarPropertyListItem appearance="task-detail" label={label}>
      {compact ? (
        <TaskDetailChoice
          testId="work-item-priority-select"
          label={label}
          value={priority}
          options={LIST_PRIORITY_OPTIONS.map((option) => ({
            id: option.id,
            label: (option.id === "none" ? t("common.none") : t(option.id)) || option.label,
          }))}
          onChange={updatePriority}
          disabled={disabled}
          valueClassName={`rounded-md px-2 py-0.5 text-13 leading-5 font-medium ${taskPriorityColors[priority]}`}
        />
      ) : (
        <PrioritySelect
          testId="work-item-priority-select"
          value={issue.priority}
          onChange={updatePriority}
          disabled={disabled}
          variant="select-ghost-md"
          tooltip
        />
      )}
    </SidebarPropertyListItem>
  );
});

export const PeekOverviewSection = observer(function PeekOverviewSection({
  workspaceSlug,
  projectId,
  issueId,
  issueOperations,
  disabled,
}: IPeekOverviewProperties) {
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const issue = getIssueById(issueId);
  if (!issue) return null;
  return (
    <SidebarPropertyListItem appearance="task-detail" label="Section">
      <SectionSelect
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        value={issue.section_id}
        disabled={disabled}
        onChange={(sectionId) => issueOperations.update(workspaceSlug, projectId, issueId, { section_id: sectionId })}
      />
    </SidebarPropertyListItem>
  );
});

export const PeekOverviewProperties = observer(function PeekOverviewProperties(
  props: IPeekOverviewProperties & { hidePriority?: boolean; hideSection?: boolean }
) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled, hidePriority, hideSection } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getUserDetails } = useMember();
  // derived values
  const issue = getIssueById(issueId);
  if (!issue) return <></>;
  const createdByDetails = getUserDetails(issue?.created_by);
  const projectDetails = getProjectById(issue.project_id);
  const isEstimateEnabled = projectDetails?.estimate;

  return (
    <div>
      <h6 className="text-body-xs-medium">{t("common.properties")}</h6>
      <div className={`mt-3 w-full space-y-3 ${disabled ? "opacity-60" : ""}`}>
        {!hideSection && <PeekOverviewSection {...props} />}
        {!hidePriority && <PeekOverviewPriority {...props} />}

        {createdByDetails && (
          <SidebarPropertyListItem appearance="task-detail" label={t("common.created_by")} childrenClassName="px-2">
            <ButtonAvatars
              showTooltip
              userIds={createdByDetails?.display_name?.includes("-intake") ? null : createdByDetails?.id}
            />
            <span className="grow truncate text-body-xs-medium leading-5 text-secondary">
              {createdByDetails?.display_name?.includes("-intake") ? "Plane" : createdByDetails?.display_name}
            </span>
          </SidebarPropertyListItem>
        )}

        {isEstimateEnabled && (
          <SidebarPropertyListItem appearance="task-detail" label={t("common.estimate")}>
            <EstimateSelect
              value={issue.estimate_point ?? undefined}
              onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { estimate_point: val })}
              projectId={projectId}
              disabled={disabled}
              variant="select-ghost-md"
              placeholder={t("common.none")}
              tooltip
            />
          </SidebarPropertyListItem>
        )}

        {projectDetails?.module_view && (
          <SidebarPropertyListItem appearance="task-detail" label={t("common.modules")}>
            <IssueModuleSelect
              className="w-full grow"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              issueOperations={issueOperations}
              disabled={disabled}
            />
          </SidebarPropertyListItem>
        )}

        {projectDetails?.cycle_view && (
          <SidebarPropertyListItem appearance="task-detail" label={t("common.cycle")}>
            <IssueCycleSelect
              className="h-7.5 w-full grow"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              issueOperations={issueOperations}
              disabled={disabled}
            />
          </SidebarPropertyListItem>
        )}

        <SidebarPropertyListItem appearance="task-detail" label={t("common.parent")}>
          <IssueParentSelectRoot
            className="h-7.5 w-full grow"
            disabled={disabled}
            issueId={issueId}
            issueOperations={issueOperations}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem appearance="task-detail" label={t("common.labels")}>
          <IssueLabel workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={disabled} />
        </SidebarPropertyListItem>
      </div>
    </div>
  );
});
