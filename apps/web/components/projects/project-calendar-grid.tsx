/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { addDays, addMonths, format, isSameMonth, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { calendarDays, dateKey } from "@/components/home/activity-overview.helpers";
import type { TCalendarView } from "@/components/home/activity-overview.helpers";
import { rowOnDate, taskStart } from "@/components/profile/my-tasks-board.helpers";
import type { TCalendarRow } from "@/components/profile/my-tasks-board.helpers";
import { CALENDAR_HOURS, calendarPeriodLabel, timeZoneLabel } from "./project-schedule.helpers";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LINE = "border-[#E8EDF5]";

function TaskChip<T extends TCalendarRow>({ row, onOpen }: { row: T; onOpen: (row: T) => void }) {
  return (
    <button
      type="button"
      title={row.name}
      onClick={() => onOpen(row)}
      className={`flex w-full min-w-0 items-center gap-1 rounded px-2 py-1 text-left text-11 font-medium ${
        row.completed
          ? "bg-[#E6F6EE] text-[#00845C] hover:bg-[#D5F0E3]"
          : "bg-[#E8F0FE] text-[#135DDD] hover:bg-[#D9E6FD]"
      }`}
    >
      {row.completed && <Check className="size-3 shrink-0" aria-label="Completed" />}
      <span className="truncate">{row.name}</span>
    </button>
  );
}

function AddOnDay({ day, onAdd }: { day: Date; onAdd: (day: string) => void }) {
  return (
    <button
      type="button"
      aria-label={`Add task on ${format(day, "d MMMM yyyy")}`}
      onClick={() => onAdd(dateKey(day))}
      className="rounded p-0.5 text-[#135DDD] opacity-0 group-hover:opacity-100 hover:bg-[#E8F0FE] focus-visible:opacity-100"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

/** Task chips for one day, collapsing to "+N more" in the Month view. */
function DayTasks<T extends TCalendarRow>({
  rows,
  limit,
  onOpen,
}: {
  rows: T[];
  limit: number;
  onOpen: (row: T) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, limit);
  return (
    <div className="flex flex-col gap-1">
      {shown.map((row) => (
        <TaskChip key={row.key} row={row} onOpen={onOpen} />
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
  );
}

type TGridProps<T extends TCalendarRow> = {
  days: Date[];
  today: string;
  rowsOn: (day: Date) => T[];
  onOpen: (row: T) => void;
  onAdd?: (day: string) => void;
};

function MonthGrid<T extends TCalendarRow>({
  days,
  today,
  rowsOn,
  onOpen,
  onAdd,
  anchor,
}: TGridProps<T> & { anchor: Date }) {
  return (
    <div className="min-w-[700px]">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className={`border-r border-b ${LINE} py-2 text-center text-11 font-medium text-secondary uppercase`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const isToday = key === today;
          return (
            <div
              key={key}
              aria-label={format(day, "EEEE, d MMMM yyyy")}
              className={`group min-h-24 min-w-0 border-r border-b ${LINE} p-2 ${isToday ? "bg-[#F3F7FF]" : ""}`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={`inline-grid size-6 place-items-center rounded-full text-12 ${
                    isToday
                      ? "bg-[#135DDD] font-semibold text-white"
                      : isSameMonth(day, anchor)
                        ? "text-[#384252]"
                        : "text-[#B5BFCE]"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {onAdd && <AddOnDay day={day} onAdd={onAdd} />}
              </div>
              <DayTasks rows={rowsOn(day)} limit={2} onOpen={onOpen} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Figma Week / Day calendar: day headers, an All day row for the date-only tasks, then 9 AM–4 PM hour rows. */
function HourGrid<T extends TCalendarRow>({
  days,
  today,
  rowsOn,
  onOpen,
  onAdd,
  zone,
}: TGridProps<T> & { zone: string }) {
  const single = days.length === 1;
  const columns: CSSProperties = { gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` };
  return (
    <div className={single ? "" : "min-w-[760px]"}>
      <div className="grid" style={columns}>
        <div className={`border-r border-b ${LINE} py-2 text-center text-10 font-medium text-secondary uppercase`}>
          {zone}
        </div>
        {days.map((day) => {
          const isToday = dateKey(day) === today;
          return (
            <div
              key={dateKey(day)}
              className={`border-r border-b ${LINE} py-2 text-center text-11 font-medium uppercase ${
                isToday ? "bg-[#EAF1FD] text-[#135DDD]" : "text-secondary"
              }`}
            >
              {format(day, single ? "EEEE, MMMM d" : "EEE d")}
            </div>
          );
        })}
      </div>
      <div className="grid" style={columns}>
        <div className={`border-r border-b ${LINE} px-1 py-2 text-center text-10 text-secondary`}>All day</div>
        {days.map((day) => (
          <div
            key={dateKey(day)}
            aria-label={format(day, "EEEE, d MMMM yyyy")}
            className={`group min-h-16 min-w-0 border-r border-b ${LINE} p-1.5 ${dateKey(day) === today ? "bg-[#F3F7FF]" : ""}`}
          >
            {onAdd && (
              <div className="flex justify-end">
                <AddOnDay day={day} onAdd={onAdd} />
              </div>
            )}
            <div className={single ? "mx-auto max-w-sm" : ""}>
              <DayTasks rows={rowsOn(day)} limit={Number.POSITIVE_INFINITY} onOpen={onOpen} />
            </div>
          </div>
        ))}
        {CALENDAR_HOURS.map(({ hour, label }) => (
          <div key={hour} className="contents">
            <div className={`h-12 border-r border-b ${LINE} pt-1 text-center text-10 text-secondary`}>{label}</div>
            {days.map((day) => (
              <div key={dateKey(day)} aria-hidden="true" className={`h-12 border-r border-b ${LINE}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Figma project calendar: date navigation and Day / Week / Month switcher, a Week or Day hour grid (tasks have no
 * time, so they sit in the All day row) or a Month grid, and the Project tasks / Completed legend.
 */
export function ProjectCalendarGrid<T extends TCalendarRow>({
  rows,
  today,
  timeZone,
  onOpen,
  onAdd,
}: {
  rows: T[];
  today: string;
  timeZone?: string;
  onOpen: (row: T) => void;
  /** Shows a "+" on each day that adds a task due that day. */
  onAdd?: (day: string) => void;
}) {
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [view, setView] = useState<TCalendarView>("week");
  const current = anchor ?? parseISO(today);
  const days = calendarDays(current, view);
  const navigate = (direction: -1 | 1) =>
    setAnchor(
      view === "month" ? addMonths(current, direction) : addDays(current, direction * (view === "week" ? 7 : 1))
    );
  const rowsOn = (day: Date) => rows.filter((row) => rowOnDate(row, dateKey(day)));
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
            {calendarPeriodLabel(days, view, current)}
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
      <div className={`overflow-x-auto rounded border-t border-l ${LINE}`}>
        {view === "month" ? (
          <MonthGrid days={days} anchor={current} today={today} rowsOn={rowsOn} onOpen={onOpen} onAdd={onAdd} />
        ) : (
          <HourGrid
            key={view}
            days={days}
            today={today}
            rowsOn={rowsOn}
            onOpen={onOpen}
            onAdd={onAdd}
            zone={timeZoneLabel(timeZone, current)}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-11 text-secondary">
        <span className="font-medium text-[#135DDD]">Project tasks</span>
        <span className="font-medium text-[#00845C]">Completed</span>
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
