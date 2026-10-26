import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { ProjectLayoutRoot } from "./project-layout-root";
import { ProjectViewLayoutRoot } from "./project-view-layout-root";
import { ModuleLayoutRoot } from "./module-layout-root";
import { CycleLayoutRoot } from "./cycle-layout-root";

const state = vi.hoisted(() => ({
  layout: "list",
  completed: false,
  update: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({
    workspaceSlug: "workspace",
    projectId: "project",
    viewId: "view",
    cycleId: "cycle",
    moduleId: "module",
  }),
}));
vi.mock("swr", () => ({ default: () => ({}) }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issues: { getIssueLoader: () => undefined },
    issuesFilter: {
      getIssueFilters: () => ({
        displayFilters: { layout: state.layout, group_by: "state", show_empty_groups: false },
      }),
      updateFilterExpression: state.update,
      resetFilters: state.reset,
    },
  }),
}));
vi.mock("@/hooks/use-issue-layout-store", async () => {
  const { createContext } = await import("react");
  return { IssuesStoreContext: createContext("project") };
});
vi.mock("@/hooks/store/use-project-view", () => ({
  useProjectView: () => ({ getViewById: () => ({ rich_filters: {} }) }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    getCycleById: () => ({ status: state.completed ? "completed" : "started", progress_snapshot: {} }),
  }),
}));
vi.mock("@/components/work-item-filters/filters-hoc/project-level", () => ({
  ProjectLevelWorkItemFiltersHOC: ({ children }: { children: (value: { filter: undefined }) => ReactNode }) =>
    children({ filter: undefined }),
}));
vi.mock("@/components/work-item-filters/filters-row", () => ({ WorkItemFiltersRow: () => null }));
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("@/components/cycles/transfer-issues", () => ({ TransferIssues: () => null }));
vi.mock("@/components/cycles/transfer-issues-modal", () => ({ TransferIssuesModal: () => null }));
vi.mock("@/components/project-sections/add-section", () => ({
  AddSection: ({
    workspaceSlug,
    projectId,
    readOnly,
  }: {
    workspaceSlug: string;
    projectId: string;
    readOnly?: boolean;
  }) =>
    readOnly ? (
      <span data-sections-loaded="true" />
    ) : (
      <button data-project={projectId} data-workspace={workspaceSlug}>
        Add section
      </button>
    ),
}));
vi.mock("../list/roots/project-root", () => ({ ListLayout: () => <div>List</div> }));
vi.mock("../kanban/roots/project-root", () => ({ KanBanLayout: () => <div>Board</div> }));
vi.mock("../calendar/roots/project-root", () => ({ CalendarLayout: () => <div>Calendar</div> }));
vi.mock("../spreadsheet/roots/project-root", () => ({ ProjectSpreadsheetLayout: () => <div>Spreadsheet</div> }));
vi.mock("../list/roots/project-view-root", () => ({ ProjectViewListLayout: () => <div>List</div> }));
vi.mock("../kanban/roots/project-view-root", () => ({ ProjectViewKanBanLayout: () => <div>Board</div> }));
vi.mock("../calendar/roots/project-view-root", () => ({ ProjectViewCalendarLayout: () => <div>Calendar</div> }));
vi.mock("../spreadsheet/roots/project-view-root", () => ({
  ProjectViewSpreadsheetLayout: () => <div>Spreadsheet</div>,
}));
vi.mock("../list/roots/module-root", () => ({ ModuleListLayout: () => <div>List</div> }));
vi.mock("../kanban/roots/module-root", () => ({ ModuleKanBanLayout: () => <div>Board</div> }));
vi.mock("../calendar/roots/module-root", () => ({ ModuleCalendarLayout: () => <div>Calendar</div> }));
vi.mock("../spreadsheet/roots/module-root", () => ({ ModuleSpreadsheetLayout: () => <div>Spreadsheet</div> }));
vi.mock("../list/roots/cycle-root", () => ({ CycleListLayout: () => <div>List</div> }));
vi.mock("../kanban/roots/cycle-root", () => ({ CycleKanBanLayout: () => <div>Board</div> }));
vi.mock("../calendar/roots/cycle-root", () => ({ CycleCalendarLayout: () => <div>Calendar</div> }));
vi.mock("../spreadsheet/roots/cycle-root", () => ({ CycleSpreadsheetLayout: () => <div>Spreadsheet</div> }));
vi.mock("../gantt", () => ({ BaseGanttRoot: () => <div>Timeline</div> }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.completed = false;
  state.layout = EIssueLayoutTypes.LIST;
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  vi.unstubAllGlobals();
});

const layouts = [
  [EIssueLayoutTypes.LIST, "List"],
  [EIssueLayoutTypes.KANBAN, "Board"],
  [EIssueLayoutTypes.CALENDAR, "Calendar"],
  [EIssueLayoutTypes.GANTT, "Timeline"],
  [EIssueLayoutTypes.SPREADSHEET, "Spreadsheet"],
] as const;
for (const [scope, LayoutRoot] of [
  ["project", ProjectLayoutRoot],
  ["saved project view", ProjectViewLayoutRoot],
  ["module", ModuleLayoutRoot],
  ["cycle", CycleLayoutRoot],
] as const) {
  it.each(layouts)(`shows Add section in ${scope} %s without altering filters`, async (layout, label) => {
    state.layout = layout;
    await act(() => root.render(<LayoutRoot />));
    expect(host.textContent).toContain(label);
    const action = host.querySelector("button");
    expect(action?.textContent).toBe("Add section");
    expect(action?.dataset.project).toBe("project");
    expect(action?.dataset.workspace).toBe("workspace");
    expect(state.update).not.toHaveBeenCalled();
  });
}
it("does not offer new sections in completed cycles", async () => {
  state.completed = true;
  await act(() => root.render(<CycleLayoutRoot />));
  expect(host.querySelector("button")).toBeNull();
  expect(host.querySelector("[data-sections-loaded]")).not.toBeNull();
});
