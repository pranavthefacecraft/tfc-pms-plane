/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { MyTasksTimeline } from "@/components/profile/my-tasks-timeline";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
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

export type TProjectTimelineRow = {
  key: string;
  name: string;
  due: string | null;
  completed: boolean;
  project: {
    start_date: string | null;
    project_id: string;
    project_identifier: string;
    sequence_id: number;
    state_color: string;
  };
  task: TProjectListTask;
};

/** One timeline row per visible task, in section order; completed tasks are grey, open ones green. */
export function projectTimelineRows(
  groups: TProjectListGroup[],
  projectId: string,
  identifier: string
): TProjectTimelineRow[] {
  return groups.flatMap((group) =>
    group.tasks.map((task) => {
      const completed = isCompleted(task);
      return {
        key: task.id,
        name: task.name,
        due: task.target_date?.slice(0, 10) ?? null,
        completed,
        project: {
          start_date: task.start_date?.slice(0, 10) ?? null,
          project_id: projectId,
          project_identifier: identifier,
          sequence_id: task.sequence_id,
          state_color: completed ? "#94A3B8" : "#00845C",
        },
        task,
      };
    })
  );
}

/** Figma project Timeline tab: the List/Board toolbar above the Gantt task timeline; drag bars to reschedule. */
export const ProjectTimeline = observer(function ProjectTimeline({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const list = useProjectTaskList(workspaceSlug, projectId);
  const [creating, setCreating] = useState<TCreateTarget | null>(null);
  const rows = projectTimelineRows(list.groups, projectId, list.identifier);
  return (
    <section aria-label="Project timeline">
      <ProjectTasksToolbar list={list} onAdd={() => setCreating({})} />
      {list.failed || list.loading ? (
        <ProjectTasksLoadState failed={list.failed} onRetry={list.retry} />
      ) : list.empty ? (
        <NoMatchingTasks filtered={list.filtered} onReset={list.reset} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[#E2E6EF]">
            <MyTasksTimeline
              rows={rows}
              canEdit={(row) => list.canEdit && !list.busy.has(row.key)}
              onOpen={(row) => list.open(row.task)}
              onReschedule={(row, dates) => list.reschedule(row.task, dates)}
            />
          </div>
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
