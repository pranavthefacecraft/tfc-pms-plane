import { useEffect } from "react";
import { autorun } from "mobx";
import { observer } from "mobx-react";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import type { IBlockUpdateData, IBlockUpdateDependencyData } from "@plane/types";
import { Row } from "@plane/blocks/layout";
import { cn } from "@plane/utils";
import { BLOCK_HEIGHT, SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
import { GanttChartRoot } from "@/components/gantt-chart/root";
import { getBlockViewDetails } from "@/components/issues/issue-layouts/utils";
import { useTimeLineChart, useTimeLineChartStore } from "@/hooks/use-timeline-chart";
import type { BaseTimeLineStore } from "@/store/timeline/base-timeline.store";
import { timelineBlock, timelineColor, timelineDates } from "./my-tasks-board.helpers";
import type { TTimelineDates, TTimelineRow } from "./my-tasks-board.helpers";

type TimelineProps<T extends TTimelineRow = TTimelineRow> = {
  rows: T[];
  canEdit: (row: T) => boolean;
  onOpen: (row: T) => void;
  onReschedule: (row: T, dates: TTimelineDates) => Promise<void>;
};

function TimelineBar({ row, onOpen }: { row: TTimelineRow; onOpen: (row: TTimelineRow) => void }) {
  const { blockStyle, message } = getBlockViewDetails(timelineBlock(row, 0), timelineColor(row));
  return (
    <button
      type="button"
      title={message ? `${row.name}: ${message}` : row.name}
      className="relative flex h-full w-full cursor-pointer items-center rounded-sm text-left"
      style={blockStyle}
      onClick={() => onOpen(row)}
    >
      <span className="absolute inset-0 rounded-sm bg-surface-1/50" />
      <span
        className={cn("sticky w-auto flex-1 truncate px-2.5 py-1 text-13 text-primary", {
          "line-through": row.completed,
        })}
        style={{ left: `${SIDEBAR_WIDTH}px` }}
      >
        {row.name}
      </span>
    </button>
  );
}

const TimelineSidebarRow = observer(function TimelineSidebarRow({
  row,
  onOpen,
}: {
  row: TTimelineRow;
  onOpen: (row: TTimelineRow) => void;
}) {
  const { getBlockById, updateActiveBlockId, isBlockActive, getNumberOfDaysFromPosition } = useTimeLineChartStore();
  const block = getBlockById(row.key);
  const duration =
    block?.start_date && block.target_date ? getNumberOfDaysFromPosition(block.position?.width) : undefined;
  return (
    <Row
      className={cn("group flex w-full items-center gap-2 bg-layer-transparent pr-4 hover:bg-layer-transparent-hover", {
        "bg-layer-transparent-hover": isBlockActive(row.key),
      })}
      style={{ height: `${BLOCK_HEIGHT}px` }}
      onMouseEnter={() => updateActiveBlockId(row.key)}
      onMouseLeave={() => updateActiveBlockId(null)}
    >
      <button
        type="button"
        className="flex min-w-0 flex-grow items-center gap-2 text-left text-13"
        onClick={() => onOpen(row)}
      >
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: timelineColor(row) }}
        />
        {row.project?.project_identifier && (
          <span className="shrink-0 text-11 text-tertiary">
            {row.project.project_identifier}-{row.project.sequence_id}
          </span>
        )}
        <span className={cn("truncate font-medium", { "text-tertiary line-through": row.completed })}>{row.name}</span>
      </button>
      {duration !== undefined && (
        <span className="shrink-0 text-13 text-secondary">
          {duration} day{duration > 1 ? "s" : ""}
        </span>
      )}
    </Row>
  );
});

const TaskTimeline = observer(function TaskTimeline({ rows, canEdit, onOpen, onReschedule }: TimelineProps) {
  const store = useTimeLineChart(GANTT_TIMELINE_TYPE.GROUPED) as BaseTimeLineStore;
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const blockIds = rows.map((row) => row.key);
  const blocks = rows.map(timelineBlock);
  const signature = JSON.stringify(blocks);

  useEffect(() => {
    const data: ReturnType<typeof timelineBlock>[] = JSON.parse(signature);
    const blockMap = new Map(data.map((block) => [block.id, block]));
    store.setBlockIds(data.map((block) => block.id));
    // Re-run when the chart view, scroll range or drag state changes so bar positions stay in sync.
    return autorun(() => store.updateBlocks((id) => blockMap.get(id)));
  }, [signature, store]);

  const reschedule = (id: string, update: { start_date?: string | null; target_date?: string | null }) => {
    const row = byKey.get(id);
    const dates = timelineDates(update);
    if (row && canEdit(row) && Object.keys(dates).length) void onReschedule(row, dates);
  };
  const editable = (id: string) => {
    const row = byKey.get(id);
    return Boolean(row && canEdit(row));
  };

  return (
    <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.GROUPED}>
      <section aria-label="Task timeline" className="h-[calc(100vh-280px)] min-h-[480px] w-full">
        <GanttChartRoot
          title="Tasks"
          loaderTitle="Tasks"
          blockIds={blockIds}
          blockUpdateHandler={(data: { id: string }, payload: IBlockUpdateData) => reschedule(data.id, payload)}
          updateBlockDates={async (updates: IBlockUpdateDependencyData[]) => {
            for (const update of updates) reschedule(update.id, update);
          }}
          blockToRender={(data: { id: string }) => {
            const row = byKey.get(data.id);
            return row ? <TimelineBar row={row} onOpen={onOpen} /> : null;
          }}
          sidebarToRender={({ blockIds: ids }: { blockIds: string[] }) => (
            <div className="h-full">
              {ids.map((id) => {
                const row = byKey.get(id);
                return row ? <TimelineSidebarRow key={id} row={row} onOpen={onOpen} /> : null;
              })}
            </div>
          )}
          enableBlockLeftResize={editable}
          enableBlockRightResize={editable}
          enableBlockMove={editable}
          enableAddBlock={editable}
          showAllBlocks
        />
      </section>
    </TimeLineTypeContext.Provider>
  );
});

/** Gantt task timeline used by My Tasks and the project Timeline tab. */
export function MyTasksTimeline<T extends TTimelineRow>(props: TimelineProps<T>) {
  // Rows only flow back into the caller's own callbacks, so widening T here is safe.
  return <TaskTimeline {...(props as unknown as TimelineProps)} />;
}
