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
import { ProjectList } from "./project-list";
import {
  EMPTY_LIST_FILTERS,
  dueDateDetails,
  groupTasksBySection,
  listFilterCount,
  matchesListFilters,
} from "./project-list.helpers";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  patchIssue: vi.fn(),
  fetchSections: vi.fn(),
  createSection: vi.fn(),
  sections: [] as { id: string; name: string; sort_order: number }[],
  setPeekIssue: vi.fn(),
  canEdit: true,
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
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
  useProjectSection: () => ({
    fetch: mocks.fetchSections,
    getSections: () => mocks.sections,
    create: mocks.createSection,
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me", user_timezone: "UTC" } }),
  useUserPermissions: () => ({ allowPermissions: () => mocks.canEdit }),
}));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date("2026-10-29T12:00:00Z") }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ peekIssue: undefined, setPeekIssue: mocks.setPeekIssue }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: (id: string) => ({ display_name: id === "me" ? "Mia Lee" : "Ann" }) }),
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
  section_id: null,
  comment_count: 0,
  assignee_ids: [],
  ...patch,
});

const TASKS = [
  task({
    id: "t1",
    name: "Wireframes",
    section_id: "s1",
    priority: "medium",
    target_date: "2026-10-29",
    comment_count: 2,
    assignee_ids: ["me"],
  }),
  task({ id: "t2", name: "Copy", section_id: "s2", priority: "low", target_date: "2026-11-03" }),
  task({ id: "t3", name: "Launch", state_group: "completed", state_id: "done" }),
];
const RESPONSE: TProjectTaskList = {
  project_identifier: "WEB",
  completed_state_id: "done",
  default_state_id: "todo",
  truncated: false,
  results: TASKS,
};

describe("project list helpers", () => {
  it("groups tasks by section order and adds No section only when needed", () => {
    const sections = [
      { id: "s2", name: "In Progress", sort_order: 2 },
      { id: "s1", name: "To Do", sort_order: 1 },
    ];
    const groups = groupTasksBySection(TASKS, sections);
    expect(groups.map((group) => [group.name, group.tasks.map((item) => item.id)])).toEqual([
      ["To Do", ["t1"]],
      ["In Progress", ["t2"]],
      ["No section", ["t3"]],
    ]);
    expect(groupTasksBySection(TASKS.slice(0, 2), sections).map((group) => group.name)).toEqual([
      "To Do",
      "In Progress",
    ]);
    expect(groupTasksBySection([], [])).toEqual([]);
    expect(groupTasksBySection([task({ section_id: "gone" })], sections)[2].tasks).toHaveLength(1);
  });

  it("matches status, priority, due date and collaborator filters", () => {
    const today = "2026-10-29";
    const match = (filters: Partial<typeof EMPTY_LIST_FILTERS>) =>
      TASKS.filter((item) => matchesListFilters(item, { ...EMPTY_LIST_FILTERS, ...filters }, today, "me")).map(
        (item) => item.id
      );
    expect(match({})).toEqual(["t1", "t2", "t3"]);
    expect(match({ statuses: ["completed"] })).toEqual(["t3"]);
    expect(match({ priorities: ["medium", "low"] })).toEqual(["t1", "t2"]);
    expect(match({ due: ["today"] })).toEqual(["t1"]);
    expect(match({ due: ["week", "none"] })).toEqual(["t2", "t3"]);
    expect(match({ assignees: ["me"] })).toEqual(["t1"]);
    expect(match({ assignees: ["unassigned"], statuses: ["open"] })).toEqual(["t2"]);
    expect(listFilterCount({ ...EMPTY_LIST_FILTERS, due: ["today"], priorities: ["low", "high"] })).toBe(3);
  });

  it("highlights today and overdue due dates", () => {
    expect(dueDateDetails(TASKS[0], "2026-10-29")).toEqual({
      label: "Today",
      className: expect.stringContaining("009E79"),
    });
    expect(dueDateDetails(TASKS[0], "2026-11-01").className).toContain("DC3E42");
    expect(dueDateDetails(TASKS[2], "2026-10-29").label).toBe("—");
  });
});

describe("ProjectList", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEdit = true;
    mocks.sections = [
      { id: "s1", name: "To Do", sort_order: 1 },
      { id: "s2", name: "In Progress", sort_order: 2 },
    ];
    mocks.list.mockResolvedValue(RESPONSE);
    mocks.fetchSections.mockResolvedValue(mocks.sections);
    mocks.patchIssue.mockResolvedValue({});
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
          <ProjectList workspaceSlug="acme" projectId="p1" />
        </SWRConfig>
      );
    });
  }
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label) as HTMLButtonElement;
  const rows = () => [...host.querySelectorAll("tbody tr")].map((row) => row.textContent);

  it("renders the Figma columns and section groups with task details", async () => {
    await render();
    expect([...host.querySelectorAll("thead th")].map((cell) => cell.textContent)).toEqual([
      "Name",
      "Collaborators",
      "Priority",
      "Due date",
    ]);
    expect([...host.querySelectorAll("tbody th")].map((cell) => cell.textContent)).toEqual([
      "To Do1",
      "In Progress1",
      "No section1",
    ]);
    expect(rows()).toContain("Wireframes2MLMediumToday");
    expect(host.querySelector('[aria-label="2 comments"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Mia Lee"]')?.textContent).toBe("ML");
    expect(mocks.list).toHaveBeenCalledWith("acme", "p1");
  });

  it("collapses a group and opens a task in the peek overview", async () => {
    await render();
    await act(async () => button("To Do1").click());
    expect(rows().some((row) => row?.startsWith("Wireframes"))).toBe(false);
    expect(button("To Do1").getAttribute("aria-expanded")).toBe("false");
    await act(async () => button("Copy").click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t2" });
  });

  it("completes and reopens tasks with the project's states", async () => {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Complete Wireframes"]')!.click());
    expect(mocks.patchIssue).toHaveBeenCalledWith("acme", "p1", "t1", { state_id: "done" });
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Reopen Launch"]')!.click());
    expect(mocks.patchIssue).toHaveBeenCalledWith("acme", "p1", "t3", { state_id: "todo" });
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });

  it("adds tasks in the chosen section or the project default", async () => {
    await render();
    await act(async () => button("Add task in In Progress").click());
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({
      project_id: "p1",
      section_id: "s2",
    });
    await act(async () => button("Add task in No section").click());
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({
      project_id: "p1",
      section_id: null,
    });
    await act(async () => button("Add task").click());
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({ project_id: "p1" });
  });

  it("shows a blank project empty with an Add Section button", async () => {
    mocks.sections = [];
    mocks.list.mockResolvedValue({ ...RESPONSE, results: [] });
    mocks.createSection.mockResolvedValue({ id: "s9", name: "Backlog", sort_order: 1 });
    await render();
    expect(host.querySelectorAll("tbody th")).toHaveLength(0);
    expect(host.textContent).toContain("No tasks yet.");
    await act(async () => button("Add Section").click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Section name"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, "Backlog");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Add").click());
    expect(mocks.createSection).toHaveBeenCalledWith("acme", "p1", "Backlog");
    expect(mocks.toast).toHaveBeenCalledWith({ type: "success", title: "Section added" });
  });

  it("is read-only for guests", async () => {
    mocks.canEdit = false;
    await render();
    expect(button("Add task")).toBeUndefined();
    expect(button("Add task in To Do")).toBeUndefined();
    expect(button("Add Section")).toBeUndefined();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Complete Wireframes"]')!.disabled).toBe(true);
  });

  it("searches task names and offers to clear when nothing matches", async () => {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Open search"]')!.click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Search tasks"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, "zzz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.textContent).toContain("No matching tasks.");
    await act(async () => button("Clear filters").click());
    expect(rows().some((row) => row?.startsWith("Wireframes"))).toBe(true);
  });

  it("shows a retry when the list fails to load", async () => {
    mocks.list.mockRejectedValueOnce(new Error("Offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
    mocks.list.mockResolvedValue(RESPONSE);
    await act(async () => button("Retry").click());
    expect(rows()).toContain("Wireframes2MLMediumToday");
  });
});
