/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { TaskSearch } from "@/components/common/task-search";
import { ProjectGantt } from "./project-gantt";
import { ProjectListFilters } from "./project-list-filters";
import {
  AddTaskButton,
  NoMatchingTasks,
  ProjectTaskCreateModal,
  ProjectTasksLoadState,
  ProjectTasksToolbar,
} from "./project-tasks-toolbar";
import type { TCreateTarget } from "./project-tasks-toolbar";
import { useProjectTaskList } from "./use-project-task-list";

/** Figma project Timeline tab: stage-grouped Gantt chart of the project's tasks; editors drag bars to reschedule. */
export const ProjectTimeline = observer(function ProjectTimeline({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const list = useProjectTaskList(workspaceSlug, projectId);
  const [creating, setCreating] = useState<TCreateTarget | null>(null);
  return (
    <section aria-label="Project timeline">
      {list.failed || list.loading ? (
        <>
          <ProjectTasksToolbar list={list} onAdd={() => setCreating({})} />
          <ProjectTasksLoadState failed={list.failed} onRetry={list.retry} />
        </>
      ) : (
        <>
          <ProjectGantt
            groups={list.groups}
            today={list.today}
            canEdit={(task) => list.canEdit && !list.busy.has(task.id)}
            onOpen={list.open}
            onReschedule={list.reschedule}
            leading={list.canEdit ? <AddTaskButton onClick={() => setCreating({})} /> : null}
            trailing={
              <>
                <ProjectListFilters filters={list.filters} onApply={list.setFilters} />
                <TaskSearch query={list.query} setQuery={list.setQuery} />
              </>
            }
            empty={list.empty ? <NoMatchingTasks filtered={list.filtered} onReset={list.reset} /> : undefined}
          />
          {list.truncated && (
            <p className="py-3 text-12 text-secondary">
              Showing the first 1,000 tasks. Use Work items for the full timeline.
            </p>
          )}
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
