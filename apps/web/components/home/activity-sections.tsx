import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  UserRound,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import type { TCalendarView, TOverviewTask } from "./activity-overview.helpers";
import { dateKey, taskOnDate } from "./activity-overview.helpers";
import { ActivityFilter } from "./activity-filter";
import { defaultActivityFilter, matchesActivityFilter } from "./activity-overview.helpers";

type TaskSectionProps = {
  tasks: TOverviewTask[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenTask: (task: TOverviewTask) => void;
};

const panelClass = "rounded-xl border border-[#E2E6EF] bg-surface-1 dark:border-subtle";
type TaskActions = {
  onShareTask: (task: TOverviewTask) => void;
  onDeleteTask: (task: TOverviewTask) => void;
  canDeleteTask: (task: TOverviewTask) => boolean;
};

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="p-6 text-center text-13 text-danger-primary">
      Could not load your tasks.{" "}
      <button type="button" className="underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function CalendarTask({ task, onOpen }: { task: TOverviewTask; onOpen: (task: TOverviewTask) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="dark:bg-emerald-950 dark:hover:bg-emerald-900 flex w-full min-w-0 flex-col items-start gap-1 rounded bg-[#E6F7EF] px-2 py-2 text-left text-12 hover:bg-[#D5F0E3]"
      title={task.name}
    >
      <span className="dark:text-emerald-200 text-11 text-[#00845C]">
        {task.target_date ? `Due ${format(parseISO(task.target_date), "d MMM")}` : "All day"}
      </span>
      <span className={`flex items-start gap-1 ${task.completed ? "line-through" : ""}`}>
        {task.completed && <Check className="mt-0.5 size-3 shrink-0" aria-label="Completed" />}
        <span className="line-clamp-2 break-words">{task.name}</span>
      </span>
    </button>
  );
}

export type TActivityAssignee = { id: string; name: string };

function ActivityAssignees({
  people,
  task,
  onOpenTask,
}: {
  people: TActivityAssignee[];
  task: TOverviewTask;
  onOpenTask: (task: TOverviewTask) => void;
}) {
  return (
    <div className="flex items-center justify-center">
      <div className="flex -space-x-1">
        {people.slice(0, 2).map((person) => (
          <span
            key={person.id}
            title={person.name || "Team member"}
            aria-label={person.name || "Team member"}
            className="border-surface-1 flex size-6 items-center justify-center rounded-full border bg-[#135DDD] text-11 font-medium text-white"
          >
            {person.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase() || <UserRound className="size-3" />}
          </span>
        ))}
        {people.length > 2 && (
          <span
            title={people
              .slice(2)
              .map((person) => person.name)
              .join(", ")}
            aria-label={`${people.length - 2} more assignees`}
            className="border-surface-1 flex size-6 items-center justify-center rounded-full border bg-[#EAF2FF] text-11 font-medium text-[#135DDD]"
          >
            +{people.length - 2}
          </span>
        )}
      </div>
      {task.project && (
        <button
          type="button"
          aria-label={`Edit assignees for ${task.name}`}
          title="Edit assignees in task details"
          onClick={() => onOpenTask(task)}
          className="ml-1 flex size-6 items-center justify-center rounded-full border border-dashed border-[#135DDD] bg-[#EAF2FF] text-[#135DDD] hover:bg-[#DBE9FF]"
        >
          <Plus className="size-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function ActivityTaskRow({
  task,
  people,
  onOpenTask,
  onShareTask,
  onDeleteTask,
  canDeleteTask,
}: {
  task: TOverviewTask;
  people: TActivityAssignee[];
  onOpenTask: (task: TOverviewTask) => void;
} & TaskActions) {
  return (
    <tr className="border-t border-[#E8EDF5] hover:bg-layer-1-hover dark:border-subtle">
      <td className="py-1.5 pr-3">
        <button type="button" className="block w-full text-left" onClick={() => onOpenTask(task)}>
          <span className={`flex items-center gap-1.5 text-13 font-medium ${task.completed ? "line-through" : ""}`}>
            {task.completed && <Check className="size-3 shrink-0" aria-label="Completed" />}
            <span className="line-clamp-2 break-words">{task.name}</span>
          </span>
          <span className="mt-0.5 block text-11 text-secondary">
            {task.project ? task.project.project_name : "Personal task"}
          </span>
        </button>
      </td>
      <td className="px-2 py-1.5">
        <ActivityAssignees people={people} task={task} onOpenTask={onOpenTask} />
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className="dark:bg-emerald-950 dark:text-emerald-200 inline-block min-w-14 rounded-full bg-[#ECFDF5] px-3 py-0.5 text-11 text-[#00664F]">
          PMS
        </span>
      </td>
      <td className="px-2 py-1.5 text-center text-12 text-secondary">
        {task.target_date ? (
          <span>
            Due <time dateTime={task.target_date}>{format(parseISO(task.target_date), "d MMM")}</time>
          </span>
        ) : task.start_date ? (
          <span>
            Starts <time dateTime={task.start_date}>{format(parseISO(task.start_date), "d MMM")}</time>
          </span>
        ) : (
          <span>No due date</span>
        )}
      </td>
      <td className="py-1.5 text-center">
        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                aria-label={`Actions for ${task.name}`}
                className="inline-flex rounded p-1 text-secondary hover:bg-layer-2"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
          <MenuContent side="bottom" align="end">
            <MenuItem label="Edit" icon={<Pencil className="size-4" />} onClick={() => onOpenTask(task)} />
            <MenuItem label="Share" icon={<Share2 className="size-4" />} onClick={() => onShareTask(task)} />
            <MenuSeparator />
            <MenuItem
              label="Delete"
              icon={<Trash2 className="size-4" />}
              variant="danger"
              disabled={!canDeleteTask(task)}
              onClick={() => onDeleteTask(task)}
            />
          </MenuContent>
        </Menu>
      </td>
    </tr>
  );
}

export function TodayActivity({
  tasks,
  assignees,
  loading,
  error,
  onRetry,
  onOpenTask,
  onShareTask,
  onDeleteTask,
  canDeleteTask,
}: TaskSectionProps & TaskActions & { assignees: Record<string, TActivityAssignee[]> }) {
  const [filter, setFilter] = useState(defaultActivityFilter);
  const visibleTasks = tasks.filter((task) => matchesActivityFilter(task, filter));
  return (
    <section aria-labelledby="todays-activity-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="todays-activity-title" className="text-16 font-semibold">
          Today&apos;s Activity
        </h2>
        <ActivityFilter tasks={tasks} value={filter} onApply={setFilter} />
      </div>
      <div className={`${panelClass} min-h-40`}>
        {error ? (
          <LoadError onRetry={onRetry} />
        ) : loading ? (
          <p role="status" className="p-6 text-13 text-secondary">
            Loading today&apos;s activity...
          </p>
        ) : visibleTasks.length ? (
          <div className="overflow-x-auto px-3 py-2">
            <table
              aria-label="Today's activity tasks"
              className="w-full min-w-[660px] table-fixed border-collapse text-left"
            >
              <thead>
                <tr className="font-normal text-11 text-secondary">
                  <th scope="col" className="font-normal w-[49%] py-2">
                    ACTIVITY
                  </th>
                  <th scope="col" className="font-normal w-[17%] px-2 py-2 text-center">
                    ASSIGNED TO
                  </th>
                  <th scope="col" className="font-normal w-[14%] px-2 py-2 text-center">
                    SOURCE
                  </th>
                  <th scope="col" className="font-normal w-[13%] px-2 py-2 text-center">
                    TIME
                  </th>
                  <th scope="col" className="font-normal w-[7%] py-2 text-center">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <ActivityTaskRow
                    key={task.key}
                    task={task}
                    people={assignees[task.key] ?? []}
                    onOpenTask={onOpenTask}
                    onShareTask={onShareTask}
                    onDeleteTask={onDeleteTask}
                    canDeleteTask={canDeleteTask}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#EAF2FF] text-[#135DDD]">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <h3 className="text-16 font-semibold">{tasks.length ? "No matching activity" : "No Activity Yet"}</h3>
            <p className="text-13 text-secondary">
              {tasks.length ? "Change your filters to show today's tasks." : "Your tasks and events will appear here."}
            </p>
            {tasks.length > 0 && (
              <button
                type="button"
                className="text-13 text-[#135DDD] underline"
                onClick={() => setFilter(defaultActivityFilter)}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CalendarDay({
  day,
  view,
  today,
  tasks,
  onOpenTask,
}: {
  day: Date;
  view: TCalendarView;
  today: string;
} & Pick<TaskSectionProps, "tasks" | "onOpenTask">) {
  const [expanded, setExpanded] = useState(false);
  const key = dateKey(day);
  const limit = view === "day" ? tasks.length : 2;
  const visible = expanded ? tasks : tasks.slice(0, limit);
  return (
    <div
      aria-label={format(day, "EEEE, d MMMM yyyy")}
      className={`min-w-0 border-r border-b border-[#E8EDF5] p-2 dark:border-subtle ${view === "month" ? "min-h-36" : "min-h-56"} ${key === today ? "bg-[#F7FAFF] dark:bg-layer-1" : ""}`}
    >
      <p className={`mb-2 text-12 font-medium ${key === today ? "text-[#135DDD]" : "text-secondary"}`}>
        {format(day, "EEE d")}
      </p>
      <div className="flex flex-col gap-2">
        {visible.map((task) => (
          <CalendarTask key={task.key} task={task} onOpen={onOpenTask} />
        ))}
        {!tasks.length && <span className="text-11 text-secondary">No tasks</span>}
        {tasks.length > limit && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Show fewer tasks" : `Show ${tasks.length - limit} more tasks`} for ${format(day, "d MMMM yyyy")}`}
            className="py-0.5 text-left text-11 text-[#135DDD]"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : `+${tasks.length - limit} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarGrid({
  days,
  view,
  today,
  tasks,
  onOpenTask,
}: {
  days: Date[];
  view: TCalendarView;
  today: string;
} & Pick<TaskSectionProps, "tasks" | "onOpenTask">) {
  const hasSchedule = days.some((day) => tasks.some((task) => taskOnDate(task, dateKey(day))));
  return (
    <div className="relative overflow-x-auto rounded-lg border border-[#E8EDF5] dark:border-subtle">
      <div className={`grid ${view === "day" ? "grid-cols-1" : "min-w-[700px] grid-cols-7"}`}>
        {days.map((day) => {
          const key = dateKey(day);
          return (
            <CalendarDay
              key={`${view}-${key}`}
              day={day}
              view={view}
              today={today}
              tasks={tasks.filter((task) => taskOnDate(task, key))}
              onOpenTask={onOpenTask}
            />
          );
        })}
      </div>
      {!hasSchedule && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-1/70 p-4 text-center">
          <CalendarDays className="size-6 text-secondary" aria-hidden="true" />
          <h3 className="text-14 font-semibold">No schedule yet</h3>
          <p className="text-13 text-secondary">Your scheduled tasks will appear here.</p>
        </div>
      )}
    </div>
  );
}

export function ActivityCalendar({
  days,
  anchor,
  view,
  today,
  tasks,
  loading,
  error,
  onRetry,
  onOpenTask,
  onNavigate,
  onToday,
  onViewChange,
  createAction,
}: {
  days: Date[];
  anchor: Date;
  view: TCalendarView;
  today: string;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewChange: (view: TCalendarView) => void;
  createAction?: ReactNode;
} & TaskSectionProps) {
  return (
    <section aria-labelledby="activity-calendar-title" className={`${panelClass} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="activity-calendar-title" className="text-16 font-semibold">
          User&apos;s Calendar
        </h2>
        {createAction}
      </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous period"
            className="rounded border border-subtle p-1.5 hover:bg-layer-1-hover"
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            aria-live="polite"
            className="min-w-32 rounded border border-subtle px-3 py-1.5 text-center text-12 text-secondary"
          >
            {format(anchor, view === "day" ? "d MMMM yyyy" : "MMMM yyyy")}
          </span>
          <button
            type="button"
            aria-label="Next period"
            className="rounded border border-subtle p-1.5 hover:bg-layer-1-hover"
            onClick={() => onNavigate(1)}
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            className="rounded border border-subtle px-3 py-1.5 text-12 hover:bg-layer-1-hover"
            onClick={onToday}
          >
            Today
          </button>
        </div>
        <div role="group" aria-label="Calendar view" className="flex rounded-lg bg-layer-1 p-1">
          {(["day", "week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => onViewChange(option)}
              className={`rounded-md px-4 py-1 text-12 ${view === option ? "shadow-sm bg-surface-1 font-medium text-primary" : "text-secondary hover:text-primary"}`}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <LoadError onRetry={onRetry} />
      ) : loading ? (
        <p role="status" className="p-6 text-13 text-secondary">
          Loading schedule...
        </p>
      ) : (
        <CalendarGrid days={days} view={view} today={today} tasks={tasks} onOpenTask={onOpenTask} />
      )}
      <div className="mt-2 flex items-center gap-1.5 text-11 text-secondary">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[#00845C]" />
        PMS tasks
      </div>
    </section>
  );
}
import { useState } from "react";
import type { ReactNode } from "react";
