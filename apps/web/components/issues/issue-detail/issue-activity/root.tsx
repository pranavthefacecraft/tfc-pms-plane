/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import uniq from "lodash-es/uniq";
import { observer } from "mobx-react";
// plane package imports
import type { TActivityFilters } from "@plane/constants";
import { E_SORT_ORDER, defaultActivityFilters } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
// i18n
import { useTranslation } from "@plane/i18n";
//types
import type { TFileSignedURLResponse, TIssueComment } from "@plane/types";
// components
import { CommentCreate } from "@/components/comments/comment-create";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import { IssueActivityCommentRoot } from "./activity-comment-root";
import { useWorkItemCommentOperations } from "./helper";
import { ActivitySortRoot } from "./sort-root";
import { ActivityFilterRoot } from "./filter-root";

type TIssueActivity = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
  isIntakeIssue?: boolean;
  presentation?: "drawer";
};

export type TActivityOperations = {
  createComment: (data: Partial<TIssueComment>) => Promise<TIssueComment>;
  updateComment: (commentId: string, data: Partial<TIssueComment>) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  uploadCommentAsset: (blockId: string, file: File, commentId?: string) => Promise<TFileSignedURLResponse>;
};

export const IssueActivity = observer(function IssueActivity(props: TIssueActivity) {
  const { workspaceSlug, projectId, issueId, disabled = false, isIntakeIssue = false, presentation } = props;
  const drawer = presentation === "drawer";
  // i18n
  const { t } = useTranslation();
  // hooks
  const { setValue: setFilterValue, storedValue: selectedFilters } = useLocalStorage(
    "issue_activity_filters",
    defaultActivityFilters
  );
  const { setValue: setSortOrder, storedValue: sortOrder } = useLocalStorage("activity_sort_order", E_SORT_ORDER.ASC);

  const { getProjectById } = useProject();
  const activityFilters = selectedFilters || defaultActivityFilters;
  const activitySortOrder = sortOrder || E_SORT_ORDER.ASC;
  const composerFirst = drawer || activitySortOrder === E_SORT_ORDER.DESC;

  // toggle filter
  const toggleFilter = (filter: TActivityFilters) => {
    const next = activityFilters.includes(filter)
      ? activityFilters.filter((current) => current !== filter)
      : [...activityFilters, filter];
    if (next.length) setFilterValue(uniq(next));
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === E_SORT_ORDER.ASC ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC);
  };

  // helper hooks
  const activityOperations = useWorkItemCommentOperations(workspaceSlug, projectId, issueId);

  const project = getProjectById(projectId);
  const renderCommentCreationBox = useMemo(
    () => (
      <CommentCreate
        workspaceSlug={workspaceSlug}
        entityId={issueId}
        activityOperations={activityOperations}
        showToolbarInitially={!drawer}
        projectId={projectId}
      />
    ),
    [workspaceSlug, issueId, activityOperations, projectId, drawer]
  );
  if (!project) return <></>;
  const composer = disabled ? null : renderCommentCreationBox;
  const heading = drawer ? "Comments" : t("common.activity");

  return (
    <section aria-label={heading} className={drawer ? "space-y-2 py-2" : "space-y-4"}>
      {/* header */}
      <div className="flex items-center justify-between">
        <h3 className={drawer ? "text-14 font-semibold text-primary" : "text-h5-medium text-primary"}>{heading}</h3>
        <div className="flex items-center gap-2">
          <ActivitySortRoot sortOrder={activitySortOrder} toggleSort={toggleSortOrder} />
          <ActivityFilterRoot
            selectedFilters={activityFilters}
            toggleFilter={toggleFilter}
            isIntakeIssue={isIntakeIssue}
            projectId={projectId}
          />
        </div>
      </div>

      {/* rendering activity */}
      <div className="space-y-3">
        <div className={drawer ? undefined : "min-h-[200px]"}>
          <div className="space-y-3">
            {composerFirst && composer}
            <IssueActivityCommentRoot
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              isIntakeIssue={isIntakeIssue}
              issueId={issueId}
              selectedFilters={activityFilters}
              activityOperations={activityOperations}
              showAccessSpecifier={!!project.anchor}
              disabled={disabled}
              sortOrder={activitySortOrder}
            />
            {!composerFirst && composer}
          </div>
        </div>
      </div>
    </section>
  );
});
