/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Check, Plus } from "lucide-react";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { useProject } from "@/hooks/store/use-project";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
import { AddStage } from "./add-stage";
import { boardDueDetails, stageColors } from "./project-board.helpers";
import { isCompleted } from "./project-list.helpers";
import type { TProjectListGroup } from "./project-list.helpers";
import {
  NoMatchingTasks,
  ProjectTaskCreateModal,
  ProjectTasksLoadState,
  ProjectTasksToolbar,
} from "./project-tasks-toolbar";
import type { TCreateTarget } from "./project-tasks-toolbar";
import { useProjectTaskList } from "./use-project-task-list";

type TCardActions = {
  today: string;
  canEdit: boolean;
  busy: Set<string>;
  projectName: string;
  onOpen: (task: TProjectListTask) => void;
  onDragStart: (task: TProjectListTask) => void;
};

function BoardCard({
  task,
  today,
  canEdit,
  busy,
  projectName,
  onOpen,
  onDragStart,
}: TCardActions & { task: TProjectListTask }) {
  const due = boardDueDetails(task, today);
  const completed = isCompleted(task);
  const pending = busy.has(task.id);
  const draggable = canEdit && !pending;
  return (
    <button
      type="button"
      draggable={draggable}
      disabled={pending}
      aria-label={task.name}
      onClick={() => onOpen(task)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart(task);
      }}
      className={`flex min-h-[86px] w-full flex-col gap-1.5 rounded-md border border-subtle bg-surface-1 p-3 text-left shadow-raised-100 hover:border-strong disabled:cursor-wait disabled:opacity-60 ${draggable ? "cursor-grab" : "cursor-pointer"}`}
    >
      <span className={`flex items-start gap-1.5 text-13 font-medium ${completed ? "text-secondary" : "text-primary"}`}>
        {completed && <Check className="mt-0.5 size-3.5 shrink-0 text-[#009E79]" aria-label="Completed" />}
        <span className={completed ? "line-through" : ""}>{task.name}</span>
      </span>
      <span className="truncate text-11 text-secondary">{projectName}</span>
      {due && <span className={`text-11 ${due.className}`}>{due.label}</span>}
    </button>
  );
}

function BoardColumn({
  group,
  index,
  dragging,
  onDrop,
  onAdd,
  ...actions
}: TCardActions & {
  group: TProjectListGroup;
  index: number;
  dragging: { current: TProjectListTask | null };
  onDrop: (task: TProjectListTask, group: TProjectListGroup) => void;
  onAdd: (target: TCreateTarget) => void;
}) {
  const [over, setOver] = useState(false);
  const colors = stageColors(group, index);
  return (
    <section
      aria-label={group.name}
      onDragOver={(event) => {
        if (!dragging.current) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        const task = dragging.current;
        dragging.current = null;
        setOver(false);
        if (task && (task.section_id ?? null) !== group.sectionId) onDrop(task, group);
      }}
      className={`flex max-h-[calc(100vh-300px)] min-h-[340px] w-[200px] shrink-0 flex-col rounded-md bg-[#F4F6FA] p-2 ${over ? "ring-2 ring-[#135DDD]/40" : ""}`}
    >
      <header className="mb-2 flex items-center justify-between gap-2 px-1 pt-1">
        <h3 className={`truncate text-13 font-semibold ${colors.title}`}>{group.name}</h3>
        <span className={`min-w-5 rounded px-1.5 py-0.5 text-center text-10 font-medium ${colors.badge}`}>
          {group.tasks.length}
        </span>
      </header>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {group.tasks.map((task) => (
          <BoardCard key={task.id} task={task} {...actions} />
        ))}
      </div>
      {actions.canEdit && (
        <button
          type="button"
          onClick={() => onAdd({ sectionId: group.sectionId })}
          aria-label={`Add task in ${group.name}`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-surface-1 px-5 py-2 text-12 text-[#135DDD] hover:bg-layer-1-hover"
        >
          <Plus className="size-3.5" />
          Add task
        </button>
      )}
    </section>
  );
}

/** Figma project Board tab: one column per project section (stage), with drag to move, add task and add stage. */
export const ProjectBoard = observer(function ProjectBoard({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const list = useProjectTaskList(workspaceSlug, projectId);
  const { getProjectById } = useProject();
  const [creating, setCreating] = useState<TCreateTarget | null>(null);
  const dragging = useRef<TProjectListTask | null>(null);
  const actions: TCardActions = {
    today: list.today,
    canEdit: list.canEdit,
    busy: list.busy,
    projectName: getProjectById(projectId)?.name ?? "",
    onOpen: list.open,
    onDragStart: (task) => {
      dragging.current = task;
    },
  };
  const drop = (task: TProjectListTask, group: TProjectListGroup) => void list.move(task, group);
  return (
    <section aria-label="Project board">
      <ProjectTasksToolbar list={list} onAdd={() => setCreating({})} />
      {list.failed || list.loading ? (
        <ProjectTasksLoadState failed={list.failed} onRetry={list.retry} />
      ) : (
        <>
          <div className="flex w-full gap-3 overflow-x-auto pb-2">
            {list.groups.map((group, index) => (
              <BoardColumn
                key={group.key}
                group={group}
                index={index}
                dragging={dragging}
                onDrop={drop}
                onAdd={setCreating}
                {...actions}
              />
            ))}
          </div>
          {list.empty && list.filtered && <NoMatchingTasks filtered onReset={list.reset} />}
          {list.truncated && (
            <p className="py-3 text-12 text-secondary">
              Showing the first 1,000 tasks. Use Work items for the full board.
            </p>
          )}
          {list.canEdit && <AddStage onCreate={list.addSection} />}
        </>
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
