import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BaseTimeLineStore } from "@/store/timeline/base-timeline.store";
import type { RootStore } from "@/store/root.store";
import type { TaskRow } from "./my-tasks-board.helpers";
import { MyTasksTimeline } from "./my-tasks-timeline";

const store = vi.hoisted(() => ({ current: undefined as unknown }));
const chart = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock("@/hooks/use-timeline-chart", () => ({
  useTimeLineChart: () => store.current,
  useTimeLineChartStore: () => store.current,
}));
vi.mock("@/components/gantt-chart/root", () => ({
  GanttChartRoot: (props: {
    blockIds: string[];
    sidebarToRender: (props: { blockIds: string[] }) => ReactNode;
    blockToRender: (data: { id: string }) => ReactNode;
  }) => {
    chart.props = props;
    return (
      <div>
        <aside>{props.sidebarToRender({ blockIds: props.blockIds })}</aside>
        {props.blockIds.map((id) => (
          <div key={id} data-bar={id}>
            {props.blockToRender({ id })}
          </div>
        ))}
      </div>
    );
  },
}));

const personal: TaskRow = {
  key: "personal-1",
  name: "Buy supplies",
  due: null,
  completed: false,
  personal: {
    id: "1",
    name: "Buy supplies",
    priority: "none",
    description: "",
    start_date: null,
    target_date: null,
    completed_at: null,
    created_at: "2026-10-31",
    updated_at: "2026-10-31",
  },
};
const project: TaskRow = {
  key: "project-2",
  name: "Website Builder",
  due: "2026-11-05",
  completed: false,
  project: {
    id: "2",
    name: "Website Builder",
    project_id: "web",
    project_identifier: "WEB",
    project_name: "Website Redesign",
    assignee_ids: ["me"],
    sequence_id: 7,
    priority: "none",
    target_date: "2026-11-05",
    start_date: "2026-11-02",
    completed_at: null,
    state_id: "started",
    state_group: "started",
    state_name: "In progress",
    state_color: "#F59E0B",
    completed_state_id: "done",
    default_state_id: "todo",
    section_id: null,
    section_name: null,
  },
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let timeline: BaseTimeLineStore;
const onOpen = vi.fn();
const onReschedule = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  timeline = new BaseTimeLineStore({} as RootStore);
  store.current = timeline;
  onOpen.mockReset();
  onReschedule.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function renderTimeline(rows: TaskRow[], canEdit = (row: TaskRow) => Boolean(row.project)) {
  await act(async () =>
    root.render(<MyTasksTimeline rows={rows} canEdit={canEdit} onOpen={onOpen} onReschedule={onReschedule} />)
  );
}

it("feeds task dates into the shared timeline store and renders sidebar rows and bars", async () => {
  await renderTimeline([project, personal]);
  expect(timeline.blockIds).toEqual(["project-2", "personal-1"]);
  expect(timeline.getBlockById("project-2")).toMatchObject({
    name: "Website Builder",
    start_date: "2026-11-02",
    target_date: "2026-11-05",
  });
  expect(timeline.getBlockById("personal-1")).toMatchObject({ start_date: undefined, target_date: undefined });
  expect(host.querySelector("aside")?.textContent).toContain("WEB-7");
  expect(host.querySelector('[data-bar="project-2"] button')?.getAttribute("title")).toContain("Website Builder");
  await act(() => host.querySelector<HTMLButtonElement>('[data-bar="project-2"] button')?.click());
  expect(onOpen).toHaveBeenCalledWith(project);
});

it("saves dragged or added dates only for editable tasks", async () => {
  await renderTimeline([project, personal]);
  const props = chart.props as {
    enableBlockMove: (id: string) => boolean;
    blockUpdateHandler: (data: { id: string }, payload: Record<string, string>) => void;
    updateBlockDates: (updates: { id: string; start_date?: string; target_date?: string }[]) => Promise<void>;
  };
  expect(props.enableBlockMove("project-2")).toBe(true);
  expect(props.enableBlockMove("personal-1")).toBe(false);
  await act(() => props.updateBlockDates([{ id: "project-2", start_date: "2026-11-03", target_date: "2026-11-06" }]));
  expect(onReschedule).toHaveBeenCalledWith(project, { start_date: "2026-11-03", target_date: "2026-11-06" });
  onReschedule.mockClear();
  act(() => props.blockUpdateHandler({ id: "personal-1" }, { start_date: "2026-11-10", target_date: "2026-11-11" }));
  expect(onReschedule).not.toHaveBeenCalled();
  act(() => props.blockUpdateHandler({ id: "project-2" }, { start_date: "2026-11-10" }));
  expect(onReschedule).toHaveBeenCalledWith(project, { start_date: "2026-11-10" });
  onReschedule.mockClear();
  act(() => props.blockUpdateHandler({ id: "project-2" }, { sort_order: "1" }));
  expect(onReschedule).not.toHaveBeenCalled();
});

it("updates timeline blocks when the visible tasks change", async () => {
  await renderTimeline([project, personal]);
  await renderTimeline([personal]);
  expect(timeline.blockIds).toEqual(["personal-1"]);
  expect(host.querySelector("aside")?.textContent).not.toContain("Website Builder");
});
