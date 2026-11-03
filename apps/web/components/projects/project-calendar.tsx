/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { MyTasksCalendar } from "@/components/profile/my-tasks-calendar";
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

export type TProjectCalendarRow = {
  key: string;
  name: string;
  due: string | null;
  completed: boolean;
  project: { start_date: string | null };
  task: TProjectListTask;
};

/** Turns the List/Board section groups back into one calendar row per visible task. */
export function projectCalendarRows(groups: TProjectListGroup[]): TProjectCalendarRow[] {
  return groups.flatMap((group) =>
    group.tasks.map((task) => ({
      key: task.id,
      name: task.name,
      due: task.target_date?.slice(0, 10) ?? null,
      completed: isCompleted(task),
      project: { start_date: task.start_date?.slice(0, 10) ?? null },
      task,
    }))
  );
}

/** Figma project Calendar tab: the List/Board toolbar above a Day / Week / Month calendar of the project's tasks. */
export const ProjectCalendar = observer(function ProjectCalendar({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const list = useProjectTaskList(workspaceSlug, projectId);
  const [creating, setCreating] = useState<TCreateTarget | null>(null);
  const rows = projectCalendarRows(list.groups);
  return (
    <section aria-label="Project calendar">
      <ProjectTasksToolbar list={list} onAdd={() => setCreating({})} />
      {list.failed || list.loading ? (
        <ProjectTasksLoadState failed={list.failed} onRetry={list.retry} />
      ) : (
        <>
          {list.empty && list.filtered && <NoMatchingTasks filtered onReset={list.reset} />}
          <MyTasksCalendar
            rows={rows}
            today={list.today}
            onOpen={(row) => list.open(row.task)}
            onAdd={list.canEdit ? (day) => setCreating({ targetDate: day }) : undefined}
            legend={
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#00845C]" />
                Task (shown from its start date to its due date)
              </span>
            }
          />
          {list.truncated && (
            <p className="py-3 text-12 text-secondary">
              Showing the first 1,000 tasks. Use Work items for the full calendar.
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
