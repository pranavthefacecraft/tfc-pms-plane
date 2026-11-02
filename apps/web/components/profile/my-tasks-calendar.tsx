import { useState } from "react";
import { addDays, addMonths, format, isSameMonth, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDays, dateKey } from "@/components/home/activity-overview.helpers";
import type { TCalendarView } from "@/components/home/activity-overview.helpers";
import { rowOnDate, taskStart } from "./my-tasks-board.helpers";
import type { TaskRow } from "./my-tasks-board.helpers";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarChip({ row, onOpen }: { row: TaskRow; onOpen: (row: TaskRow) => void }) {
  return (
    <button
      type="button"
      title={row.name}
      onClick={() => onOpen(row)}
      className={`flex w-full min-w-0 items-center gap-1 rounded px-2 py-1 text-left text-11 ${
        row.personal
          ? "bg-[#E8F0FE] text-[#135DDD] hover:bg-[#D9E6FD]"
          : "bg-[#E6F6EE] text-[#00845C] hover:bg-[#D5F0E3]"
      } ${row.completed ? "line-through opacity-70" : ""}`}
    >
      {row.completed && <Check className="size-3 shrink-0" aria-label="Completed" />}
      <span className="truncate">{row.name}</span>
    </button>
  );
}

function CalendarCell({
  day,
  anchor,
  view,
  today,
  rows,
  onOpen,
}: {
  day: Date;
  anchor: Date;
  view: TCalendarView;
  today: string;
  rows: TaskRow[];
  onOpen: (row: TaskRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const key = dateKey(day);
  const isToday = key === today;
  const outside = view === "month" && !isSameMonth(day, anchor);
  const limit = view === "month" ? 2 : rows.length;
  const shown = expanded ? rows : rows.slice(0, limit);
  return (
    <div
      aria-label={format(day, "EEEE, d MMMM yyyy")}
      className={`min-w-0 border-r border-b border-[#E8EDF5] p-2 ${view === "month" ? "min-h-24" : "min-h-64"} ${isToday ? "bg-[#F3F7FF]" : ""}`}
    >
      <span
        className={`mb-1.5 inline-grid size-6 place-items-center rounded-full text-12 ${
          isToday ? "bg-[#135DDD] font-semibold text-white" : outside ? "text-[#B5BFCE]" : "text-[#384252]"
        }`}
      >
        {format(day, "d")}
      </span>
      <div className="flex flex-col gap-1">
        {shown.map((row) => (
          <CalendarChip key={row.key} row={row} onOpen={onOpen} />
        ))}
        {rows.length > limit && (
          <button
            type="button"
            aria-expanded={expanded}
            className="text-left text-11 text-[#135DDD]"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : `+${rows.length - limit} more`}
          </button>
        )}
      </div>
    </div>
  );
}

export function MyTasksCalendar({
  rows,
  today,
  onOpen,
}: {
  rows: TaskRow[];
  today: string;
  onOpen: (row: TaskRow) => void;
}) {
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [view, setView] = useState<TCalendarView>("month");
  const current = anchor ?? parseISO(today);
  const days = calendarDays(current, view);
  const navigate = (direction: -1 | 1) =>
    setAnchor(
      view === "month" ? addMonths(current, direction) : addDays(current, direction * (view === "week" ? 7 : 1))
    );
  const undated = rows.filter((row) => !taskStart(row)).length;
  return (
    <section aria-label="Task calendar" className="rounded-lg border border-[#E2E6EF] bg-surface-1 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous period"
            className="rounded border border-subtle p-1 hover:bg-layer-1-hover"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            aria-live="polite"
            className="min-w-36 rounded border border-subtle px-3 py-1 text-center text-12 text-secondary"
          >
            {format(current, view === "day" ? "d MMMM yyyy" : "MMMM yyyy")}
          </span>
          <button
            type="button"
            aria-label="Next period"
            className="rounded border border-subtle p-1 hover:bg-layer-1-hover"
            onClick={() => navigate(1)}
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            className="rounded border border-subtle px-3 py-1 text-12 hover:bg-layer-1-hover"
            onClick={() => setAnchor(null)}
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
              onClick={() => setView(option)}
              className={`rounded-md px-4 py-1 text-12 ${view === option ? "bg-surface-1 font-medium text-primary shadow-raised-100" : "text-secondary hover:text-primary"}`}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded border-t border-l border-[#E8EDF5]">
        <div className={view === "day" ? "" : "min-w-[700px]"}>
          <div className={`grid bg-[#F7F9FC] ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
            {(view === "day" ? [format(current, "EEE")] : WEEKDAYS).map((label) => (
              <div
                key={label}
                className="border-r border-b border-[#E8EDF5] py-2 text-center text-11 font-medium text-secondary uppercase"
              >
                {label}
              </div>
            ))}
          </div>
          <div className={`grid ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
            {days.map((day) => (
              <CalendarCell
                key={`${view}-${dateKey(day)}`}
                day={day}
                anchor={current}
                view={view}
                today={today}
                rows={rows.filter((row) => rowOnDate(row, dateKey(day)))}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-11 text-secondary">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#135DDD]" />
          Personal task
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#00845C]" />
          PMS task
        </span>
        <span>Select a task to open its details</span>
        {undated > 0 && (
          <span>
            {undated} task{undated === 1 ? "" : "s"} without dates are only shown in List and Board.
          </span>
        )}
      </div>
    </section>
  );
}
