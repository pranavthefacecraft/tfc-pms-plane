/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderFormattedDate } from "@plane/utils";
import { sectionColumn } from "@/components/profile/my-tasks-board.helpers";
import type { TProjectListTask, TProjectTaskList } from "@/services/project/project-task-list.service";
import { NO_SECTION_KEY, isCompleted } from "./project-list.helpers";
import type { TProjectListGroup } from "./project-list.helpers";

/** Stage column colours, cycled by position like the Figma board (grey, blue, orange, green). */
const STAGE_PALETTE = [
  { title: "text-[#384252]", badge: "bg-[#EEF1F5] text-[#536175]" },
  { title: "text-[#135DDD]", badge: "bg-[#E7F0FF] text-[#135DDD]" },
  { title: "text-[#9A4A0B]", badge: "bg-[#FFF1E5] text-[#D9730D]" },
  { title: "text-[#00875A]", badge: "bg-[#E6F6F1] text-[#009E79]" },
] as const;

export function stageColors(group: TProjectListGroup, index: number) {
  if (group.key === NO_SECTION_KEY) return STAGE_PALETTE[0];
  return STAGE_PALETTE[index % STAGE_PALETTE.length];
}

/** A stage named like "Done" or "Completed" completes tasks moved into it. */
export const isDoneStage = (group: Pick<TProjectListGroup, "name">) => sectionColumn(group.name) === "done";

/**
 * Builds the work item update for dropping a task on a stage: it takes the stage's section, is completed when the
 * stage is a Done stage, and is reopened when a completed task moves out of a Done stage into another stage.
 */
export function boardMovePatch(
  task: TProjectListTask,
  group: TProjectListGroup,
  states: Pick<TProjectTaskList, "completed_state_id" | "default_state_id"> | undefined
) {
  const patch: { section_id: string | null; state_id?: string } = { section_id: group.sectionId };
  const completed = isCompleted(task);
  if (isDoneStage(group) && !completed) {
    if (!states?.completed_state_id) throw new Error("This project has no completed state.");
    patch.state_id = states.completed_state_id;
  } else if (!isDoneStage(group) && completed) {
    if (!states?.default_state_id) throw new Error("This project has no default state.");
    patch.state_id = states.default_state_id;
  }
  return patch;
}

export function boardDueDetails(task: TProjectListTask, today: string) {
  const due = task.target_date?.slice(0, 10);
  if (!due) return null;
  const label = renderFormattedDate(due, "MMM d") ?? due;
  if (!isCompleted(task) && due <= today) return { label, className: "font-medium text-[#C2410C]" };
  return { label, className: "text-secondary" };
}
