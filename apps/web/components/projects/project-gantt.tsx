/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TProjectListTask } from "@/services/project/project-task-list.service";
import { stageColors, isDoneStage } from "./project-board.helpers";
import { isCompleted } from "./project-list.helpers";
import type { TProjectListGroup } from "./project-list.helpers";
import {
  TIMELINE_DAY_WIDTH,
  TIMELINE_SCALES,
  TIMELINE_SORTS,
  dayIndex,
  shapeDates,
  shiftShape,
  sortTimelineTasks,
  timelineColumns,
  timelineHeaderGroups,
  timelineRange,
  timelineShape,
} from "./project-schedule.helpers";
import type { TTimelineDragMode, TTimelineScale, TTimelineShape, TTimelineSort } from "./project-schedule.helpers";

const LABEL_WIDTH = 240;
const shortDate = (key: string) => format(parseISO(key), "MMM d");

type TBarProps = {
  task: TProjectListTask;
  shape: NonNullable<TTimelineShape>;
  start: Date;
  dayWidth: number;
  done: boolean;
  editable: boolean;
  onOpen: () => void;
  onCommit: (dates: { start_date?: string; target_date?: string }) => Promise<unknown>;
};

/** A task bar or milestone diamond; editors drag it to move it or drag its ends to change the dates. */
function GanttBar({ task, shape, start, dayWidth, done, editable, onOpen, onCommit }: TBarProps) {
  const [drag, setDrag] = useState<{ mode: TTimelineDragMode; x: number; delta: number } | null>(null);
  const moved = useRef(false);
  const shown = drag?.delta ? shiftShape(shape, drag.mode, drag.delta) : shape;
  const from = shown.kind === "bar" ? shown.start : shown.day;
  const to = shown.kind === "bar" ? shown.end : shown.day;
  const left = dayIndex(start, from) * dayWidth;
  const dates = from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editable || event.button !== 0) return;
    moved.current = false;
    const handle = (event.target as HTMLElement).dataset.handle;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ mode: handle === "start" || handle === "end" ? handle : "move", x: event.clientX, delta: 0 });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const delta = Math.round((event.clientX - drag.x) / dayWidth);
    if (delta !== drag.delta) setDrag({ mode: drag.mode, x: drag.x, delta });
  };
  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    if (!drag.delta) return;
    moved.current = true;
    void onCommit(shapeDates(shiftShape(shape, drag.mode, drag.delta)));
  };
  const onClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    onOpen();
  };
  const common = {
    type: "button" as const,
    title: `${task.name}: ${dates}`,
    "aria-label": `${task.name}, ${dates}`,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => setDrag(null),
  };

  if (shown.kind === "milestone")
    return (
      <div
        className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2"
        style={{ left: left + dayWidth / 2 - 7 }}
      >
        <button
          {...common}
          data-shape="milestone"
          className={`size-3.5 rotate-45 touch-none rounded-[2px] bg-[#135DDD] ${editable ? "cursor-grab" : "cursor-pointer"}`}
        />
        <span className="text-11 whitespace-nowrap text-secondary">{shortDate(shown.day)}</span>
      </div>
    );
  return (
    <button
      {...common}
      data-shape="bar"
      className={`group/bar absolute top-1/2 h-5 -translate-y-1/2 touch-none rounded ${
        done ? "bg-[#0E9F6E] hover:bg-[#0B8A5F]" : "bg-[#135DDD] hover:bg-[#0F4FC0]"
      } ${editable ? (drag ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"}`}
      style={{ left: left + 2, width: Math.max((dayIndex(start, to) - dayIndex(start, from) + 1) * dayWidth - 4, 6) }}
    >
      {editable && (
        <>
          <span
            data-handle="start"
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l bg-white/0 group-hover/bar:bg-white/30"
          />
          <span
            data-handle="end"
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r bg-white/0 group-hover/bar:bg-white/30"
          />
        </>
      )}
    </button>
  );
}

type TGanttProps = {
  groups: TProjectListGroup[];
  today: string;
  canEdit: (task: TProjectListTask) => boolean;
  onOpen: (task: TProjectListTask) => void;
  onReschedule: (task: TProjectListTask, dates: { start_date?: string; target_date?: string }) => Promise<unknown>;
  /** "+ Add task" on the left of the toolbar. */
  leading?: ReactNode;
  /** Filter and search on the right of the toolbar. */
  trailing?: ReactNode;
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: ReactNode;
};

/**
 * Figma project Timeline: toolbar with "< Today >", Days / Weeks / Months and sort; a "Stage / Task" column with
 * coloured stage rows and their tasks; month and week headers; a today line; blue bars (green when done) and
 * diamond milestones for tasks that only have a due date.
 */
export function ProjectGantt({ groups, today, canEdit, onOpen, onReschedule, leading, trailing, empty }: TGanttProps) {
  const [scale, setScale] = useState<TTimelineScale>("weeks");
  const [sort, setSort] = useState<TTimelineSort>("manual");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayWidth = TIMELINE_DAY_WIDTH[scale];
  const { start, days } = timelineRange(
    groups.flatMap((group) => group.tasks.map(timelineShape)),
    today,
    scale
  );
  const width = days * dayWidth;
  const todayLeft = LABEL_WIDTH + (dayIndex(start, today) + 0.5) * dayWidth;
  const columns = timelineColumns(start, days, scale);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = Math.max(0, todayLeft - LABEL_WIDTH - node.clientWidth / 3);
  }, [todayLeft]);
  const page = (direction: -1 | 1) => {
    const node = scrollRef.current;
    if (node) node.scrollLeft += direction * Math.max(node.clientWidth - LABEL_WIDTH, dayWidth * 7) * 0.75;
  };
  const goToday = () => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = Math.max(0, todayLeft - LABEL_WIDTH - node.clientWidth / 3);
  };

  return (
    <section aria-label="Task timeline">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-32 flex-1 items-center">{leading}</div>
        <div role="group" aria-label="Timeline navigation" className="flex items-center gap-1 text-12">
          <button
            type="button"
            aria-label="Earlier"
            className="rounded p-1 hover:bg-layer-1-hover"
            onClick={() => page(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className="rounded px-2 py-1 font-medium hover:bg-layer-1-hover" onClick={goToday}>
            Today
          </button>
          <button
            type="button"
            aria-label="Later"
            className="rounded p-1 hover:bg-layer-1-hover"
            onClick={() => page(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <select
            aria-label="Timeline scale"
            value={scale}
            onChange={(event) => setScale(event.target.value as TTimelineScale)}
            className="h-8 rounded border border-subtle bg-surface-1 px-2 text-12"
          >
            {TIMELINE_SCALES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort tasks"
            value={sort}
            onChange={(event) => setSort(event.target.value as TTimelineSort)}
            className="h-8 rounded border border-subtle bg-surface-1 px-2 text-12"
          >
            {TIMELINE_SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                Sort: {option.label}
              </option>
            ))}
          </select>
          {trailing}
        </div>
      </div>
      {empty ?? (
        <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-[#E2E6EF] bg-surface-1">
          <div className="relative" style={{ width: LABEL_WIDTH + width }}>
            <div className="flex border-b border-[#E2E6EF] bg-[#F7F9FC]">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-end border-r border-[#E2E6EF] bg-[#F7F9FC] px-3 pb-2 text-10 font-semibold text-secondary uppercase"
                style={{ width: LABEL_WIDTH }}
              >
                Stage / Task
              </div>
              <div className="relative h-14" style={{ width }}>
                {timelineHeaderGroups(start, days, scale).map((group) => (
                  <div
                    key={group.key}
                    className="absolute top-0 h-7 truncate border-l border-[#E2E6EF] px-2 pt-1.5 text-11 font-semibold text-primary"
                    style={{ left: group.offset * dayWidth, width: group.span * dayWidth }}
                  >
                    {group.label}
                  </div>
                ))}
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="absolute top-7 h-7 truncate border-t border-l border-[#E2E6EF] px-2 pt-1.5 text-10 text-secondary"
                    style={{ left: column.offset * dayWidth, width: column.span * dayWidth }}
                  >
                    {column.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              {columns.map((column) => (
                <div
                  key={column.key}
                  aria-hidden="true"
                  className="absolute inset-y-0 border-l border-[#EEF1F5]"
                  style={{ left: LABEL_WIDTH + column.offset * dayWidth }}
                />
              ))}
              <div
                data-testid="today-line"
                aria-hidden="true"
                className="absolute inset-y-0 z-[5] w-px bg-[#135DDD]"
                style={{ left: todayLeft }}
              >
                <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-[#135DDD]" />
              </div>
              {groups.map((group, index) => (
                <section key={group.key} aria-label={group.name}>
                  <div className="flex h-9 border-b border-[#E2E6EF] bg-[#F7F9FC]/80">
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center justify-between border-r border-[#E2E6EF] bg-[#F7F9FC] px-3"
                      style={{ width: LABEL_WIDTH }}
                    >
                      <span className={`truncate text-12 font-semibold ${stageColors(group, index).title}`}>
                        {group.name}
                      </span>
                      <span className="text-11 text-secondary">{group.tasks.length}</span>
                    </div>
                  </div>
                  {sortTimelineTasks(group.tasks, sort).map((task) => {
                    const shape = timelineShape(task);
                    const completed = isCompleted(task);
                    return (
                      <div key={task.id} role="row" className="flex h-10 border-b border-[#EEF1F5]">
                        <div
                          className="sticky left-0 z-10 flex shrink-0 items-center border-r border-[#E2E6EF] bg-surface-1 pr-3 pl-6"
                          style={{ width: LABEL_WIDTH }}
                        >
                          <button
                            type="button"
                            onClick={() => onOpen(task)}
                            className={`flex min-w-0 items-center gap-2 text-left text-12 hover:text-[#135DDD] ${
                              completed ? "text-secondary line-through" : "text-primary"
                            }`}
                          >
                            {shape?.kind === "milestone" && (
                              <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-[#135DDD]" />
                            )}
                            <span className="truncate">{task.name}</span>
                          </button>
                          {!shape && <span className="ml-auto shrink-0 pl-2 text-10 text-tertiary">No dates</span>}
                        </div>
                        <div className="relative" style={{ width }}>
                          {shape && (
                            <GanttBar
                              task={task}
                              shape={shape}
                              start={start}
                              dayWidth={dayWidth}
                              done={completed || isDoneStage(group)}
                              editable={canEdit(task)}
                              onOpen={() => onOpen(task)}
                              onCommit={(dates) => onReschedule(task, dates)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
