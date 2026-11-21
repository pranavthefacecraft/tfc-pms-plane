/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Check, Circle } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import {
  ChevronRightOutline,
  CloseOutline,
  DeleteOutline,
  EditOutline,
  LinkOutline,
  MoreHorizontalOutline,
} from "@makeplane/propel/icons";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssue, TIssueServiceType, TSubIssueOperations } from "@plane/types";
import { EIssueServiceType, EIssuesStoreType } from "@plane/types";
import { ControlLink } from "@plane/blocks/layout";
import { cn, generateWorkItemLink, renderFormattedDate, shouldHighlightIssueDueDate } from "@plane/utils";
// helpers
import { useSubIssueOperations } from "@/components/issues/issue-detail-widgets/sub-issues/helper";
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { CollaboratorAvatars } from "@/components/common/collaborator-avatars";
// local components
import { SubIssuesListItemProperties } from "./properties";
import { SubIssuesListRoot } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  rootIssueId: string;
  spacingLeft: number;
  canEdit: boolean;
  handleIssueCrudState: (
    key: "create" | "existing" | "update" | "delete",
    issueId: string,
    issue?: TIssue | null
  ) => void;
  subIssueOperations: TSubIssueOperations;
  issueId: string;
  issueServiceType?: TIssueServiceType;
  storeType?: EIssuesStoreType;
  presentation?: "drawer";
};

export const SubIssuesListItem = observer(function SubIssuesListItem(props: Props) {
  const {
    workspaceSlug,
    projectId,
    parentIssueId,
    rootIssueId,
    issueId,
    spacingLeft = 10,
    canEdit,
    handleIssueCrudState,
    subIssueOperations,
    issueServiceType = EIssueServiceType.ISSUES,
    storeType = EIssuesStoreType.PROJECT,
  } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
    subIssues: {
      filters: { getSubIssueFilters },
    },
  } = useIssueDetail(issueServiceType);
  const {
    subIssues: { subIssueHelpersByIssueId, setSubIssueHelpers },
  } = useIssueDetail();
  const { fetchSubIssues } = useSubIssueOperations(EIssueServiceType.ISSUES);
  const { toggleCreateIssueModal, toggleDeleteIssueModal } = useIssueDetail(issueServiceType);
  const project = useProject();
  const { getStateById } = useProjectState();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();
  const issue = getIssueById(issueId);

  // derived values
  const projectDetail = (issue && issue.project_id && project.getProjectById(issue.project_id)) || undefined;

  const subIssueHelpers = subIssueHelpersByIssueId(parentIssueId);
  const subIssueCount = issue?.sub_issues_count ?? 0;

  // derived values
  const subIssueFilters = getSubIssueFilters(parentIssueId);
  const drawer = props.presentation === "drawer";
  const stateGroup = drawer ? getStateById(issue?.state_id)?.group : undefined;
  const completed = stateGroup === "completed";
  const displayProperties = subIssueFilters?.displayProperties ?? {};

  //
  const handleIssuePeekOverview = (issue: TIssue) => handleRedirection(workspaceSlug, issue, isMobile);

  if (!issue) return <></>;

  // check if current issue is the root issue
  const isCurrentIssueRoot = issueId === rootIssueId;
  const dueDate = drawer && issue.target_date ? renderFormattedDate(issue.target_date, "MMM d") : null;

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId: issue?.id,
    projectIdentifier: projectDetail?.identifier,
    sequenceId: issue?.sequence_id,
  });

  return (
    <div key={issueId}>
      <ControlLink
        id={`issue-${issue.id}`}
        href={workItemLink}
        onClick={() => handleIssuePeekOverview(issue)}
        className="w-full cursor-pointer"
      >
        {issue && (
          <div
            className={cn(
              "group relative flex h-full w-full items-center py-1 transition-all hover:bg-surface-2",
              drawer ? "group/subtask mb-2 min-h-11 gap-2 rounded-sm border border-subtle pr-3" : "min-h-11 pr-2"
            )}
            style={{ paddingLeft: `${spacingLeft}px` }}
          >
            {drawer && (
              <span className="grid size-5 shrink-0 place-items-center">
                {completed ? (
                  <Check role="img" aria-label="Completed" className="text-emerald-600 size-3.5" />
                ) : (
                  <Circle role="img" aria-label="Incomplete" className="size-3.5 text-primary" />
                )}
              </span>
            )}
            {(!drawer || (subIssueCount > 0 && !isCurrentIssueRoot)) && (
              <div className="flex size-5 flex-shrink-0 items-center justify-center">
                {/* disable the chevron when current issue is also the root issue*/}
                {subIssueCount > 0 && !isCurrentIssueRoot ? (
                  <>
                    {subIssueHelpers.preview_loader.includes(issue.id) ? (
                      <div className="flex h-full w-full cursor-not-allowed items-center justify-center rounded-xs bg-layer-1 transition-all">
                        <LinkOutline width={14} height={14} className="animate-spin" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Toggle nested subtasks"
                        aria-expanded={subIssueHelpers.issue_visibility.includes(issueId)}
                        className="flex h-full w-full cursor-pointer items-center justify-center text-placeholder hover:text-tertiary"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                        }}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!subIssueHelpers.issue_visibility.includes(issueId)) {
                            setSubIssueHelpers(parentIssueId, "preview_loader", issueId);
                            await fetchSubIssues(workspaceSlug, projectId, issueId);
                            setSubIssueHelpers(parentIssueId, "preview_loader", issueId);
                          }
                          setSubIssueHelpers(parentIssueId, "issue_visibility", issueId);
                        }}
                      >
                        <ChevronRightOutline
                          className={cn("size-3.5 transition-all", {
                            "rotate-90": subIssueHelpers.issue_visibility.includes(issue.id),
                          })}
                        />
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            )}

            <div className="flex w-full cursor-pointer items-center gap-3 truncate">
              {!drawer && (
                <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="key">
                  <div className="flex-shrink-0">
                    {projectDetail && (
                      <IssueIdentifier
                        projectId={projectDetail.id}
                        issueTypeId={issue.type_id}
                        projectIdentifier={projectDetail.identifier}
                        issueSequenceId={issue.sequence_id}
                        size="xs"
                        variant="secondary"
                      />
                    )}
                  </div>
                </WithDisplayPropertiesHOC>
              )}
              <Tooltip label={issue.name} layout="stacked" disabled={isMobile}>
                <span className={cn("w-0 flex-1 truncate text-13", completed ? "text-tertiary" : "text-primary")}>
                  {issue.name}
                </span>
              </Tooltip>
            </div>
            {drawer ? (
              <div className="flex shrink-0 items-center gap-2">
                {dueDate && (
                  <time
                    dateTime={issue.target_date ?? undefined}
                    className={cn(
                      "text-13 whitespace-nowrap",
                      completed
                        ? "text-tertiary"
                        : shouldHighlightIssueDueDate(issue.target_date, stateGroup)
                          ? "text-danger-primary"
                          : "text-emerald-800 dark:text-emerald-300"
                    )}
                  >
                    {dueDate}
                  </time>
                )}
                <CollaboratorAvatars ids={issue.assignee_ids ?? []} />
              </div>
            ) : (
              <div
                role="presentation"
                className="flex-shrink-0 text-13"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <SubIssuesListItemProperties
                  workspaceSlug={workspaceSlug}
                  parentIssueId={parentIssueId}
                  issueId={issueId}
                  canEdit={canEdit}
                  updateSubIssue={subIssueOperations.updateSubIssue}
                  displayProperties={displayProperties}
                  issue={issue}
                />
              </div>
            )}

            {/* The row's ControlLink activates on click and on Enter/Space, so the menu's own
                activation must not reach it. */}
            <div
              role="presentation"
              className={cn(
                "shrink-0 text-13",
                drawer &&
                  "-ml-2 w-0 opacity-0 group-hover/subtask:ml-0 group-hover/subtask:w-7 group-hover/subtask:opacity-100 focus-within:ml-0 focus-within:w-7 focus-within:opacity-100 pointer-coarse:ml-0 pointer-coarse:w-7 pointer-coarse:opacity-100"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
            >
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={t("aria_labels.common.more_actions")}
                      icon={<Icon icon={MoreHorizontalOutline} />}
                    />
                  }
                />
                <MenuContent side="bottom" align="end">
                  {canEdit && (
                    <MenuItem
                      icon={<Icon icon={EditOutline} />}
                      label={t("issue.edit")}
                      onClick={() => {
                        handleIssueCrudState("update", parentIssueId, { ...issue });
                        toggleCreateIssueModal(true);
                      }}
                    />
                  )}
                  <MenuItem
                    icon={<Icon icon={LinkOutline} />}
                    label={t("issue.copy_link")}
                    onClick={() => {
                      subIssueOperations.copyLink(workItemLink);
                    }}
                  />
                  {canEdit && (
                    <MenuItem
                      icon={<Icon icon={CloseOutline} />}
                      label={
                        issueServiceType === EIssueServiceType.ISSUES
                          ? t("issue.remove.parent.label")
                          : t("issue.remove.label")
                      }
                      onClick={() => {
                        if (issue.project_id)
                          subIssueOperations.removeSubIssue(workspaceSlug, issue.project_id, parentIssueId, issue.id);
                      }}
                    />
                  )}
                  {canEdit && (
                    <MenuItem
                      icon={<Icon icon={DeleteOutline} />}
                      label={t("issue.delete.label")}
                      onClick={() => {
                        handleIssueCrudState("delete", parentIssueId, issue);
                        toggleDeleteIssueModal(issue.id);
                      }}
                    />
                  )}
                </MenuContent>
              </Menu>
            </div>
            {drawer && <ChevronRightOutline aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />}
          </div>
        )}
      </ControlLink>

      {/* should not expand the current issue if it is also the root issue*/}
      {subIssueHelpers.issue_visibility.includes(issueId) &&
        issue.project_id &&
        subIssueCount > 0 &&
        !isCurrentIssueRoot && (
          <SubIssuesListRoot
            storeType={storeType}
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            parentIssueId={issue.id}
            rootIssueId={rootIssueId}
            spacingLeft={spacingLeft + 22}
            canEdit={canEdit}
            presentation={props.presentation}
            handleIssueCrudState={handleIssueCrudState}
            subIssueOperations={subIssueOperations}
          />
        )}
    </div>
  );
});
