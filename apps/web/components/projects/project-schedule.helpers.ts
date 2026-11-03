/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { sortBy } from "lodash-es";
import type { TCalendarView } from "@/components/home/activity-overview.helpers";
import type { TProjectListTask } from "@/services/project/project-task-list.service";

/** Hour rows shown in the Figma Week and Day calendars (9 AM to 4 PM). */
export const CALENDAR_HOURS = [9, 10, 11, 12, 13, 14, 15, 16].map((hour) => ({
  hour,
  label: `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`,
}));

/** "October 2026", "Oct 12–18, 2026" / "Sep 28 – Oct 4, 2026", or "Fri, Oct 16, 2026". */
export function calendarPeriodLabel(days: Date[], view: TCalendarView, anchor: Date) {
  if (view === "month") return format(anchor, "MMMM yyyy");
  if (view === "day") return format(anchor, "EEE, MMM d, yyyy");
  const first = days[0];
  const last = days[days.length - 1];
  if (isSameMonth(first, last)) return `${format(first, "MMM d")}–${format(last, "d, yyyy")}`;
  if (isSameYear(first, last)) return `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
  return `${format(first, "MMM d, yyyy")} – ${format(last, "MMM d, yyyy")}`;
}

/** Short time zone name for the hour column, e.g. "WITA" or "GMT+5:30"; falls back to the browser zone. */
export function timeZoneLabel(timeZone?: string, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export type TTimelineScale = "days" | "weeks" | "months";

export const TIMELINE_SCALES: { id: TTimelineScale; label: string }[] = [
  { id: "days", label: "Days" },
  { id: "weeks", label: "Weeks" },
  { id: "months", label: "Months" },
];

/** Pixels per day for each zoom level; a week column is 140px wide. */
export const TIMELINE_DAY_WIDTH: Record<TTimelineScale, number> = { days: 40, weeks: 20, months: 6 };

export type TTimelineShape = { kind: "bar"; start: string; end: string } | { kind: "milestone"; day: string } | null;

/** A task with a start and due date is a bar; a task with only a due date is a milestone diamond. */
export function timelineShape(task: Pick<TProjectListTask, "start_date" | "target_date">): TTimelineShape {
  const start = task.start_date?.slice(0, 10) ?? null;
  const due = task.target_date?.slice(0, 10) ?? null;
  if (start && due) return due < start ? { kind: "bar", start: due, end: start } : { kind: "bar", start, end: due };
  if (due) return { kind: "milestone", day: due };
  if (start) return { kind: "bar", start, end: start };
  return null;
}

const shapeDays = (shape: TTimelineShape) =>
  !shape ? [] : shape.kind === "bar" ? [shape.start, shape.end] : [shape.day];

/** The visible range: a week before the earliest date (or today) to three weeks after the latest, at least 12 weeks. */
export function timelineRange(shapes: TTimelineShape[], today: string, scale: TTimelineScale) {
  const keys = [today, ...shapes.flatMap(shapeDays)];
  const min = keys.reduce((a, b) => (b < a ? b : a));
  const max = keys.reduce((a, b) => (b > a ? b : a));
  const earliest = addDays(parseISO(min), -7);
  const latest = addDays(parseISO(max), 21);
  const start = scale === "months" ? startOfMonth(earliest) : startOfWeek(earliest, { weekStartsOn: 1 });
  let end = scale === "months" ? endOfMonth(latest) : endOfWeek(latest, { weekStartsOn: 1 });
  if (differenceInCalendarDays(end, start) < 83) end = addDays(start, 83);
  if (scale === "months") end = endOfMonth(end);
  return { start, days: differenceInCalendarDays(end, start) + 1 };
}

export type TTimelineSpan = { key: string; label: string; offset: number; span: number };

function spans(start: Date, days: number, unitStart: (day: Date) => Date, label: (day: Date, last: Date) => string) {
  const result: TTimelineSpan[] = [];
  let offset = 0;
  while (offset < days) {
    const day = addDays(start, offset);
    const first = unitStart(day);
    let span = 1;
    while (offset + span < days && unitStart(addDays(start, offset + span)).getTime() === first.getTime()) span++;
    result.push({ key: format(day, "yyyy-MM-dd"), label: label(day, addDays(day, span - 1)), offset, span });
    offset += span;
  }
  return result;
}

/** Top header row: months for the Days and Weeks scales, years for Months. */
export function timelineHeaderGroups(start: Date, days: number, scale: TTimelineScale) {
  return scale === "months"
    ? spans(
        start,
        days,
        (day) => new Date(day.getFullYear(), 0, 1),
        (day) => format(day, "yyyy")
      )
    : spans(start, days, startOfMonth, (day) => format(day, "MMMM yyyy"));
}

/** Second header row: one column per day, week ("Oct 26 – Nov 1") or month. */
export function timelineColumns(start: Date, days: number, scale: TTimelineScale) {
  if (scale === "days")
    return spans(
      start,
      days,
      (day) => day,
      (day) => format(day, "EEEEE d")
    );
  if (scale === "months") return spans(start, days, startOfMonth, (day) => format(day, "MMM"));
  return spans(
    start,
    days,
    (day) => startOfWeek(day, { weekStartsOn: 1 }),
    (day, last) =>
      isSameMonth(day, last)
        ? `${format(day, "MMM d")} – ${format(last, "d")}`
        : `${format(day, "MMM d")} – ${format(last, "MMM d")}`
  );
}

export const dayIndex = (start: Date, key: string) => differenceInCalendarDays(parseISO(key), start);

const shift = (key: string, delta: number) => format(addDays(parseISO(key), delta), "yyyy-MM-dd");

export type TTimelineDragMode = "move" | "start" | "end";

/** Applies a drag of `delta` days: move keeps the length, start/end resize without crossing the other edge. */
export function shiftShape(shape: NonNullable<TTimelineShape>, mode: TTimelineDragMode, delta: number) {
  if (shape.kind === "milestone") return { kind: "milestone" as const, day: shift(shape.day, delta) };
  if (mode === "move") return { kind: "bar" as const, start: shift(shape.start, delta), end: shift(shape.end, delta) };
  if (mode === "start") {
    const start = shift(shape.start, delta);
    return { kind: "bar" as const, start: start > shape.end ? shape.end : start, end: shape.end };
  }
  const end = shift(shape.end, delta);
  return { kind: "bar" as const, start: shape.start, end: end < shape.start ? shape.start : end };
}

/** The work item dates to save for a dragged shape. */
export function shapeDates(shape: NonNullable<TTimelineShape>) {
  return shape.kind === "milestone" ? { target_date: shape.day } : { start_date: shape.start, target_date: shape.end };
}

export type TTimelineSort = "manual" | "start" | "due" | "name";

export const TIMELINE_SORTS: { id: TTimelineSort; label: string }[] = [
  { id: "manual", label: "Stage order" },
  { id: "start", label: "Start date" },
  { id: "due", label: "Due date" },
  { id: "name", label: "Name" },
];

const taskName = (task: TProjectListTask) => task.name.toLowerCase();

/** Sorts tasks inside a stage; undated tasks go last for date sorts. */
export function sortTimelineTasks(tasks: TProjectListTask[], sort: TTimelineSort) {
  if (sort === "manual") return tasks;
  const date = (task: TProjectListTask) => {
    const shape = timelineShape(task);
    if (!shape) return "9999-99-99";
    if (shape.kind === "milestone") return shape.day;
    return sort === "start" ? shape.start : shape.end;
  };
  return sortBy(tasks, sort === "name" ? [taskName] : [date, taskName]);
}
