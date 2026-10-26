/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// i18n
import { useTranslation } from "@plane/i18n";
// ui icons
import {
  CyclesOutline,
  EstimateOutline,
  LabelsOutline,
  ModuleOutline,
  ParentOutline,
  PriorityOutline,
  StartDateOutline,
  StateOutline,
  UserOutline,
} from "@makeplane/propel/icons";
import { DateSelect } from "@plane/blocks/property-select";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { EstimateSelect } from "@/components/dropdowns/estimate/estimate-select";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { SectionSelect } from "@/components/project-sections/section-select";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// helpers
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserProfile } from "@/hooks/store/user";
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

export const PeekOverviewProperties = observer(function PeekOverviewProperties(props: IPeekOverviewProperties) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getUserDetails } = useMember();
  const { data: userProfile } = useUserProfile();
  // derived values
  const issue = getIssueById(issueId);
  if (!issue) return <></>;
  const createdByDetails = getUserDetails(issue?.created_by);
  const projectDetails = getProjectById(issue.project_id);
  const isEstimateEnabled = projectDetails?.estimate;

  const maxDate = getDate(issue.target_date);
  maxDate?.setDate(maxDate.getDate());

  return (
    <div>
      <h6 className="text-body-xs-medium">{t("common.properties")}</h6>
      <div className={`mt-3 w-full space-y-3 ${disabled ? "opacity-60" : ""}`}>
        <SidebarPropertyListItem icon={ModuleOutline} label="Section">
          <SectionSelect
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            value={issue.section_id}
            disabled={disabled}
            onChange={(sectionId) =>
              issueOperations.update(workspaceSlug, projectId, issueId, { section_id: sectionId })
            }
          />
        </SidebarPropertyListItem>
        <SidebarPropertyListItem icon={StateOutline} label={t("common.state")}>
          <StateSelect
            testId="work-item-state-select"
            value={issue?.state_id}
            onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { state_id: val })}
            projectId={projectId}
            disabled={disabled}
            variant="select-ghost-md"
            tooltip
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={PriorityOutline} label={t("common.priority")}>
          <PrioritySelect
            testId="work-item-priority-select"
            value={issue?.priority}
            onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { priority: val })}
            disabled={disabled}
            variant="select-ghost-md"
            tooltip
          />
        </SidebarPropertyListItem>

        {createdByDetails && (
          <SidebarPropertyListItem icon={UserOutline} label={t("common.created_by")} childrenClassName="px-2">
            <ButtonAvatars
              showTooltip
              userIds={createdByDetails?.display_name?.includes("-intake") ? null : createdByDetails?.id}
            />
            <span className="grow truncate text-body-xs-medium leading-5 text-secondary">
              {createdByDetails?.display_name?.includes("-intake") ? "Plane" : createdByDetails?.display_name}
            </span>
          </SidebarPropertyListItem>
        )}

        <SidebarPropertyListItem icon={StartDateOutline} label={t("common.order_by.start_date")}>
          <DateSelect
            disablePastDates
            testId="work-item-start-date-select"
            value={getDate(issue.start_date) ?? null}
            onChange={(val) =>
              issueOperations.update(workspaceSlug, projectId, issueId, {
                start_date: val ? renderFormattedPayloadDate(val) : null,
              })
            }
            placeholder={t("issue.add.start_date")}
            maxDate={maxDate ?? undefined}
            disabled={disabled}
            clearable
            weekStartsOn={userProfile?.start_of_the_week}
            variant="select-ghost-md"
            showTooltip
            tooltipHeading={t("common.order_by.start_date")}
          />
        </SidebarPropertyListItem>

        {isEstimateEnabled && (
          <SidebarPropertyListItem icon={EstimateOutline} label={t("common.estimate")}>
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
          <SidebarPropertyListItem icon={ModuleOutline} label={t("common.modules")}>
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
          <SidebarPropertyListItem icon={CyclesOutline} label={t("common.cycle")} appendElement={null}>
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

        <SidebarPropertyListItem icon={ParentOutline} label={t("common.parent")}>
          <IssueParentSelectRoot
            className="h-7.5 w-full grow"
            disabled={disabled}
            issueId={issueId}
            issueOperations={issueOperations}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
          />
        </SidebarPropertyListItem>

        <SidebarPropertyListItem icon={LabelsOutline} label={t("common.labels")}>
          <IssueLabel workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={disabled} />
        </SidebarPropertyListItem>
      </div>
    </div>
  );
});
