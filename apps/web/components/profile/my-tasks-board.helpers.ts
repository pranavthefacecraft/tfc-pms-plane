import type { TMyTaskListItem } from "@/services/workspace-my-tasks.service";
import type { TPersonalTask } from "@/services/personal-task.service";
import type { TProjectSection } from "@/services/project/project-section.service";
export type TaskRow = { key: string; name: string; due: string | null; completed: boolean } & (
  | { personal: TPersonalTask; project?: never }
  | { project: TMyTaskListItem; personal?: never }
);

export type TBoardColumn = "todo" | "progress" | "review" | "done";

export const BOARD_COLUMNS = [
  { id: "todo", label: "To Do", badge: "bg-[#EEF1F5] text-[#536175]", title: "text-[#384252]" },
  { id: "progress", label: "In Progress", badge: "bg-[#E7F0FF] text-[#135DDD]", title: "text-[#135DDD]" },
  { id: "review", label: "Waiting For Review", badge: "bg-[#FFF1E5] text-[#D9730D]", title: "text-[#9A4A0B]" },
  { id: "done", label: "Done", badge: "bg-[#E6F6F1] text-[#009E79]", title: "text-[#00875A]" },
] as const satisfies readonly { id: TBoardColumn; label: string; badge: string; title: string }[];

export function boardColumnLabel(column: TBoardColumn) {
  return BOARD_COLUMNS.find((item) => item.id === column)?.label ?? column;
}

/** Maps a project section name such as "To Do" or "Waiting for review" to its board column. */
export function sectionColumn(name: string | null | undefined): TBoardColumn | null {
  const normalized = (name ?? "").toLocaleLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return null;
  if (normalized.includes("review")) return "review";
  if (normalized.includes("progress")) return "progress";
  if (normalized === "todo" || normalized === "todos") return "todo";
  if (normalized === "done" || normalized === "complete" || normalized === "completed") return "done";
  return null;
}

/** Completed tasks are always Done; otherwise the project section decides, falling back to the state group. */
export function boardColumn(row: TaskRow): TBoardColumn | null {
  if (row.completed) return "done";
  if (row.personal) return "todo";
  if (row.project.state_group === "cancelled") return null;
  const fromSection = sectionColumn(row.project.section_name);
  if (fromSection && fromSection !== "done") return fromSection;
  return row.project.state_group === "started" ? "progress" : "todo";
}

/** Builds the issue update needed to move a project task into a board column. */
export function projectMovePatch(
  row: Extract<TaskRow, { project: object }>,
  column: TBoardColumn,
  sections: TProjectSection[]
) {
  const task = row.project;
  const section = sections.find((item) => sectionColumn(item.name) === column);
  const data: { section_id?: string; state_id?: string } = {};
  if (section) data.section_id = section.id;
  if (column === "done" && !row.completed) {
    if (!task.completed_state_id) throw new Error(`${task.project_name} has no completed state.`);
    data.state_id = task.completed_state_id;
  }
  if (column !== "done" && row.completed) {
    if (!task.default_state_id) throw new Error(`${task.project_name} has no default state.`);
    data.state_id = task.default_state_id;
  }
  const current = sectionColumn(task.section_name);
  const reopensToColumn = column === "todo" && row.completed && (!current || current === "todo" || current === "done");
  if (!section && column !== "done" && !reopensToColumn)
    throw new Error(`${task.project_name} has no "${boardColumnLabel(column)}" section.`);
  return data;
}

export function taskStart(row: TaskRow) {
  const start = row.personal?.start_date ?? row.project?.start_date ?? null;
  return start ?? row.due;
}

/** A task appears on every day from its start date through its due date. */
export function rowOnDate(row: TaskRow, day: string) {
  const start = taskStart(row);
  const end = row.due ?? start;
  return Boolean(start && end && start <= day && day <= end);
}
