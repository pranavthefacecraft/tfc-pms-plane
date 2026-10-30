import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import sortBy from "lodash-es/sortBy";
import type { TPersonalTask } from "@/services/personal-task.service";
import type { TScheduledProjectTask } from "@/services/workspace-my-tasks.service";

export type TCalendarView = "day" | "week" | "month";
export type TActivityFilter = {
  pms: boolean;
  personal: boolean;
  company: boolean;
  excludedProjects: string[];
};
export const defaultActivityFilter: TActivityFilter = {
  pms: true,
  personal: true,
  company: true,
  excludedProjects: [],
};
export function matchesActivityFilter(task: TOverviewTask, filter: TActivityFilter) {
  if (!filter.pms) return false;
  if (task.personal) return filter.personal;
  return filter.company && !filter.excludedProjects.includes(task.project.project_id);
}
export type TOverviewTask = {
  key: string;
  name: string;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  completed: boolean;
} & ({ personal: TPersonalTask; project?: never } | { project: TScheduledProjectTask; personal?: never });

export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");

export function zonedDateKey(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

export function calendarDays(anchor: Date, view: TCalendarView) {
  if (view === "day") return [anchor];
  const start = startOfWeek(view === "month" ? startOfMonth(anchor) : anchor, { weekStartsOn: 1 });
  const end = endOfWeek(view === "month" ? endOfMonth(anchor) : anchor, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function overviewTasks(
  personal: TPersonalTask[],
  projects: TScheduledProjectTask[],
  timeZone?: string
): TOverviewTask[] {
  return sortBy(
    [
      ...personal.map((task) => ({
        ...task,
        target_date:
          !task.start_date && !task.target_date ? zonedDateKey(new Date(task.created_at), timeZone) : task.target_date,
        key: `personal-${task.id}`,
        completed: Boolean(task.completed_at),
        personal: task,
      })),
      ...projects.map((task) => ({
        ...task,
        key: `project-${task.id}`,
        completed: task.state_group === "completed",
        project: task,
      })),
    ],
    ["name", "key"]
  );
}

export function taskOnDate(task: TOverviewTask, day: string) {
  const start = task.start_date ?? task.target_date;
  const end = task.target_date ?? task.start_date;
  return Boolean(start && end && start <= day && day <= end);
}

export function taskActiveToday(task: TOverviewTask, today: string, timeZone?: string) {
  return (
    (!task.completed && taskOnDate(task, today)) ||
    (task.completed && task.completed_at !== null && zonedDateKey(new Date(task.completed_at), timeZone) === today)
  );
}
