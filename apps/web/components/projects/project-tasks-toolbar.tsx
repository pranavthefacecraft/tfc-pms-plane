/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Plus } from "lucide-react";
import { EIssuesStoreType } from "@plane/types";
import { TaskSearch } from "@/components/common/task-search";
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
import { ProjectListFilters } from "./project-list-filters";
import type { TProjectTaskListState } from "./use-project-task-list";

/** `sectionId` is undefined for the top "Add task" button, so the project's default section is used. */
export type TCreateTarget = { sectionId?: string | null };

/** "+ Add task" on the left, Filter and search on the right, shared by the project List and Board tabs. */
export function ProjectTasksToolbar({
  list,
  onAdd,
}: {
  list: Pick<TProjectTaskListState, "canEdit" | "filters" | "setFilters" | "query" | "setQuery">;
  onAdd: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {list.canEdit ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#135DDD] px-4 text-13 font-medium text-white hover:bg-[#0F4FC0]"
        >
          <Plus className="size-4" />
          Add task
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <ProjectListFilters filters={list.filters} onApply={list.setFilters} />
        <TaskSearch query={list.query} setQuery={list.setQuery} />
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

/** The standard create work item form, with the project fixed and the chosen section preselected. */
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
    <CreateUpdateIssueModal
      isOpen={target !== null}
      onClose={onClose}
      data={{
        project_id: projectId,
        ...(target?.sectionId !== undefined && { section_id: target.sectionId }),
      }}
      storeType={EIssuesStoreType.PROJECT}
      isProjectSelectionDisabled
      onSubmit={created}
    />
  );
}
