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
import { ProjectCalendar, projectCalendarRows } from "./project-calendar";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  fetchSections: vi.fn(),
  sections: [{ id: "s1", name: "To Do", sort_order: 1 }],
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
    patchIssue = vi.fn();
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
];
const RESPONSE: TProjectTaskList = {
  project_identifier: "WEB",
  completed_state_id: "done",
  default_state_id: "todo",
  truncated: false,
  results: TASKS,
};

describe("projectCalendarRows", () => {
  it("maps every grouped task to a calendar row with its dates and completion", () => {
    const rows = projectCalendarRows([{ key: "s1", sectionId: "s1", name: "To Do", tasks: TASKS }]);
    expect(rows.map(({ key, due, completed, project }) => [key, due, completed, project.start_date])).toEqual([
      ["t1", "2026-11-04", false, "2026-11-02"],
      ["t2", "2026-11-10", true, null],
      ["t3", null, false, null],
    ]);
  });
});

describe("ProjectCalendar", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEdit = true;
    mocks.list.mockResolvedValue(RESPONSE);
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
          <ProjectCalendar workspaceSlug="acme" projectId="p1" />
        </SWRConfig>
      );
    });
  }
  const day = (label: string) => host.querySelector(`[aria-label="${label}"]`) as HTMLElement;
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label) as HTMLButtonElement;

  it("shows the List/Board toolbar and places tasks on their dates", async () => {
    await render();
    expect(button("Add task")).toBeDefined();
    expect(button("Filter")).toBeDefined();
    expect(host.textContent).toContain("November 2026");
    for (const date of ["Monday, 2 November 2026", "Tuesday, 3 November 2026", "Wednesday, 4 November 2026"])
      expect(day(date).textContent).toContain("Wireframes");
    expect(day("Thursday, 5 November 2026").textContent).not.toContain("Wireframes");
    expect(day("Tuesday, 10 November 2026").querySelector('[aria-label="Completed"]')).not.toBeNull();
    expect(host.textContent).toContain("1 task without dates are only shown in List and Board.");
  });

  it("opens a task in the peek view and adds a task due on a chosen day", async () => {
    await render();
    await act(async () => button("Wireframes").click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t1" });
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Add task on 12 November 2026"]')!.click()
    );
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({
      project_id: "p1",
      target_date: "2026-11-12",
    });
  });

  it("is read-only for guests", async () => {
    mocks.canEdit = false;
    await render();
    expect(button("Add task")).toBeUndefined();
    expect(host.querySelector('[aria-label^="Add task on"]')).toBeNull();
  });
});
