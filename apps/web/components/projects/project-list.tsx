/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Check, ChevronDown, GitBranch, ListOrdered, MessageSquare, Paperclip, Plus } from "lucide-react";
import type { TIssuePriorities } from "@plane/types";
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
  onAdd: (target: TCreateTarget) => void;
};

const COLUMN_COUNT = 5;
const priorityClasses: Record<TIssuePriorities, string> = {
  urgent: "bg-red-900 text-white",
  high: "bg-[#9B1818] text-white",
  medium: "bg-[#FDE68A] text-[#111827]",
  low: "bg-[#E2E7EF] text-[#3A4D66]",
  none: "bg-surface-2 text-secondary",
};
const sectionClasses: Record<string, string> = {
  "in progress": "text-blue-700 dark:text-blue-300",
  review: "text-amber-800 dark:text-amber-300",
  done: "text-emerald-700 dark:text-emerald-300",
};
const statusClasses: Record<string, string> = {
  "on track": "bg-[#E8FAF2] text-[#00664F]",
  completed: "bg-[#E8FAF2] text-[#00664F]",
  blocked: "bg-[#FDEFEF] text-[#A81919]",
  "at risk": "bg-amber-100 text-amber-900",
};
const neutralStatus = "bg-[#E2E7EF] text-[#3A4D66]";
const badge = "inline-flex min-h-6 items-center gap-1 whitespace-nowrap px-2 text-14 leading-5 font-medium";

function TaskStatusBadge({ name }: { name: string | null | undefined }) {
  const key = name?.toLowerCase() ?? "";
  const colors = Object.hasOwn(statusClasses, key) ? statusClasses[key] : neutralStatus;
  return (
    <span className={`${badge} rounded-full ${colors}`}>
      {!name && <span aria-hidden="true" className="size-1.5 rounded-full bg-[#6E829E]" />}
      {name || "No Status"}
    </span>
  );
}

function TaskCounts({ task, childCount }: { task: TProjectListTask; childCount: number }) {
  const counts = [
    { count: task.attachment_count ?? 0, label: "attachments", Icon: Paperclip },
    { count: task.comment_count, label: "comments", Icon: MessageSquare },
    { count: childCount, label: "subtasks", Icon: GitBranch },
  ].filter(({ count }) => count > 0);
  if (!counts.length) return null;
  return (
    <span className="ml-auto inline-flex min-h-5 shrink-0 items-center gap-2 rounded-md bg-[#EAF2FF] px-2 text-12 font-medium text-[#135DDD]">
      {counts.map(({ count, label, Icon }) => (
        <span key={label} className="inline-flex items-center gap-1" aria-label={`${count} ${label}`}>
          <Icon className="size-[16px] shrink-0" />
          {count}
        </span>
      ))}
    </span>
  );
}

type TaskRowProps = TRowActions & {
  task: TProjectListTask;
  depth: number;
  childCount: number;
  expanded: boolean;
  onExpand: () => void;
};

function TaskNameCell({ task, depth, childCount, expanded, onExpand, canEdit, busy, onToggle, onOpen }: TaskRowProps) {
  const completed = isCompleted(task);
  const pending = busy.has(task.id);
  return (
    <td className="max-w-[520px] py-2 pr-3" style={{ paddingInlineStart: 12 + Math.min(depth, 8) * 20 }}>
      <div className="flex items-center gap-2">
        {(childCount > 0 || canEdit) && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`Subtasks for ${task.name}`}
            onClick={onExpand}
            className={childCount === 0 && !expanded ? "text-placeholder" : undefined}
          >
            <ChevronDown className={`size-3.5 ${expanded ? "" : "-rotate-90"}`} />
          </button>
        )}
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
        <TaskCounts task={task} childCount={childCount} />
      </div>
    </td>
  );
}

function ProjectListRow(props: TaskRowProps) {
  const { task, today, canEdit, onOpen } = props;
  const due = dueDateDetails(task, today);
  const priority = task.priority ?? "none";
  return (
    <tr className="border-b border-subtle hover:bg-layer-transparent-hover">
      <TaskNameCell {...props} />
      <td className="px-2 py-1">
        <div className="flex items-center gap-1">
          <CollaboratorAvatars ids={task.assignee_ids} pastel />
          {canEdit && (
            <button
              type="button"
              aria-label={`Edit collaborators for ${task.name}`}
              onClick={() => onOpen(task)}
              className="border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 grid size-5 place-items-center rounded-full border border-dashed"
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>
      </td>
      <td className="px-2 py-1">
        <span className={`${badge} rounded-md ${priorityClasses[priority]}`}>{PRIORITY_LABELS[priority]}</span>
      </td>
      <td className="px-2 py-1">
        <TaskStatusBadge name={task.status_name} />
      </td>
      <td
        className={`px-2 py-1 text-12 whitespace-nowrap ${due.label === "Today" ? "text-red-700 dark:text-red-300 font-medium" : due.className}`}
      >
        {due.label}
      </td>
    </tr>
  );
}

type TaskTree = { task: TProjectListTask; children: TaskTree[] };
type SortOrder = "default" | "name" | "priority" | "due";
const priorityOrder = ["urgent", "high", "medium", "low", "none"];

function taskTree(tasks: TProjectListTask[], sort: SortOrder) {
  const ordered = tasks.slice();
  // oxlint-disable-next-line unicorn/no-array-sort -- sort a fresh copy; the web target lacks toSorted.
  if (sort !== "default")
    ordered.sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name);
      if (sort === "priority")
        return priorityOrder.indexOf(left.priority ?? "none") - priorityOrder.indexOf(right.priority ?? "none");
      return (left.target_date ?? "9999").localeCompare(right.target_date ?? "9999");
    });
  const nodes = new Map(ordered.map((task): [string, TaskTree] => [task.id, { task, children: [] }]));
  const roots: TaskTree[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.task.parent_id ?? "");
    const ancestors = new Set([node.task.id]);
    let ancestor = parent;
    while (ancestor && !ancestors.has(ancestor.task.id)) {
      ancestors.add(ancestor.task.id);
      ancestor = nodes.get(ancestor.task.parent_id ?? "");
    }
    if (parent && !ancestor) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function ProjectTaskBranch({
  node,
  depth,
  showMatches,
  ...actions
}: TRowActions & {
  node: TaskTree;
  depth: number;
  showMatches: boolean;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? (showMatches && node.children.length > 0);
  return (
    <>
      <ProjectListRow
        {...actions}
        task={node.task}
        depth={depth}
        childCount={node.children.length}
        expanded={open}
        onExpand={() => setExpanded(!open)}
      />
      {open &&
        node.children.map((child) => (
          <ProjectTaskBranch
            key={child.task.id}
            node={child}
            depth={depth + 1}
            showMatches={showMatches}
            {...actions}
          />
        ))}
      {actions.canEdit && open && (
        <tr className="border-b border-subtle">
          <td colSpan={COLUMN_COUNT} className="py-1.5" style={{ paddingInlineStart: 34 + Math.min(depth, 8) * 20 }}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-12 text-secondary hover:text-accent-primary"
              onClick={() => actions.onAdd({ sectionId: node.task.section_id, parentId: node.task.id })}
            >
              <Plus className="size-3.5" /> Add Subtask
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

function ProjectListGroup({
  group,
  collapsed,
  onCollapse,
  sort,
  showMatches,
  ...actions
}: TRowActions & {
  group: TProjectListGroup;
  collapsed: boolean;
  onCollapse: (key: string) => void;
  sort: SortOrder;
  showMatches: boolean;
}) {
  return (
    <tbody>
      <tr>
        <th colSpan={COLUMN_COUNT} scope="rowgroup" className="border-b border-subtle px-3 py-1.5 text-left">
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => onCollapse(group.key)}
            className={`inline-flex items-center gap-1.5 text-14 font-semibold ${Object.hasOwn(sectionClasses, group.name.toLowerCase()) ? sectionClasses[group.name.toLowerCase()] : "text-primary"}`}
          >
            <ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
            {group.name}
          </button>
        </th>
      </tr>
      {!collapsed &&
        taskTree(group.tasks, sort).map((node) => (
          <ProjectTaskBranch key={node.task.id} node={node} depth={0} showMatches={showMatches} {...actions} />
        ))}
      {!collapsed && actions.canEdit && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="py-2 pl-6">
            <button
              type="button"
              onClick={() => actions.onAdd({ sectionId: group.sectionId })}
              className="inline-flex items-center gap-1.5 text-12 text-accent-primary hover:underline"
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
  const [sort, setSort] = useState<SortOrder>("default");
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
    onAdd: setCreating,
  };
  return (
    <section aria-label="Project tasks">
      <ProjectTasksToolbar
        list={list}
        onAdd={() => setCreating({})}
        sort={
          <label className="relative inline-flex h-9 min-w-[92px] items-center rounded-md border border-subtle bg-white text-14 hover:bg-layer-1-hover dark:bg-surface-1">
            <ListOrdered aria-hidden="true" className="pointer-events-none absolute left-4 size-3.5" />
            <select
              aria-label="Sort tasks"
              value={sort}
              className="h-full w-full cursor-pointer appearance-none rounded-md bg-transparent pr-3 pl-9"
              onChange={(event) => {
                const value = event.target.value;
                if (value === "default" || value === "name" || value === "priority" || value === "due") setSort(value);
              }}
            >
              <option value="default">Sort</option>
              <option value="name">Name</option>
              <option value="priority">Priority</option>
              <option value="due">Due date</option>
            </select>
          </label>
        }
      />
      {list.failed || list.loading ? (
        <ProjectTasksLoadState failed={list.failed} onRetry={list.retry} />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px] bg-surface-1 text-left text-13">
            <thead className="dark:bg-blue-950 dark:text-slate-200 border-b border-subtle bg-[#EAF2FF] font-['Inter_Variable',sans-serif] text-[14px] text-[#3A4D66] uppercase">
              <tr>
                <th scope="col" className="py-2.5 pr-2 pl-3 font-medium">
                  Name
                </th>
                <th scope="col" className="w-[14%] px-2 py-2.5 font-medium">
                  Collaborators
                </th>
                <th scope="col" className="w-[10%] px-2 py-2.5 font-medium">
                  Priority
                </th>
                <th scope="col" className="w-[16%] px-2 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="w-[11%] px-2 py-2.5 font-medium">
                  Due date
                </th>
              </tr>
            </thead>
            {list.groups.map((group) => (
              <ProjectListGroup
                key={group.key}
                group={group}
                collapsed={collapsed.has(group.key)}
                onCollapse={collapse}
                sort={sort}
                showMatches={list.filtered}
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
