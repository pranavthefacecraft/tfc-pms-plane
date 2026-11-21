/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { DueDateOutline } from "@makeplane/propel/icons";
import { DateSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { cn, getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { inviteTaskAssignees } from "@/components/profile/new-task.helpers";
import { TaskAssigneePicker } from "@/components/profile/task-assignee-select";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
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

export function IssueSummaryProperties(props: Props) {
  return <SummaryProperties {...props} />;
}

const SummaryProperties = observer(function SummaryProperties(props: Props) {
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  if (!getIssueById(props.issueId)) return null;

  return (
    <section aria-label={t("common.properties")} className="space-y-2 py-2">
      <IssueAssignmentAndDueDate {...props} />
      <IssueDependencies {...props} />
    </section>
  );
});

type AssignmentProps = Props & { assigneeLabel?: string; compactAssignee?: boolean; allowAssigneeInvites?: boolean };

export function IssueAssignmentAndDueDate(props: AssignmentProps) {
  return <AssignmentAndDueDate {...props} />;
}

const AssignmentAndDueDate = observer(function AssignmentAndDueDate(props: AssignmentProps) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();
  const { data: userProfile } = useUserProfile();
  const issue = getIssueById(issueId);
  if (!issue) return null;
  const assigneeProps = {
    testId: "work-item-assignee-select",
    value: issue.assignee_ids ?? [],
    onChange: (value: string[]) => issueOperations.update(workspaceSlug, projectId, issueId, { assignee_ids: value }),
    disabled,
    projectId,
    placeholder: t("issue.add.assignee"),
  };

  return (
    <>
      <SidebarPropertyListItem appearance="task-detail" label={props.assigneeLabel ?? t("common.assignees")}>
        {props.allowAssigneeInvites && !disabled ? (
          <ExistingTaskAssigneePicker
            key={issueId}
            {...assigneeProps}
            workspaceSlug={workspaceSlug}
            issueId={issueId}
            compact={props.compactAssignee}
            tooltipHeading={t("common.assignees")}
          />
        ) : (
          <MemberSelect
            {...assigneeProps}
            multiple
            variant="select-ghost-md"
            className={props.compactAssignee ? "w-fit" : undefined}
            showLabel={assigneeProps.value.length <= 1}
            tooltip={{ heading: t("common.assignees") }}
          />
        )}
      </SidebarPropertyListItem>
      <SidebarPropertyListItem appearance="task-detail" label={t("common.order_by.due_date")}>
        <div className="w-fit max-w-full">
          <DateSelect
            disablePastDates
            testId="work-item-due-date-select"
            icon={<DueDateOutline aria-hidden="true" />}
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
              "text-danger-primary": shouldHighlightIssueDueDate(
                issue.target_date,
                getStateById(issue.state_id)?.group
              ),
            })}
            weekStartsOn={userProfile?.start_of_the_week}
            variant="select-ghost-md"
            showTooltip
            tooltipHeading={t("common.order_by.due_date")}
          />
        </div>
      </SidebarPropertyListItem>
    </>
  );
});

function ExistingTaskAssigneePicker({
  workspaceSlug,
  issueId,
  ...props
}: Pick<Props, "workspaceSlug" | "projectId" | "issueId" | "disabled"> & {
  testId: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  compact?: boolean;
  tooltipHeading: string;
}) {
  const {
    issue: { fetchIssue },
  } = useIssueDetail();
  const {
    project: { fetchProjectMembers },
  } = useMember();
  return (
    <TaskAssigneePicker
      {...props}
      slug={workspaceSlug}
      sendInvite={async (email) => {
        const { added } = await inviteTaskAssignees(workspaceSlug, props.projectId, issueId, [email]);
        if (!added.length) {
          setToast({
            type: "success",
            title: "Invitation queued",
            message: "The task will be assigned after they accept.",
          });
          return;
        }
        try {
          await Promise.all([
            fetchProjectMembers(workspaceSlug, props.projectId),
            fetchIssue(workspaceSlug, props.projectId, issueId),
          ]);
        } catch (error) {
          console.error("Could not refresh task assignees after inviting", error);
          setToast({
            type: "warning",
            title: "Teammate assigned",
            message: "Reopen the task to see the updated assignee.",
          });
          return;
        }
        setToast({ type: "success", title: "Teammate assigned" });
      }}
    />
  );
}

export function IssueDependencies({ workspaceSlug, projectId, issueId, disabled }: Omit<Props, "issueOperations">) {
  const { t } = useTranslation();
  return (
    <SidebarPropertyListItem
      appearance="task-detail"
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
  );
}
