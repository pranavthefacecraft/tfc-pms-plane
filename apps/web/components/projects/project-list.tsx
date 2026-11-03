/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Check, ChevronDown, MessageSquare, Plus } from "lucide-react";
import { CollaboratorAvatars } from "@/components/common/collaborator-avatars";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
import { AddStage } from "./add-stage";
import { PRIORITY_LABELS, dueDateDetails, isCompleted } from "./project-list.helpers";
import type { TProjectListGroup } from "./project-list.helpers";
import {
  NoMatchingTasks,
  ProjectTaskCreateModal,
  ProjectTasksLoadState,
  ProjectTasksToolbar,
} from "./project-tasks-toolbar";
import type { TCreateTarget } from "./project-tasks-toolbar";
import { useProjectTaskList } from "./use-project-task-list";

type TRowActions = {
  today: string;
  canEdit: boolean;
  busy: Set<string>;
  onToggle: (task: TProjectListTask) => Promise<void>;
  onOpen: (task: TProjectListTask) => void;
};

function ProjectListRow({ task, today, canEdit, busy, onToggle, onOpen }: TRowActions & { task: TProjectListTask }) {
  const completed = isCompleted(task);
  const due = dueDateDetails(task, today);
  const pending = busy.has(task.id);
  return (
    <tr className="border-b border-subtle hover:bg-layer-transparent-hover">
      <td className="max-w-[520px] py-3 pr-2 pl-7">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${completed ? "Reopen" : "Complete"} ${task.name}`}
            disabled={!canEdit || pending}
            onClick={() => void onToggle(task)}
            className={`grid size-4 shrink-0 place-items-center rounded-full border disabled:cursor-not-allowed disabled:opacity-50 ${completed ? "border-[#009E79] bg-[#009E79] text-white" : "border-[#A8B5C9]"}`}
          >
            {completed && <Check className="size-3" />}
          </button>
          <button
            type="button"
            onClick={() => onOpen(task)}
            className={`truncate text-left hover:underline ${completed ? "text-secondary line-through" : "text-primary"}`}
          >
            {task.name}
          </button>
          {task.comment_count > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-11 text-secondary"
              aria-label={`${task.comment_count} comments`}
            >
              <MessageSquare className="size-3.5" />
              {task.comment_count}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-3">
        <CollaboratorAvatars ids={task.assignee_ids} />
      </td>
      <td className="px-2 py-3 text-12 text-secondary">{PRIORITY_LABELS[task.priority ?? "none"]}</td>
      <td className={`px-2 py-3 text-12 whitespace-nowrap ${due.className}`}>{due.label}</td>
    </tr>
  );
}

function ProjectListGroup({
  group,
  collapsed,
  onCollapse,
  onAdd,
  ...actions
}: TRowActions & {
  group: TProjectListGroup;
  collapsed: boolean;
  onCollapse: (key: string) => void;
  onAdd: (target: TCreateTarget) => void;
}) {
  return (
    <tbody>
      <tr>
        <th colSpan={4} scope="rowgroup" className="pt-5 pb-2 text-left">
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => onCollapse(group.key)}
            className="inline-flex items-center gap-1.5 text-14 font-semibold text-primary"
          >
            <ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
            {group.name}
            <span className="font-normal text-12 text-secondary">{group.tasks.length}</span>
          </button>
        </th>
      </tr>
      {!collapsed && group.tasks.map((task) => <ProjectListRow key={task.id} task={task} {...actions} />)}
      {!collapsed && actions.canEdit && (
        <tr>
          <td colSpan={4} className="py-2 pl-7">
            <button
              type="button"
              onClick={() => onAdd({ sectionId: group.sectionId })}
              className="inline-flex items-center gap-1.5 text-12 text-secondary hover:text-[#135DDD]"
            >
              <Plus className="size-3.5" />
              Add task in {group.name}
            </button>
          </td>
        </tr>
      )}
    </tbody>
  );
}

/** Figma project List tab: tasks grouped by project section, with completion, filters, search and add task. */
export const ProjectList = observer(function ProjectList({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const list = useProjectTaskList(workspaceSlug, projectId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<TCreateTarget | null>(null);
  const collapse = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const actions: TRowActions = {
    today: list.today,
    canEdit: list.canEdit,
    busy: list.busy,
    onToggle: list.toggle,
    onOpen: list.open,
  };
  return (
    <section aria-label="Project tasks">
      <ProjectTasksToolbar list={list} onAdd={() => setCreating({})} />
      {list.failed || list.loading ? (
        <ProjectTasksLoadState failed={list.failed} onRetry={list.retry} />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-13">
            <thead className="border-y border-subtle text-10 text-secondary uppercase">
              <tr>
                <th className="py-3 pr-2 pl-7 font-medium">Name</th>
                <th className="w-40 px-2 py-3 font-medium">Collaborators</th>
                <th className="w-32 px-2 py-3 font-medium">Priority</th>
                <th className="w-32 px-2 py-3 font-medium">Due date</th>
              </tr>
            </thead>
            {list.groups.map((group) => (
              <ProjectListGroup
                key={group.key}
                group={group}
                collapsed={collapsed.has(group.key)}
                onCollapse={collapse}
                onAdd={setCreating}
                {...actions}
              />
            ))}
          </table>
          {list.empty && <NoMatchingTasks filtered={list.filtered} onReset={list.reset} />}
          {list.canEdit && <AddStage onCreate={list.addSection} />}
          {list.truncated && (
            <p className="py-3 text-12 text-secondary">
              Showing the first 1,000 tasks. Use Work items for the full list.
            </p>
          )}
        </div>
      )}
      <IssuePeekOverview />
      <ProjectTaskCreateModal
        projectId={projectId}
        target={creating}
        onClose={() => setCreating(null)}
        onCreated={list.refresh}
      />
    </section>
  );
});
