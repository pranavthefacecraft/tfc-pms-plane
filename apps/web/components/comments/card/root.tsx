/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TIssueComment, TCommentsOperations } from "@plane/types";
// local imports
import { CommentQuickActions } from "../quick-actions";
import { CommentBlock } from "../comment-block";
import { CommentCardDisplay } from "./display";
import { CommentCreate } from "../comment-create";

type TCommentCard = {
  workspaceSlug: string;
  entityId: string;
  comment: TIssueComment | undefined;
  activityOperations: TCommentsOperations;
  ends: "top" | "bottom" | undefined;
  showAccessSpecifier: boolean;
  showCopyLinkOption: boolean;
  enableReplies: boolean;
  disabled?: boolean;
  projectId?: string;
  presentation?: "drawer";
  children?: ReactNode;
};

export const CommentCard = observer(function CommentCard(props: TCommentCard) {
  const {
    workspaceSlug,
    entityId,
    comment,
    activityOperations,
    ends,
    showAccessSpecifier,
    showCopyLinkOption,
    disabled = false,
    projectId,
    presentation,
    enableReplies,
    children,
  } = props;
  // states
  const [isEditing, setIsEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  // refs
  const readOnlyEditorRef = useRef<EditorRefApi>(null);
  // derived values
  const workspaceId = comment?.workspace;

  if (!comment || !workspaceId) return null;

  return (
    <CommentBlock comment={comment} ends={ends} presentation={presentation}>
      <CommentCardDisplay
        activityOperations={activityOperations}
        entityId={entityId}
        comment={comment}
        disabled={disabled}
        projectId={projectId}
        readOnlyEditorRef={readOnlyEditorRef}
        showAccessSpecifier={showAccessSpecifier}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        presentation={presentation}
        renderQuickActions={() => (
          <CommentQuickActions
            activityOperations={activityOperations}
            comment={comment}
            setEditMode={() => setIsEditing(true)}
            showAccessSpecifier={showAccessSpecifier}
            showCopyLinkOption={showCopyLinkOption}
          />
        )}
      />
      {presentation === "drawer" && enableReplies && !disabled && (
        <div className="mt-3 pl-12">
          <button type="button" className="text-14 text-accent-primary" onClick={() => setReplying(!replying)}>
            {replying ? "Cancel reply" : "Reply"}
          </button>
          {replying && (
            <div className="mt-3">
              <CommentCreate
                entityId={entityId}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                activityOperations={activityOperations}
                presentation="drawer"
                parentId={comment.id}
                access={comment.access}
                onSubmitCallback={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      )}
      {children}
    </CommentBlock>
  );
});
