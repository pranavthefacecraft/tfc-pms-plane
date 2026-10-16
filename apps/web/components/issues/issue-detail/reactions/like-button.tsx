/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { ThumbsUp } from "lucide-react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { setToast } from "@plane/blocks/toast";
import { cn } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useUser } from "@/hooks/store/user";

const LIKE_REACTION = "128077";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

export const IssueLikeButton = observer(function IssueLikeButton(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled = false } = props;
  const { data: currentUser } = useUser();
  const { reaction, createReaction, removeReaction } = useIssueDetail();
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const count = reaction.getReactionsByIssueId(issueId)?.[LIKE_REACTION]?.length ?? 0;
  const liked = currentUser
    ? reaction.reactionsByUser(issueId, currentUser.id).some((item) => item.reaction === LIKE_REACTION)
    : false;
  const label = liked ? "Unlike this task" : "Like this task";

  const handleClick = async () => {
    if (!currentUser || disabled || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    try {
      if (liked) await removeReaction(workspaceSlug, projectId, issueId, LIKE_REACTION, currentUser.id);
      else await createReaction(workspaceSlug, projectId, issueId, LIKE_REACTION);
    } catch (error) {
      console.error("Failed to update task like:", error);
      setToast({ type: "error", title: "Error!", message: "Could not update task like. Please try again." });
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <Tooltip label={`${label}${count ? ` (${count})` : ""}`}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={liked}
        aria-busy={isSaving}
        disabled={disabled || isSaving}
        onClick={handleClick}
        className={cn(
          "flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-subtle px-1.5 text-13 hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          liked ? "text-accent-primary" : "text-secondary"
        )}
      >
        <ThumbsUp className="size-4" fill={liked ? "currentColor" : "none"} aria-hidden="true" />
        {count > 0 && <span>{count}</span>}
      </button>
    </Tooltip>
  );
});
