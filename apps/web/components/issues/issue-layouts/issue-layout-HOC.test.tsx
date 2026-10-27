import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { IssueLayoutHOC } from "./issue-layout-HOC";

const state = vi.hoisted(() => ({
  count: 0 as number | undefined,
  loader: undefined as string | undefined,
  groupBy: "section" as string | null,
  showEmpty: true,
  storeType: "PROJECT",
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => state.storeType }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issues: { getGroupIssueCount: () => state.count, getIssueLoader: () => state.loader },
    issuesFilter: { issueFilters: { displayFilters: { group_by: state.groupBy, show_empty_groups: state.showEmpty } } },
  }),
}));
vi.mock("@/components/common/layout-error-boundary", () => ({
  LayoutErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./empty-states", () => ({ IssueLayoutEmptyState: () => <div data-testid="empty-state" /> }));
vi.mock("@/components/ui/loader/layouts/list-layout-loader", () => ({
  ListLayoutLoader: () => <div data-testid="loader" />,
}));
vi.mock("@/components/ui/loader/layouts/kanban-layout-loader", () => ({
  KanbanLayoutLoader: () => <div data-testid="loader" />,
}));
vi.mock("@/components/ui/loader/layouts/calendar-layout-loader", () => ({
  CalendarLayoutLoader: () => <div data-testid="loader" />,
}));
vi.mock("@/components/ui/loader/layouts/gantt-layout-loader", () => ({
  GanttLayoutLoader: () => <div data-testid="loader" />,
}));
vi.mock("@/components/ui/loader/layouts/spreadsheet-layout-loader", () => ({
  SpreadsheetLayoutLoader: () => <div data-testid="loader" />,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.count = 0;
  state.loader = undefined;
  state.groupBy = "section";
  state.showEmpty = true;
  state.storeType = EIssuesStoreType.PROJECT;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = (layout = EIssueLayoutTypes.LIST) =>
  act(() =>
    root.render(
      <IssueLayoutHOC layout={layout}>
        <div data-testid="section-layout">
          To Dos <button>Add task</button>
        </div>
      </IssueLayoutHOC>
    )
  );

it.each([EIssueLayoutTypes.LIST, EIssueLayoutTypes.KANBAN])(
  "shows empty sections and task controls in %s",
  async (layout) => {
    await render(layout);
    expect(host.querySelector('[data-testid="section-layout"]')).not.toBeNull();
    expect(host.textContent).toContain("To Dos");
    expect(host.querySelector("button")?.textContent).toBe("Add task");
    expect(host.querySelector('[data-testid="empty-state"]')).toBeNull();
  }
);

it.each([EIssuesStoreType.PROJECT, EIssuesStoreType.PROJECT_VIEW, EIssuesStoreType.MODULE, EIssuesStoreType.CYCLE])(
  "keeps empty sections visible in %s",
  async (storeType) => {
    state.storeType = storeType;
    await render();
    expect(host.querySelector('[data-testid="section-layout"]')).not.toBeNull();
  }
);
it("keeps the normal empty state when empty groups are hidden", async () => {
  state.showEmpty = false;
  await render();
  expect(host.querySelector('[data-testid="empty-state"]')).not.toBeNull();
});
it.each(["state", "priority", null])("preserves the empty state for grouping %s", async (groupBy) => {
  state.groupBy = groupBy;
  await render();
  expect(host.querySelector('[data-testid="empty-state"]')).not.toBeNull();
});
it.each([EIssueLayoutTypes.GANTT, EIssueLayoutTypes.SPREADSHEET])(
  "preserves the empty state for %s",
  async (layout) => {
    await render(layout);
    expect(host.querySelector('[data-testid="empty-state"]')).not.toBeNull();
  }
);
it("preserves calendar's existing empty layout", async () => {
  await render(EIssueLayoutTypes.CALENDAR);
  expect(host.querySelector('[data-testid="section-layout"]')).not.toBeNull();
});
it.each(["loading", "unknown-count"])("preserves the loader for %s", async (mode) => {
  if (mode === "loading") state.loader = "init-loader";
  else state.count = undefined;
  await render();
  expect(host.querySelector('[data-testid="loader"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="section-layout"]')).toBeNull();
});
it("preserves layouts containing tasks", async () => {
  state.count = 2;
  state.groupBy = "state";
  await render();
  expect(host.querySelector('[data-testid="section-layout"]')).not.toBeNull();
});
