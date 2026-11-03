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
import { ProjectBoard } from "./project-board";
import { boardDueDetails, boardMovePatch, stageColors } from "./project-board.helpers";

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
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ name: "Website Redesign" }) }),
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
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("@/components/issues/issue-modal/modal", () => ({
  CreateUpdateIssueModal: ({ isOpen, data }: { isOpen: boolean; data: Record<string, unknown> }) =>
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
  task({ id: "t1", name: "Prepare Homepage Wireframes", section_id: "s1", target_date: "2026-10-29" }),
  task({ id: "t2", name: "Collect Clinic Content", section_id: "s1", target_date: "2026-10-30" }),
  task({ id: "t3", name: "Design Responsive Pages", section_id: "s2" }),
  task({ id: "t4", name: "Agree Project Scope", section_id: "s4", state_group: "completed", state_id: "done" }),
];
const RESPONSE: TProjectTaskList = {
  project_identifier: "WEB",
  completed_state_id: "done",
  default_state_id: "todo",
  truncated: false,
  results: TASKS,
};
const SECTIONS = [
  { id: "s1", name: "To Do", sort_order: 1 },
  { id: "s2", name: "In Progress", sort_order: 2 },
  { id: "s3", name: "Review", sort_order: 3 },
  { id: "s4", name: "Done", sort_order: 4 },
];
const group = (id: string | null, name: string) => ({ key: id ?? "no-section", sectionId: id, name, tasks: [] });

describe("project board helpers", () => {
  const states = { completed_state_id: "done", default_state_id: "todo" };

  it("moves into a section and completes or reopens across Done stages", () => {
    expect(boardMovePatch(TASKS[0], group("s2", "In Progress"), states)).toEqual({ section_id: "s2" });
    expect(boardMovePatch(TASKS[0], group("s4", "Done"), states)).toEqual({ section_id: "s4", state_id: "done" });
    expect(boardMovePatch(TASKS[3], group("s1", "To Do"), states)).toEqual({ section_id: "s1", state_id: "todo" });
    expect(boardMovePatch(TASKS[3], group(null, "No section"), states)).toEqual({ section_id: null, state_id: "todo" });
    expect(() => boardMovePatch(TASKS[0], group("s4", "Completed"), undefined)).toThrow("no completed state");
  });

  it("colours stages by position and highlights due or overdue dates", () => {
    expect(stageColors(group("s2", "Any"), 1).title).toContain("135DDD");
    expect(stageColors(group(null, "No section"), 3).title).toContain("384252");
    expect(boardDueDetails(TASKS[0], "2026-10-29")).toEqual({
      label: "Oct 29",
      className: expect.stringContaining("C2410C"),
    });
    expect(boardDueDetails(TASKS[1], "2026-10-29")?.className).toBe("text-secondary");
    expect(boardDueDetails(TASKS[2], "2026-10-29")).toBeNull();
  });
});

describe("ProjectBoard", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEdit = true;
    mocks.sections = SECTIONS;
    mocks.list.mockResolvedValue(RESPONSE);
    mocks.fetchSections.mockResolvedValue(SECTIONS);
    mocks.patchIssue.mockResolvedValue({});
    mocks.createSection.mockResolvedValue({ id: "s5", name: "QA", sort_order: 5 });
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
          <ProjectBoard workspaceSlug="acme" projectId="p1" />
        </SWRConfig>
      );
    });
  }
  const column = (name: string) => host.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!;
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label) as HTMLButtonElement;

  it("renders a column per stage with counts and Figma cards", async () => {
    await render();
    expect([...host.querySelectorAll("section h3")].map((node) => node.textContent)).toEqual([
      "To Do",
      "In Progress",
      "Review",
      "Done",
    ]);
    expect(column("To Do").querySelector("header span")?.textContent).toBe("2");
    expect(column("Review").querySelector("header span")?.textContent).toBe("0");
    const card = column("To Do").querySelector<HTMLButtonElement>('[aria-label="Prepare Homepage Wireframes"]')!;
    expect(card.textContent).toBe("Prepare Homepage WireframesWebsite RedesignOct 29");
    expect(card.draggable).toBe(true);
    await act(async () => card.click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t1" });
  });

  it("moves a dragged card to another stage and completes it in Done", async () => {
    await render();
    const card = column("To Do").querySelector<HTMLButtonElement>('[aria-label="Collect Clinic Content"]')!;
    const drag = (target: Element, type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { dataTransfer: { setData: vi.fn(), effectAllowed: "", dropEffect: "" } });
      target.dispatchEvent(event);
    };
    await act(async () => drag(card, "dragstart"));
    await act(async () => drag(column("Done"), "dragover"));
    await act(async () => drag(column("Done"), "drop"));
    expect(mocks.patchIssue).toHaveBeenCalledWith("acme", "p1", "t2", { section_id: "s4", state_id: "done" });
    expect(mocks.toast).toHaveBeenCalledWith({ type: "success", title: "Moved to Done" });
  });

  it("adds tasks in a stage and adds new stages", async () => {
    await render();
    await act(async () =>
      column("Review").querySelector<HTMLButtonElement>('[aria-label="Add task in Review"]')!.click()
    );
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({
      project_id: "p1",
      section_id: "s3",
    });
    await act(async () => button("Add Stage").click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Stage name"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, " QA ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
    expect(mocks.createSection).toHaveBeenCalledWith("acme", "p1", "QA");
    expect(host.querySelector('[aria-label="Stage name"]')).toBeNull();
  });

  it("is read-only for guests", async () => {
    mocks.canEdit = false;
    await render();
    expect(button("Add task")).toBeUndefined();
    expect(button("Add Stage")).toBeUndefined();
    expect(host.querySelector('[aria-label="Add task in To Do"]')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Collect Clinic Content"]')!.draggable).toBe(false);
  });
});
