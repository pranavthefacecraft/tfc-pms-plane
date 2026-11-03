/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
import {
  CALENDAR_HOURS,
  calendarPeriodLabel,
  shapeDates,
  shiftShape,
  sortTimelineTasks,
  timeZoneLabel,
  timelineColumns,
  timelineHeaderGroups,
  timelineRange,
  timelineShape,
} from "./project-schedule.helpers";

const days = (from: string, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const day = parseISO(from);
    day.setDate(day.getDate() + index);
    return day;
  });
const task = (id: string, name: string, start_date: string | null, target_date: string | null) =>
  ({ id, name, start_date, target_date }) as TProjectListTask;

describe("calendar helpers", () => {
  it("labels the hour rows from 9 AM to 4 PM", () => {
    expect(CALENDAR_HOURS.map((hour) => hour.label)).toEqual([
      "9 AM",
      "10 AM",
      "11 AM",
      "12 PM",
      "1 PM",
      "2 PM",
      "3 PM",
      "4 PM",
    ]);
  });

  it("labels each calendar period", () => {
    expect(calendarPeriodLabel([], "month", parseISO("2026-10-16"))).toBe("October 2026");
    expect(calendarPeriodLabel([], "day", parseISO("2026-10-16"))).toBe("Fri, Oct 16, 2026");
    expect(calendarPeriodLabel(days("2026-10-12", 7), "week", parseISO("2026-10-16"))).toBe("Oct 12–18, 2026");
    expect(calendarPeriodLabel(days("2026-09-28", 7), "week", parseISO("2026-10-01"))).toBe("Sep 28 – Oct 4, 2026");
    expect(calendarPeriodLabel(days("2026-12-28", 7), "week", parseISO("2026-12-30"))).toBe(
      "Dec 28, 2026 – Jan 3, 2027"
    );
  });

  it("names the time zone and tolerates unknown zones", () => {
    expect(timeZoneLabel("UTC", new Date("2026-11-03T12:00:00Z"))).toBe("UTC");
    expect(timeZoneLabel("Not/AZone")).toBe("");
  });
});

describe("timeline helpers", () => {
  it("turns task dates into bars and milestones", () => {
    expect(timelineShape({ start_date: "2026-11-02", target_date: "2026-11-04" })).toEqual({
      kind: "bar",
      start: "2026-11-02",
      end: "2026-11-04",
    });
    expect(timelineShape({ start_date: "2026-11-09", target_date: "2026-11-04" })).toEqual({
      kind: "bar",
      start: "2026-11-04",
      end: "2026-11-09",
    });
    expect(timelineShape({ start_date: null, target_date: "2026-11-10T00:00:00Z" })).toEqual({
      kind: "milestone",
      day: "2026-11-10",
    });
    expect(timelineShape({ start_date: "2026-11-05", target_date: null })).toEqual({
      kind: "bar",
      start: "2026-11-05",
      end: "2026-11-05",
    });
    expect(timelineShape({ start_date: null, target_date: null })).toBeNull();
  });

  it("pads the range around the tasks and today, starting on a Monday", () => {
    const range = timelineRange([{ kind: "milestone", day: "2026-11-10" }, null], "2026-11-03", "weeks");
    expect(format(range.start, "yyyy-MM-dd")).toBe("2026-10-26");
    expect(range.days).toBe(84);
    const long = timelineRange([{ kind: "bar", start: "2026-11-02", end: "2027-06-30" }], "2026-11-03", "weeks");
    expect(format(long.start, "yyyy-MM-dd")).toBe("2026-10-26");
    expect(long.days).toBeGreaterThan(84);
    const months = timelineRange([], "2026-11-03", "months");
    expect(format(months.start, "yyyy-MM-dd")).toBe("2026-10-01");
  });

  it("builds month and week headers", () => {
    const start = parseISO("2026-10-26");
    expect(timelineHeaderGroups(start, 14, "weeks").map((group) => [group.label, group.span])).toEqual([
      ["October 2026", 6],
      ["November 2026", 8],
    ]);
    expect(timelineColumns(start, 14, "weeks").map((column) => column.label)).toEqual(["Oct 26 – Nov 1", "Nov 2 – 8"]);
    expect(timelineColumns(start, 2, "days").map((column) => column.label)).toEqual(["M 26", "T 27"]);
  });

  it("moves and resizes shapes without crossing the edges", () => {
    const bar = { kind: "bar" as const, start: "2026-11-02", end: "2026-11-04" };
    expect(shiftShape(bar, "move", 2)).toEqual({ kind: "bar", start: "2026-11-04", end: "2026-11-06" });
    expect(shiftShape(bar, "start", 5)).toEqual({ kind: "bar", start: "2026-11-04", end: "2026-11-04" });
    expect(shiftShape(bar, "end", -5)).toEqual({ kind: "bar", start: "2026-11-02", end: "2026-11-02" });
    expect(shiftShape({ kind: "milestone", day: "2026-11-10" }, "end", -1)).toEqual({
      kind: "milestone",
      day: "2026-11-09",
    });
    expect(shapeDates(bar)).toEqual({ start_date: "2026-11-02", target_date: "2026-11-04" });
    expect(shapeDates({ kind: "milestone", day: "2026-11-10" })).toEqual({ target_date: "2026-11-10" });
  });

  it("sorts tasks inside a stage", () => {
    const tasks = [
      task("a", "Zeta", "2026-11-05", "2026-11-06"),
      task("b", "Alpha", null, null),
      task("c", "Mid", "2026-11-01", "2026-11-09"),
    ];
    expect(sortTimelineTasks(tasks, "manual")).toBe(tasks);
    expect(sortTimelineTasks(tasks, "start").map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(sortTimelineTasks(tasks, "due").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(sortTimelineTasks(tasks, "name").map((item) => item.id)).toEqual(["b", "c", "a"]);
  });
});
