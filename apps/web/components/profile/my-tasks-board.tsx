import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { renderFormattedDate } from "@plane/utils";
import { BOARD_COLUMNS, boardColumn } from "./my-tasks-board.helpers";
import type { TBoardColumn, TaskRow } from "./my-tasks-board.helpers";

function dueDetails(row: TaskRow, today: string) {
  if (!row.due) return null;
  if (row.due === today) return { label: "Due today", className: "text-[#E5484D]" };
  const overdue = !row.completed && row.due < today;
  return { label: renderFormattedDate(row.due) ?? row.due, className: overdue ? "text-[#E5484D]" : "text-secondary" };
}

function BoardCard({
  row,
  today,
  busy,
  onOpen,
  onDragStart,
}: {
  row: TaskRow;
  today: string;
  busy: boolean;
  onOpen: (row: TaskRow) => void;
  onDragStart: (row: TaskRow) => void;
}) {
  const due = dueDetails(row, today);
  return (
    <button
      type="button"
      draggable={!busy}
      disabled={busy}
      aria-label={row.name}
      onClick={() => onOpen(row)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.key);
        onDragStart(row);
      }}
      className="flex w-full cursor-grab flex-col gap-2 rounded-lg border border-subtle bg-surface-1 p-3 text-left shadow-raised-100 hover:border-strong disabled:cursor-wait disabled:opacity-60"
    >
      <span className={`text-13 font-medium ${row.completed ? "text-secondary line-through" : ""}`}>{row.name}</span>
      <span className="flex items-center gap-1.5 text-11 text-secondary">
        <span className={`size-2 rounded-sm ${row.personal ? "bg-[#C4ADF2]" : "bg-[#009E79]"}`} />
        {row.project?.project_name ?? "Personal task"}
      </span>
      {due && <span className={`text-11 font-medium ${due.className}`}>{due.label}</span>}
    </button>
  );
}

export function MyTasksBoard({
  rows,
  today,
  busy,
  onOpen,
  onMove,
  renderAddTask,
}: {
  rows: TaskRow[];
  today: string;
  busy: Set<string>;
  onOpen: (row: TaskRow) => void;
  onMove: (row: TaskRow, column: TBoardColumn) => Promise<void>;
  renderAddTask?: (column: TBoardColumn) => ReactNode;
}) {
  const dragging = useRef<TaskRow | null>(null);
  const [over, setOver] = useState<TBoardColumn | null>(null);
  const grouped = new Map<TBoardColumn, TaskRow[]>(BOARD_COLUMNS.map((column) => [column.id, []]));
  for (const row of rows) {
    const column = boardColumn(row);
    if (column) grouped.get(column)?.push(row);
  }
  return (
    <div className="flex w-full gap-4 overflow-x-auto pb-4" aria-label="My Tasks board">
      {BOARD_COLUMNS.map((column) => {
        const items = grouped.get(column.id) ?? [];
        return (
          <section
            key={column.id}
            aria-label={column.label}
            onDragOver={(event) => {
              if (!dragging.current) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOver(column.id);
            }}
            onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const row = dragging.current;
              dragging.current = null;
              setOver(null);
              if (row && boardColumn(row) !== column.id) void onMove(row, column.id);
            }}
            className={`flex max-h-[calc(100vh-260px)] w-[280px] shrink-0 flex-col rounded-xl bg-layer-1 p-3 ${over === column.id ? "ring-2 ring-[#135DDD]/40" : ""}`}
          >
            <header className="mb-3 flex items-center gap-2">
              <span className={`size-2 rounded-full ${column.dot}`} />
              <h3 className="text-13 font-semibold">{column.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-11 font-medium ${column.badge}`}>{items.length}</span>
            </header>
            <div className="flex min-h-16 flex-col gap-2 overflow-y-auto">
              {items.map((row) => (
                <BoardCard
                  key={row.key}
                  row={row}
                  today={today}
                  busy={busy.has(row.key)}
                  onOpen={onOpen}
                  onDragStart={(item) => {
                    dragging.current = item;
                  }}
                />
              ))}
            </div>
            {renderAddTask && <div className="mt-2">{renderAddTask(column.id)}</div>}
          </section>
        );
      })}
    </div>
  );
}
