/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TProjectListTask, TProjectTaskList } from "@/services/project/project-task-list.service";
import { ProjectTimeline } from "./project-timeline";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  patchIssue: vi.fn(),
  fetchSections: vi.fn(),
  sections: [
    { id: "s1", name: "To Do", sort_order: 1 },
    { id: "s2", name: "Review", sort_order: 2 },
  ],
  setPeekIssue: vi.fn(),
  canEdit: true,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/services/project/project-task-list.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ProjectTaskListService: class {
    list = mocks.list;
  },
}));
vi.mock("@/services/issue/issue.service", () => ({
  IssueService: class {
    patchIssue = mocks.patchIssue;
  },
}));
vi.mock("@/hooks/store/use-project-section", () => ({
  useProjectSection: () => ({ fetch: mocks.fetchSections, getSections: () => mocks.sections, create: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me", user_timezone: "UTC" } }),
  useUserPermissions: () => ({ allowPermissions: () => mocks.canEdit }),
}));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date("2026-11-03T12:00:00Z") }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ peekIssue: undefined, setPeekIssue: mocks.setPeekIssue }),
}));
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("@/components/issues/create-task-entry", () => ({
  CreateTaskEntry: ({ isOpen, data }: { isOpen: boolean; data: Record<string, unknown> }) =>
    isOpen ? <div data-testid="create-modal">{JSON.stringify(data)}</div> : null,
}));
vi.mock("./project-list-filters", () => ({ ProjectListFilters: () => <button type="button">Filter</button> }));

const pointer = (node: Element, type: string, clientX: number) =>
  node.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));
const task = (patch: Partial<TProjectListTask>): TProjectListTask => ({
  id: "t1",
  name: "Task",
  sequence_id: 1,
  priority: "none",
  start_date: null,
  target_date: null,
  state_id: "todo",
  state_group: "unstarted",
  parent_id: null,
  section_id: "s1",
  comment_count: 0,
  assignee_ids: [],
  ...patch,
});
const TASKS = [
  task({ id: "t1", name: "Wireframes", start_date: "2026-11-02", target_date: "2026-11-04" }),
  task({ id: "t2", name: "Launch", target_date: "2026-11-10", state_group: "completed", state_id: "done" }),
  task({ id: "t3", name: "Someday" }),
  task({ id: "t4", name: "Polish", start_date: "2026-11-05", target_date: "2026-11-06", section_id: "s2" }),
];
const RESPONSE: TProjectTaskList = {
  project_identifier: "WEB",
  completed_state_id: "done",
  default_state_id: "todo",
  truncated: false,
  results: TASKS,
};

describe("ProjectTimeline", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEdit = true;
    mocks.list.mockResolvedValue(RESPONSE);
    mocks.patchIssue.mockResolvedValue({});
    mocks.fetchSections.mockResolvedValue(mocks.sections);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render() {
    await act(async () => {
      root.render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
          <ProjectTimeline workspaceSlug="acme" projectId="p1" />
        </SWRConfig>
      );
    });
  }
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === label || node.getAttribute("aria-label") === label
    ) as HTMLButtonElement;
  const stage = (name: string) => host.querySelector(`section[aria-label="${name}"]`) as HTMLElement;
  const rowNames = (name: string) =>
    [...stage(name).querySelectorAll('[role="row"]')].map((row) => row.querySelector("button")!.textContent);
  const choose = async (label: string, value: string) => {
    const select = host.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  it("shows the toolbar, stage rows with counts, bars, milestones and the today line", async () => {
    await render();
    expect(button("Add task")).toBeDefined();
    expect(button("Filter")).toBeDefined();
    expect(button("Today")).toBeDefined();
    expect(host.textContent).toContain("Stage / Task");
    expect(host.textContent).toContain("November 2026");
    expect(host.textContent).toContain("Nov 2 – 8");
    expect(stage("To Do").textContent).toContain("3");
    expect(rowNames("To Do")).toEqual(["Wireframes", "Launch", "Someday"]);
    expect(rowNames("Review")).toEqual(["Polish"]);
    const bar = button("Wireframes, Nov 2 – Nov 4");
    expect(bar.dataset.shape).toBe("bar");
    expect(bar.className).toContain("bg-[#135DDD]");
    expect(button("Launch, Nov 10").dataset.shape).toBe("milestone");
    expect(stage("To Do").textContent).toContain("No dates");
    expect(host.querySelector('[data-testid="today-line"]')).not.toBeNull();
  });

  it("opens tasks from the name or the bar and adds tasks", async () => {
    await render();
    await act(async () => button("Wireframes").click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t1" });
    await act(async () => button("Polish, Nov 5 – Nov 6").click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t4" });
    await act(async () => button("Add task").click());
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({ project_id: "p1" });
  });

  it("sorts tasks within a stage and changes the scale", async () => {
    await render();
    await choose("Sort tasks", "name");
    expect(rowNames("To Do")).toEqual(["Launch", "Someday", "Wireframes"]);
    await choose("Timeline scale", "days");
    expect(host.textContent).toContain("T 3");
    await choose("Timeline scale", "months");
    expect(host.textContent).toContain("2026");
  });

  it("drags a bar to reschedule the task without opening it", async () => {
    await render();
    const bar = button("Wireframes, Nov 2 – Nov 4");
    await act(async () => pointer(bar, "pointerdown", 100));
    await act(async () => pointer(bar, "pointermove", 140));
    expect(button("Wireframes, Nov 4 – Nov 6")).toBeDefined();
    await act(async () => pointer(bar, "pointerup", 140));
    await act(async () => bar.click());
    expect(mocks.patchIssue).toHaveBeenCalledWith("acme", "p1", "t1", {
      start_date: "2026-11-04",
      target_date: "2026-11-06",
    });
    expect(mocks.setPeekIssue).not.toHaveBeenCalled();
  });

  it("drags a bar end to change only the due date", async () => {
    await render();
    const end = button("Wireframes, Nov 2 – Nov 4").querySelector('[data-handle="end"]')!;
    await act(async () => pointer(end, "pointerdown", 100));
    await act(async () => pointer(end, "pointermove", 120));
    await act(async () => pointer(end, "pointerup", 120));
    expect(mocks.patchIssue).toHaveBeenCalledWith("acme", "p1", "t1", {
      start_date: "2026-11-02",
      target_date: "2026-11-05",
    });
  });

  it("is read-only for guests", async () => {
    mocks.canEdit = false;
    await render();
    expect(button("Add task")).toBeUndefined();
    const bar = button("Wireframes, Nov 2 – Nov 4");
    expect(bar.querySelector("[data-handle]")).toBeNull();
    await act(async () => pointer(bar, "pointerdown", 100));
    await act(async () => pointer(bar, "pointermove", 160));
    await act(async () => pointer(bar, "pointerup", 160));
    expect(mocks.patchIssue).not.toHaveBeenCalled();
  });
});
