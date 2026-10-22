/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { BlockingOutline, DueDateOutline, MembersOutline } from "@makeplane/propel/icons";
import { DateSelect } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import { cn, getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserProfile } from "@/hooks/store/user";
import { IssueRelationSelect } from "./relation-select";
import type { TIssueOperations } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
};

export const IssueSummaryProperties = observer(function IssueSummaryProperties(props: Props) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();
  const { data: userProfile } = useUserProfile();
  const issue = getIssueById(issueId);
  if (!issue) return null;

  return (
    <section aria-label={t("common.properties")} className="space-y-2 py-2">
      <SidebarPropertyListItem icon={MembersOutline} label={t("common.assignees")}>
        <MemberSelect
          testId="work-item-assignee-select"
          value={issue.assignee_ids ?? []}
          onChange={(value) => issueOperations.update(workspaceSlug, projectId, issueId, { assignee_ids: value })}
          disabled={disabled}
          projectId={projectId}
          placeholder={t("issue.add.assignee")}
          multiple
          variant="select-ghost-md"
          showLabel={(issue.assignee_ids?.length ?? 0) <= 1}
          tooltip={{ heading: t("common.assignees") }}
        />
      </SidebarPropertyListItem>
      <SidebarPropertyListItem icon={DueDateOutline} label={t("common.order_by.due_date")}>
        <DateSelect
          disablePastDates
          testId="work-item-due-date-select"
          value={getDate(issue.target_date) ?? null}
          onChange={(value) =>
            issueOperations.update(workspaceSlug, projectId, issueId, {
              target_date: value ? renderFormattedPayloadDate(value) : null,
            })
          }
          placeholder={t("issue.add.due_date")}
          minDate={getDate(issue.start_date) ?? undefined}
          disabled={disabled}
          clearable
          className={cn({
            "text-danger-primary": shouldHighlightIssueDueDate(issue.target_date, getStateById(issue.state_id)?.group),
          })}
          weekStartsOn={userProfile?.start_of_the_week}
          variant="select-ghost-md"
          showTooltip
          tooltipHeading={t("common.order_by.due_date")}
        />
      </SidebarPropertyListItem>
      <SidebarPropertyListItem
        icon={BlockingOutline}
        label={t("common.dependencies")}
        childrenClassName="min-w-0 flex-col items-stretch"
      >
        {(["blocked_by", "blocking"] as const).map((relationKey) => (
          <div key={relationKey} className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="px-2 text-body-xs-regular text-tertiary">{t(`issue.relation.${relationKey}`)}</span>
            <IssueRelationSelect
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              relationKey={relationKey}
              disabled={disabled}
              renderModal={false}
            />
          </div>
        ))}
      </SidebarPropertyListItem>
    </section>
  );
});
