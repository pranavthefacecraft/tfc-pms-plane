/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { EIssuesStoreType } from "@plane/types";
import { TaskSearch } from "@/components/common/task-search";
import { CreateTaskEntry } from "@/components/issues/create-task-entry";
import { ProjectListFilters } from "./project-list-filters";
import type { TProjectTaskListState } from "./use-project-task-list";

/**
 * `sectionId` is undefined for the top "Add task" button, so the project's default section is used.
 * `targetDate` presets the due date when adding from a Calendar day.
 */
export type TCreateTarget = { sectionId?: string | null; targetDate?: string; parentId?: string };

export function AddTaskButton({ onClick, outlined }: { onClick: () => void; outlined?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${outlined ? "h-[38px] w-[116px] gap-2 border border-subtle bg-white text-14 text-primary hover:bg-layer-1-hover dark:bg-surface-1" : "h-8 gap-1.5 bg-[#135DDD] px-4 text-13 text-white hover:bg-[#0F4FC0]"}`}
    >
      <Plus className="size-4" />
      Add task
    </button>
  );
}

/** "+ Add task" on the left, Filter and search on the right, shared by the project List and Board tabs. */
export function ProjectTasksToolbar({
  list,
  onAdd,
  sort,
}: {
  list: Pick<TProjectTaskListState, "canEdit" | "filters" | "setFilters" | "query" | "setQuery">;
  onAdd: () => void;
  sort?: ReactNode;
}) {
  const isList = Boolean(sort);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {list.canEdit ? <AddTaskButton onClick={onAdd} outlined={isList} /> : <span />}
      <div className={`flex items-center ${isList ? "ml-auto flex-wrap justify-end gap-3" : "gap-2"}`}>
        <ProjectListFilters filters={list.filters} onApply={list.setFilters} spacious={isList} />
        {sort}
        <TaskSearch query={list.query} setQuery={list.setQuery} spacious={isList} />
      </div>
    </div>
  );
}

export function ProjectTasksLoadState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return failed ? (
    <div role="alert" className="py-8 text-13">
      Could not load this project&apos;s tasks.{" "}
      <button type="button" className="text-[#135DDD] underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  ) : (
    <p role="status" className="py-8 text-13 text-secondary">
      Loading tasks...
    </p>
  );
}

export function NoMatchingTasks({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="py-6 text-center text-13 text-secondary">
      {filtered ? "No matching tasks." : "No tasks yet."}
      {filtered && (
        <button type="button" className="ml-2 text-[#135DDD] underline" onClick={onReset}>
          Clear filters
        </button>
      )}
    </div>
  );
}

/** The New Task side form, with the project fixed and the chosen section preselected. */
export function ProjectTaskCreateModal({
  projectId,
  target,
  onClose,
  onCreated,
}: {
  projectId: string;
  target: TCreateTarget | null;
  onClose: () => void;
  onCreated: () => Promise<unknown>;
}) {
  const created = async () => {
    await onCreated();
  };
  return (
    <CreateTaskEntry
      isOpen={target !== null}
      onClose={onClose}
      data={{
        project_id: projectId,
        ...(target?.sectionId !== undefined && { section_id: target.sectionId }),
        ...(target?.targetDate && { target_date: target.targetDate }),
        ...(target?.parentId && { parent_id: target.parentId }),
      }}
      storeType={EIssuesStoreType.PROJECT}
      isProjectSelectionDisabled
      onSubmit={created}
    />
  );
}
