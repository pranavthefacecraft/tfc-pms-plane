/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import type { E_SORT_ORDER, TActivityFilters, EActivityFilterType } from "@plane/constants";
import { BASE_ACTIVITY_FILTER_TYPES, filterActivityOnSelectedFilters } from "@plane/constants";
import type { TCommentsOperations } from "@plane/types";
// components
import { CommentCard } from "@/components/comments/card/root";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueActivityItem } from "./activity/activity-list";
import { IssueActivityLoader } from "./loader";

type TIssueActivityCommentRoot = {
  workspaceSlug: string;
  projectId: string;
  isIntakeIssue: boolean;
  issueId: string;
  selectedFilters: TActivityFilters[];
  activityOperations: TCommentsOperations;
  showAccessSpecifier?: boolean;
  disabled?: boolean;
  sortOrder: E_SORT_ORDER;
  presentation?: "drawer";
  mode?: "all" | "comments" | "activity";
};

export const IssueActivityCommentRoot = observer(function IssueActivityCommentRoot(props: TIssueActivityCommentRoot) {
  const {
    workspaceSlug,
    isIntakeIssue,
    issueId,
    selectedFilters,
    activityOperations,
    showAccessSpecifier,
    projectId,
    disabled,
    sortOrder,
    presentation,
    mode = "all",
  } = props;
  // store hooks
  const {
    activity: { getActivityAndCommentsByIssueId },
    comment: { getCommentById },
  } = useIssueDetail();
  // derived values
  const activityAndComments = getActivityAndCommentsByIssueId(issueId, sortOrder);

  if (!activityAndComments) return <IssueActivityLoader />;

  if (activityAndComments.length <= 0) return null;

  const filteredActivityAndComments = filterActivityOnSelectedFilters(activityAndComments, selectedFilters).filter(
    (item) =>
      mode === "all" || (mode === "comments" ? item.activity_type === "COMMENT" : item.activity_type !== "COMMENT")
  );
  const commentItems = filteredActivityAndComments.filter((item) => item.activity_type === "COMMENT");
  const commentIds = new Set(commentItems.map((item) => item.id));
  const childrenByParent = new Map<string, typeof commentItems>();
  const parentByChild = new Map<string, string>();
  if (presentation === "drawer") {
    for (const item of commentItems) {
      const parent = getCommentById(item.id)?.parent;
      if (parent && commentIds.has(parent) && parent !== item.id) {
        let ancestor: string | undefined = parent;
        while (ancestor && ancestor !== item.id) ancestor = parentByChild.get(ancestor);
        if (ancestor === item.id) continue;
        parentByChild.set(item.id, parent);
        const children = childrenByParent.get(parent) ?? [];
        children.push(item);
        childrenByParent.set(parent, children);
      }
    }
  }
  const renderComment = (id: string): ReactNode => {
    const children = childrenByParent.get(id) ?? [];
    return (
      <CommentCard
        key={id}
        workspaceSlug={workspaceSlug}
        entityId={issueId}
        comment={getCommentById(id)}
        activityOperations={activityOperations}
        ends={undefined}
        showAccessSpecifier={!!showAccessSpecifier}
        showCopyLinkOption={!isIntakeIssue}
        disabled={disabled}
        projectId={projectId}
        enableReplies
        presentation={presentation}
      >
        {children.length > 0 && (
          <div className="mt-4 border-l border-subtle pl-4">{children.map((child) => renderComment(child.id))}</div>
        )}
      </CommentCard>
    );
  };

  return (
    <div>
      {filteredActivityAndComments.map((activityComment, index) => {
        const comment = getCommentById(activityComment.id);
        if (presentation === "drawer" && activityComment.activity_type === "COMMENT") {
          if (parentByChild.has(activityComment.id)) return null;
          return renderComment(activityComment.id);
        }
        return activityComment.activity_type === "COMMENT" ? (
          <CommentCard
            key={activityComment.id}
            workspaceSlug={workspaceSlug}
            entityId={issueId}
            comment={comment}
            activityOperations={activityOperations}
            ends={index === 0 ? "top" : index === filteredActivityAndComments.length - 1 ? "bottom" : undefined}
            showAccessSpecifier={!!showAccessSpecifier}
            showCopyLinkOption={!isIntakeIssue}
            disabled={disabled}
            projectId={projectId}
            enableReplies
            presentation={presentation}
          />
        ) : BASE_ACTIVITY_FILTER_TYPES.includes(activityComment.activity_type as EActivityFilterType) ? (
          <IssueActivityItem
            key={activityComment.id}
            activityId={activityComment.id}
            ends={index === 0 ? "top" : index === filteredActivityAndComments.length - 1 ? "bottom" : undefined}
          />
        ) : null;
      })}
    </div>
  );
});
