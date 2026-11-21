/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Check, ChevronDown, GitBranch, MessageSquare, Paperclip, Plus } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { DateSelect } from "@plane/blocks/property-select";
import type { TIssuePriorities } from "@plane/types";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
import { CollaboratorAvatars, collaboratorAddButtonClass } from "@/components/common/collaborator-avatars";
import { sortTasks, TaskSortMenu } from "@/components/common/task-sort";
import type { TaskSortOrder } from "@/components/common/task-sort";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { useUserProfile } from "@/hooks/store/user";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
import { AddStage } from "./add-stage";
import { useCustomFields } from "./custom-fields/service";
import type { CustomField } from "./custom-fields/service";
import {
  PRIORITY_LABELS,
  dueDateDetails,
  isCompleted,
  taskPriorityColors,
  taskStatusColors,
} from "./project-list.helpers";
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
  projectId: string;
  busy: Set<string>;
  onToggle: (task: TProjectListTask) => Promise<void>;
  onSetPriority: (task: TProjectListTask, priority: TIssuePriorities) => Promise<void>;
  onSetDueDate: (task: TProjectListTask, date: string | null) => Promise<void>;
  onAddCollaborator: (task: TProjectListTask, memberId: string) => Promise<void>;
  statusField?: CustomField;
  onSetStatus: (task: TProjectListTask, fieldId: string, value: string | null) => Promise<void>;
  onOpen: (task: TProjectListTask) => void;
  onAdd: (target: TCreateTarget) => void;
};

const COLUMN_COUNT = 5;
const sectionClasses: Record<string, string> = {
  "in progress": "text-blue-700 dark:text-blue-300",
  review: "text-amber-800 dark:text-amber-300",
  done: "text-emerald-700 dark:text-emerald-300",
};
const badge = "inline-flex min-h-6 items-center gap-1 whitespace-nowrap px-2 text-14 leading-5 font-medium";
const priorityOptions = ["none", "low", "medium", "high", "urgent"] as const satisfies readonly TIssuePriorities[];

function TaskPriority({
  task,
  canEdit,
  busy,
  onSetPriority,
}: Pick<TaskRowProps, "task" | "canEdit" | "busy" | "onSetPriority">) {
  const priority = task.priority ?? "none";
  const className = `${badge} rounded-md ${taskPriorityColors[priority]}`;
  if (!canEdit) return <span className={className}>{PRIORITY_LABELS[priority]}</span>;

  return (
    <Menu>
      <MenuTrigger
        disabled={busy.has(task.id)}
        render={
          <button
            type="button"
            className={`${className} cursor-pointer disabled:cursor-wait`}
            aria-label={`Set priority for ${task.name}: ${PRIORITY_LABELS[priority]}`}
          >
            {PRIORITY_LABELS[priority]}
          </button>
        }
      />
      <MenuContent align="start">
        <MenuGroup>
          <MenuLabel>Set Priority</MenuLabel>
          <MenuRadioGroup
            value={priority}
            onValueChange={(value) => {
              const next = priorityOptions.find((option) => option === value);
              if (next && next !== priority) void onSetPriority(task, next);
            }}
          >
            {priorityOptions.map((option) => (
              <div
                key={option}
                className={`[&>[role=menuitemradio][data-highlighted]]:ring-accent-primary mb-1 rounded-md [&>[role=menuitemradio]]:bg-transparent! [&>[role=menuitemradio]]:text-inherit! [&>[role=menuitemradio][data-highlighted]]:ring-2 [&>[role=menuitemradio][data-highlighted]]:ring-inset ${option === "none" ? "text-primary" : option === "low" ? "bg-[#C8D9F5] text-[#3A4D66]" : taskPriorityColors[option]}`}
              >
                <MenuRadioItem
                  value={option}
                  label={option === "none" ? "No Priority" : PRIORITY_LABELS[option]}
                  closeOnClick
                />
              </div>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}

function TaskStatusBadge({ name }: { name: string | null | undefined }) {
  return (
    <span className={`${badge} rounded-full ${taskStatusColors(name)}`}>
      {!name && <span aria-hidden="true" className="size-1.5 rounded-full bg-[#6E829E]" />}
      {name || "No Status"}
    </span>
  );
}

function TaskStatus({
  task,
  canEdit,
  busy,
  statusField,
  onSetStatus,
}: Pick<TaskRowProps, "task" | "canEdit" | "busy" | "statusField" | "onSetStatus">) {
  const name = task.status_name;
  if (!canEdit || !statusField?.options.length) return <TaskStatusBadge name={name} />;
  // The list returns the name; option names are unique within each field.
  const selected = statusField.options.find((option) => option.name === name)?.id ?? "";
  const options = [...statusField.options, ...(name ? [{ id: "", name: "No Status" }] : [])];
  return (
    <Menu>
      <MenuTrigger
        disabled={busy.has(task.id)}
        render={
          <button
            type="button"
            className="cursor-pointer rounded-full disabled:cursor-wait"
            aria-label={`Set status for ${task.name}: ${name || "No Status"}`}
          >
            <TaskStatusBadge name={name} />
          </button>
        }
      />
      <MenuContent align="start">
        <MenuGroup>
          <MenuLabel>Set Status</MenuLabel>
          <MenuRadioGroup
            value={selected}
            onValueChange={(value) => {
              const next = options.find((option) => option.id === value);
              if (next && next.id !== selected) void onSetStatus(task, statusField.id, next.id || null);
            }}
          >
            {options.map((option) => (
              <div
                key={option.id}
                className="mb-1 [&_.truncate]:sr-only [&_[aria-checked=true]]:bg-[#F2F5FD] dark:[&_[aria-checked=true]]:bg-layer-2"
              >
                <MenuRadioItem
                  value={option.id}
                  label={option.name}
                  icon={
                    <span aria-hidden="true">
                      <TaskStatusBadge name={option.id ? option.name : null} />
                    </span>
                  }
                  closeOnClick
                />
              </div>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </Menu>
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
    <td className="max-w-[520px] pr-3" style={{ paddingInlineStart: 12 + Math.min(depth, 8) * 20 }}>
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
          className={`min-w-0 flex-1 cursor-pointer truncate py-2 text-left hover:underline ${completed ? "text-secondary line-through" : "text-primary"}`}
        >
          {task.name}
        </button>
        <TaskCounts task={task} childCount={childCount} />
      </div>
    </td>
  );
}

function TaskDueDate({
  task,
  today,
  canEdit,
  busy,
  onSetDueDate,
}: Pick<TaskRowProps, "task" | "today" | "canEdit" | "busy" | "onSetDueDate">) {
  const { data: profile } = useUserProfile();
  const due = dueDateDetails(task, today);
  return (
    <td
      className={`px-2 py-1 text-12 whitespace-nowrap ${due.label === "Today" ? "text-red-700 dark:text-red-300 font-medium" : due.className}`}
    >
      {canEdit ? (
        <div role="group" aria-label={`Due date for ${task.name}`}>
          <DateSelect
            variant="table-cell"
            className="w-full cursor-pointer text-12! text-inherit! disabled:cursor-wait"
            value={getDate(task.target_date) ?? null}
            defaultMonth={getDate(today)}
            minDate={getDate(task.start_date && task.start_date > today ? task.start_date : today)}
            placeholder="—"
            formatToken={due.label === "Today" ? "'Today'" : "MMM dd, yyyy"}
            disabled={busy.has(task.id)}
            clearable
            clearLabel="Clear due date"
            weekStartsOn={profile?.start_of_the_week}
            align="end"
            onChange={(date) => {
              const next = date ? renderFormattedPayloadDate(date) : null;
              if (next !== undefined && next !== task.target_date) void onSetDueDate(task, next);
            }}
          />
        </div>
      ) : (
        due.label
      )}
    </td>
  );
}

function ProjectListRow(props: TaskRowProps) {
  const { task, canEdit, projectId, busy, onAddCollaborator } = props;
  return (
    <tr className="border-b border-subtle hover:bg-layer-transparent-hover">
      <TaskNameCell {...props} />
      <td className="px-2 py-1">
        <div className="flex items-center gap-1.5">
          <CollaboratorAvatars ids={task.assignee_ids} variant="project" />
          {canEdit && (
            <MemberSelect
              projectId={projectId}
              excludeIds={task.assignee_ids}
              value={null}
              onChange={(memberId) => void onAddCollaborator(task, memberId)}
              variant="icon-sm"
              placeholder={`Add collaborator to ${task.name}`}
              searchPlaceholder="Name or email"
              emptyMessage="No additional team members found"
              emptyTriggerIcon={<Plus aria-hidden="true" className="size-3.5" />}
              disabled={busy.has(task.id)}
              className={collaboratorAddButtonClass}
            />
          )}
        </div>
      </td>
      <td className="px-2 py-1">
        <TaskPriority task={task} canEdit={canEdit} busy={props.busy} onSetPriority={props.onSetPriority} />
      </td>
      <td className="px-2 py-1">
        <TaskStatus
          task={task}
          canEdit={canEdit}
          busy={props.busy}
          statusField={props.statusField}
          onSetStatus={props.onSetStatus}
        />
      </td>
      <TaskDueDate {...props} />
    </tr>
  );
}

type TaskTree = { task: TProjectListTask; children: TaskTree[] };

function taskTree(tasks: TProjectListTask[], sort: TaskSortOrder, today: string) {
  const ordered = sortTasks(tasks, sort, today, (task) => ({
    name: task.name,
    due: task.target_date,
    completed: isCompleted(task),
    updatedAt: task.updated_at,
  }));
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
  sort: TaskSortOrder;
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
        taskTree(group.tasks, sort, actions.today).map((node) => (
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
  const [sort, setSort] = useState<TaskSortOrder>("default");
  const collapse = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const { data: fields } = useCustomFields(workspaceSlug, projectId);
  const actions: TRowActions = {
    today: list.today,
    canEdit: list.canEdit,
    projectId,
    busy: list.busy,
    onToggle: list.toggle,
    onSetPriority: list.setPriority,
    onSetDueDate: list.setDueDate,
    onAddCollaborator: list.addCollaborator,
    statusField: fields?.find((field) => field.field_type === "single_select" && field.name.toLowerCase() === "status"),
    onSetStatus: list.setStatus,
    onOpen: list.open,
    onAdd: setCreating,
  };
  return (
    <section aria-label="Project tasks">
      <ProjectTasksToolbar
        list={list}
        onAdd={() => setCreating({})}
        sort={<TaskSortMenu value={sort} onChange={setSort} />}
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
