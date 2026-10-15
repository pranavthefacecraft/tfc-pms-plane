/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR, { useSWRConfig } from "swr";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { LockOutline } from "@makeplane/propel/icons";
import { PriorityIcon } from "@plane/blocks/icons";
import { setToast } from "@plane/blocks/toast";
import { cn, generateWorkItemLink, getFileURL, renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useUser } from "@/hooks/store/user";
// services
import { IssueService } from "@/services/issue/issue.service";
import { MyTasksService } from "@/services/workspace-my-tasks.service";
import type { TMyTask, TMyTasksTab } from "@/services/workspace-my-tasks.service";

const myTasksService = new MyTasksService();
const issueService = new IssueService();

const PAGE_SIZE = 7;
const SWR_KEY_PREFIX = "HOME_MY_TASKS";
const TABS: { key: TMyTasksTab; label: string; showCount: boolean }[] = [
  { key: "upcoming", label: "Upcoming", showCount: false },
  { key: "overdue", label: "Overdue", showCount: true },
  { key: "completed", label: "Completed", showCount: false },
];
const EMPTY_MESSAGES: Record<TMyTasksTab, string> = {
  upcoming: "You have no upcoming tasks. Nice work!",
  overdue: "Nothing overdue. You're all caught up.",
  completed: "No completed tasks yet.",
};

type Props = {
  workspaceSlug: string;
};

const CircleCheckIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" />
    <path
      d="M5 8.2 7 10.2 11 6"
      fill="none"
      stroke={filled ? "white" : "currentColor"}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const getDueLabel = (targetDate: string | null, today: string) => {
  if (!targetDate) return null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (targetDate === today) return { text: "Today", className: "text-success-primary" };
  if (targetDate === renderFormattedPayloadDate(tomorrow)) return { text: "Tomorrow", className: "text-tertiary" };
  return {
    text: renderFormattedDate(targetDate) ?? targetDate,
    className: targetDate < today ? "text-danger-primary" : "text-tertiary",
  };
};

export const MyTasksWidget = observer(function MyTasksWidget({ workspaceSlug }: Props) {
  // states
  const [tab, setTab] = useState<TMyTasksTab>("upcoming");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  // store hooks
  const { data: currentUser } = useUser();
  const { peekIssue, setPeekIssue } = useIssueDetail();
  const { mutate: globalMutate } = useSWRConfig();
  // derived values
  const today = renderFormattedPayloadDate(new Date()) ?? "";
  const swrKey = `${SWR_KEY_PREFIX}_${workspaceSlug}_${tab}_${limit}_${today}`;

  const { data, isLoading } = useSWR(swrKey, () => myTasksService.list(workspaceSlug, { tab, limit, today }), {
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  const revalidateAllTabs = () =>
    globalMutate((key) => typeof key === "string" && key.startsWith(`${SWR_KEY_PREFIX}_${workspaceSlug}_`));

  // Edits made in the peek overview (state, due date, assignee) should show up here once it closes.
  const wasPeekOpen = useRef(false);
  useEffect(() => {
    if (peekIssue) {
      wasPeekOpen.current = true;
    } else if (wasPeekOpen.current) {
      wasPeekOpen.current = false;
      void revalidateAllTabs();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [peekIssue]);

  const handleTabChange = (nextTab: TMyTasksTab) => {
    setTab(nextTab);
    setLimit(PAGE_SIZE);
  };

  const handleToggleComplete = async (task: TMyTask) => {
    const isCompleted = task.state_group === "completed";
    const targetStateId = isCompleted ? task.default_state_id : task.completed_state_id;
    if (!targetStateId) {
      setToast({
        type: "error",
        title: "Error",
        message: `The project has no ${isCompleted ? "default" : "completed"} state to move this work item to.`,
      });
      return;
    }
    setTogglingIds((prev) => new Set(prev).add(task.id));
    try {
      await issueService.patchIssue(workspaceSlug, task.project_id, task.id, { state_id: targetStateId });
      await revalidateAllTabs();
      setToast({
        type: "success",
        title: isCompleted ? "Reopened" : "Completed",
        message: `${task.project_identifier}-${task.sequence_id} ${isCompleted ? "was reopened" : "was marked complete"}.`,
      });
    } catch (error) {
      const message = (error as { error?: string } | undefined)?.error ?? "Could not update the work item.";
      setToast({ type: "error", title: "Error", message });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const handleOpenTask = (event: React.MouseEvent<HTMLAnchorElement>, task: TMyTask) => {
    if (event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    setPeekIssue({ workspaceSlug, projectId: task.project_id, issueId: task.id });
  };

  const isCurrentTabData = data?.tab === tab;
  const tasks = isCurrentTabData ? data.results : [];
  const total = isCurrentTabData ? data.counts[tab] : 0;
  const showLoader = isLoading || !isCurrentTabData;

  const renderTask = (task: TMyTask) => {
    const isCompleted = task.state_group === "completed";
    const isToggling = togglingIds.has(task.id);
    const due = getDueLabel(task.target_date, today);
    const dueClassName = isCompleted ? "text-placeholder" : due?.className;
    const href = generateWorkItemLink({
      workspaceSlug,
      projectId: task.project_id,
      issueId: task.id,
      projectIdentifier: task.project_identifier,
      sequenceId: task.sequence_id,
    });
    return (
      <div
        key={task.id}
        className="flex items-center gap-3 border-b border-subtle px-1 py-2 last:border-b-0 hover:bg-layer-transparent-hover"
      >
        <button
          type="button"
          disabled={isToggling}
          onClick={() => void handleToggleComplete(task)}
          aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
          className={cn(
            "flex-shrink-0 rounded-full transition-colors disabled:opacity-60",
            isCompleted ? "text-success-primary" : "text-placeholder hover:text-success-primary"
          )}
        >
          <CircleCheckIcon filled={isCompleted || isToggling} />
        </button>
        <a
          href={href}
          onClick={(event) => handleOpenTask(event, task)}
          className={cn(
            "min-w-0 flex-1 truncate text-13 text-primary hover:underline",
            isCompleted && "text-tertiary line-through"
          )}
        >
          {task.name}
        </a>
        <span className="flex-shrink-0 text-11 font-medium text-placeholder">
          {task.project_identifier}-{task.sequence_id}
        </span>
        {task.priority !== "none" && <PriorityIcon priority={task.priority} className="size-3.5 flex-shrink-0" />}
        <span className={cn("w-20 flex-shrink-0 text-right text-11 font-medium", dueClassName)}>{due?.text}</span>
      </div>
    );
  };

  const renderBody = () => {
    if (showLoader && tasks.length === 0)
      return (
        <div className="flex flex-col gap-2 py-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-8 animate-pulse rounded-sm bg-layer-2" />
          ))}
        </div>
      );
    if (tasks.length === 0) return <p className="py-6 text-center text-13 text-tertiary">{EMPTY_MESSAGES[tab]}</p>;
    return tasks.map(renderTask);
  };

  return (
    <div className="rounded-lg border border-subtle bg-layer-1 p-4">
      <div className="flex items-center gap-2">
        {currentUser && (
          <Avatar
            size="md"
            alt={currentUser.display_name}
            fallback={currentUser.display_name?.[0]?.toUpperCase()}
            src={currentUser.avatar_url ? getFileURL(currentUser.avatar_url) : undefined}
          />
        )}
        <h3 className="text-16 font-semibold text-primary">My tasks</h3>
        <Tooltip label="Only visible to you">
          <span className="text-placeholder">
            <LockOutline className="size-3.5" />
          </span>
        </Tooltip>
      </div>

      <div role="tablist" className="mt-3 flex items-center gap-1">
        {TABS.map(({ key, label, showCount }) => {
          const count = data?.counts?.[key];
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(key)}
              className={cn(
                "rounded-md px-2 py-1 text-13 font-medium transition-colors",
                isActive ? "bg-accent-subtle text-accent-primary" : "text-tertiary hover:bg-layer-transparent-hover"
              )}
            >
              {label}
              {showCount && count ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-2 flex flex-col">
        {renderBody()}
      </div>

      {tasks.length < total && (
        <button
          type="button"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="mt-2 px-1 text-12 font-medium text-tertiary hover:text-primary"
        >
          Show more
        </button>
      )}
    </div>
  );
});
