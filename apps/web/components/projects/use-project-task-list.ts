/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import type { TIssuePriorities } from "@plane/types";
import { zonedDateKey } from "@/components/home/activity-overview.helpers";
import { customFields } from "@/components/projects/custom-fields/service";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectSection } from "@/hooks/store/use-project-section";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useCurrentTime } from "@/hooks/use-current-time";
import { IssueService } from "@/services/issue/issue.service";
import { ProjectTaskListService, projectTaskListKey } from "@/services/project/project-task-list.service";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
import { boardMovePatch } from "./project-board.helpers";
import type { TProjectListGroup } from "./project-list.helpers";
import {
  EMPTY_LIST_FILTERS,
  groupTasksBySection,
  isCompleted,
  listFilterCount,
  matchesListFilters,
} from "./project-list.helpers";

const taskListService = new ProjectTaskListService();
const issueService = new IssueService();

/** Loads a project's tasks and sections and provides the shared List/Board filters, search and task updates. */
export function useProjectTaskList(workspaceSlug: string, projectId: string) {
  const { data: user } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { currentTime } = useCurrentTime();
  const { peekIssue, setPeekIssue, updateIssue } = useIssueDetail();
  const { mutate } = useSWRConfig();
  const sectionStore = useProjectSection();
  const canEdit = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const tasks = useSWR(projectTaskListKey(workspaceSlug, projectId), () =>
    taskListService.list(workspaceSlug, projectId)
  );
  const sectionsRequest = useSWR(["project-sections", workspaceSlug, projectId], () =>
    sectionStore.fetch(workspaceSlug, projectId)
  );
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_LIST_FILTERS);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const { mutate: refresh } = tasks;
  const wasPeekOpen = useRef(false);
  useEffect(() => {
    if (peekIssue) wasPeekOpen.current = true;
    else if (wasPeekOpen.current) {
      wasPeekOpen.current = false;
      void refresh();
    }
  }, [peekIssue, refresh]);

  const today = zonedDateKey(currentTime, user?.user_timezone);
  const search = query.trim().toLocaleLowerCase();
  const visible = (tasks.data?.results ?? []).filter(
    (task) => matchesListFilters(task, filters, today, user?.id) && task.name.toLocaleLowerCase().includes(search)
  );
  const groups = groupTasksBySection(visible, sectionStore.getSections(workspaceSlug, projectId));
  const filtered = Boolean(search || listFilterCount(filters));

  const runUpdate = async (task: TProjectListTask, success: string, save: () => Promise<unknown>) => {
    setBusy((previous) => new Set(previous).add(task.id));
    try {
      await save();
      await refresh();
      setToast({ type: "success", title: success });
    } catch (error) {
      setToast({
        type: "error",
        title: "Could not update task",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy((previous) => {
        const next = new Set(previous);
        next.delete(task.id);
        return next;
      });
    }
  };
  const toggle = (task: TProjectListTask) => {
    const done = isCompleted(task);
    return runUpdate(task, done ? "Task reopened" : "Task completed", () => {
      const stateId = done ? tasks.data?.default_state_id : tasks.data?.completed_state_id;
      if (!stateId) throw new Error(`This project has no ${done ? "default" : "completed"} state.`);
      return issueService.patchIssue(workspaceSlug, projectId, task.id, { state_id: stateId });
    });
  };
  const move = (task: TProjectListTask, group: TProjectListGroup) =>
    runUpdate(task, `Moved to ${group.name}`, () =>
      issueService.patchIssue(workspaceSlug, projectId, task.id, boardMovePatch(task, group, tasks.data))
    );
  const reschedule = (task: TProjectListTask, dates: { start_date?: string; target_date?: string }) =>
    runUpdate(task, "Task rescheduled", () => issueService.patchIssue(workspaceSlug, projectId, task.id, dates));
  const setPriority = (task: TProjectListTask, priority: TIssuePriorities) =>
    runUpdate(task, "Priority updated", () => updateIssue(workspaceSlug, projectId, task.id, { priority }));
  const addCollaborator = (task: TProjectListTask, memberId: string) =>
    runUpdate(task, "Collaborator added", () =>
      updateIssue(workspaceSlug, projectId, task.id, { assignee_ids: [...task.assignee_ids, memberId] })
    );
  const setStatus = (task: TProjectListTask, fieldId: string, value: string | null) =>
    runUpdate(task, "Status updated", async () => {
      await customFields.setValue(workspaceSlug, projectId, task.id, fieldId, value);
      await mutate(["task-custom-field-values", workspaceSlug, projectId, task.id]);
    });
  const open = (task: TProjectListTask) => setPeekIssue({ workspaceSlug, projectId, issueId: task.id });
  const reset = () => {
    setQuery("");
    setFilters(EMPTY_LIST_FILTERS);
  };
  const retry = () => {
    void refresh();
    void sectionsRequest.mutate();
  };
  const addSection = (name: string) => sectionStore.create(workspaceSlug, projectId, name);
  return {
    canEdit,
    query,
    setQuery,
    filters,
    setFilters,
    groups,
    empty: !visible.length,
    filtered,
    identifier: tasks.data?.project_identifier ?? "",
    truncated: Boolean(tasks.data?.truncated),
    failed: Boolean(tasks.error || sectionsRequest.error),
    loading: tasks.isLoading || sectionsRequest.isLoading,
    today,
    timeZone: user?.user_timezone,
    busy,
    toggle,
    move,
    reschedule,
    setPriority,
    addCollaborator,
    setStatus,
    open,
    reset,
    retry,
    refresh,
    addSection,
  };
}

export type TProjectTaskListState = ReturnType<typeof useProjectTaskList>;
