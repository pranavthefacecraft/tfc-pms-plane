/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import useSWR, { SWRConfig } from "swr";
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
  updateIssue: vi.fn(),
  listFields: vi.fn(),
  setFieldValue: vi.fn(),
  readFieldValues: vi.fn(),
  fetchSections: vi.fn(),
  createSection: vi.fn(),
  sections: [] as { id: string; name: string; sort_order: number }[],
  setPeekIssue: vi.fn(),
  canEdit: true,
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "acme" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
  useUserProfile: () => ({ data: { start_of_the_week: 1 } }),
}));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date("2026-10-29T12:00:00Z") }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    peekIssue: undefined,
    setPeekIssue: mocks.setPeekIssue,
    updateIssue: mocks.updateIssue,
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({
      display_name: id === "me" ? "Mia Lee" : id === "one-letter" ? "P" : "Ann",
      email: id === "ann" ? "ann@example.test" : undefined,
    }),
    project: { getProjectMemberIds: () => ["me", "ann"] },
    workspace: { isUserSuspended: () => false },
  }),
}));
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("./custom-fields/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./custom-fields/service")>();
  return {
    ...actual,
    customFields: { setValue: mocks.setFieldValue },
    useCustomFields: (slug: string, projectId: string) =>
      useSWR(["project-custom-fields", slug, projectId], mocks.listFields),
  };
});
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
    attachment_count: 1,
    status_name: "On Track",
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
function StatusDetailsProbe() {
  const { data } = useSWR(["task-custom-field-values", "acme", "p1", "t1"], mocks.readFieldValues);
  return <output data-testid="detail-status">{data?.status}</output>;
}

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
  const animationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Reflect.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
    vi.clearAllMocks();
    mocks.updateIssue.mockReset();
    mocks.canEdit = true;
    mocks.sections = [
      { id: "s1", name: "To Do", sort_order: 1 },
      { id: "s2", name: "In Progress", sort_order: 2 },
    ];
    mocks.list.mockResolvedValue(RESPONSE);
    mocks.listFields.mockResolvedValue([]);
    mocks.readFieldValues.mockResolvedValue({ status: "on-track" });
    mocks.fetchSections.mockResolvedValue(mocks.sections);
    mocks.patchIssue.mockResolvedValue({});
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    if (animationsDescriptor) Reflect.defineProperty(Element.prototype, "getAnimations", animationsDescriptor);
    else Reflect.deleteProperty(Element.prototype, "getAnimations");
  });

  async function render(withStatusDetails = false) {
    await act(async () => {
      root.render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
          <ProjectList workspaceSlug="acme" projectId="p1" />
          {withStatusDetails && <StatusDetailsProbe />}
        </SWRConfig>
      );
    });
  }
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label) as HTMLButtonElement;
  const rows = () => [...host.querySelectorAll("tbody tr")].map((row) => row.textContent);

  it("shows two collaborator avatars and groups the rest beside the add control", async () => {
    mocks.list.mockResolvedValue({
      ...RESPONSE,
      results: [task({ assignee_ids: ["me", "ann", "one-letter", "other"] })],
    });
    await render();
    const add = host.querySelector('[aria-label="Add collaborator to Task"]');
    const stack = add?.previousElementSibling;
    expect([...stack!.children].map((item) => item.textContent)).toEqual(["ML", "AN", "+2"]);
    expect(stack?.querySelector('[aria-label="2 more collaborators"]')).not.toBeNull();
  });

  it("adds a project member from the plus dropdown without replacing existing collaborators or opening details", async () => {
    // The member list is virtualized and jsdom does not calculate the viewport's height.
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
    try {
      mocks.updateIssue.mockImplementationOnce(async () => {
        mocks.list.mockResolvedValue({
          ...RESPONSE,
          results: TASKS.map((item) => (item.id === "t1" ? { ...item, assignee_ids: ["me", "ann"] } : item)),
        });
      });
      await render();
      const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Add collaborator to Wireframes"]')!;
      expect(trigger.querySelector("svg.lucide-plus")).not.toBeNull();
      await act(async () => trigger.click());
      expect(document.body.querySelector('input[placeholder="Name or email"]')).not.toBeNull();
      const options = await vi.waitFor(() => {
        const items = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')];
        expect(items).toHaveLength(1);
        return items;
      });
      expect(options[0].textContent).toContain("Ann");
      await act(async () => options[0].click());
      expect(mocks.updateIssue).toHaveBeenCalledExactlyOnceWith("acme", "p1", "t1", { assignee_ids: ["me", "ann"] });
      expect(host.querySelector('[aria-label="Ann"]')?.textContent).toBe("AN");
      expect(mocks.setPeekIssue).not.toHaveBeenCalled();
    } finally {
      height.mockRestore();
    }
  });

  it("shows the selected priority and saves through the task detail store before refreshing the list", async () => {
    mocks.updateIssue.mockImplementationOnce(async () => {
      mocks.list.mockResolvedValue({
        ...RESPONSE,
        results: TASKS.map((item) => (item.id === "t1" ? { ...item, priority: "high" } : item)),
      });
    });
    await render();
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Set priority for Wireframes: Medium"]')!;
    await act(() => trigger.click());
    const menu = document.body.querySelector('[role="menu"]')!;
    expect(menu.textContent).toContain("Set Priority");
    const options = [...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      "No Priority",
      "Low",
      "Medium",
      "High",
      "Urgent",
    ]);
    expect(options[2].getAttribute("aria-checked")).toBe("true");

    await act(async () => options[3].click());
    expect(mocks.updateIssue).toHaveBeenCalledExactlyOnceWith("acme", "p1", "t1", { priority: "high" });
    expect(host.querySelector('[aria-label="Set priority for Wireframes: High"]')).not.toBeNull();
    expect(mocks.setPeekIssue).not.toHaveBeenCalled();
  });

  it("keeps priority read-only for users who cannot edit", async () => {
    mocks.canEdit = false;
    await render();
    expect(rows()).toContain("Wireframes12MLMediumOn TrackToday");
    expect(host.querySelector('[aria-label^="Set priority for "]')).toBeNull();
  });

  it("uses configured status options, marks the active one, and refreshes the list and details after selection", async () => {
    mocks.listFields.mockResolvedValue([
      {
        id: "status",
        name: "Status",
        field_type: "single_select",
        options: [
          { id: "on-track", name: "On Track" },
          { id: "needs-attention", name: "Needs Attention" },
          { id: "on-hold", name: "On Hold" },
          { id: "blocked", name: "Blocked" },
        ],
      },
    ]);
    mocks.setFieldValue.mockImplementationOnce(async () => {
      mocks.readFieldValues.mockResolvedValue({ status: "needs-attention" });
      mocks.list.mockResolvedValue({
        ...RESPONSE,
        results: TASKS.map((item) => (item.id === "t1" ? { ...item, status_name: "Needs Attention" } : item)),
      });
    });
    await render(true);
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Set status for Wireframes: On Track"]')!;
    await act(() => trigger.click());
    const menu = document.body.querySelector('[role="menu"]')!;
    expect(menu.textContent).toContain("Set Status");
    const options = [...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(options).toHaveLength(5);
    expect(options[0].getAttribute("aria-checked")).toBe("true");
    const needsAttention = options.find((option) => option.textContent?.includes("Needs Attention"))!;
    await act(async () => needsAttention.click());
    expect(mocks.setFieldValue).toHaveBeenCalledExactlyOnceWith("acme", "p1", "t1", "status", "needs-attention");
    expect(host.querySelector('[aria-label="Set status for Wireframes: Needs Attention"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="detail-status"]')?.textContent).toBe("needs-attention");
  });

  it("renders the Figma columns and section groups with task details", async () => {
    await render();
    expect([...host.querySelectorAll("thead th")].map((cell) => cell.textContent)).toEqual([
      "Name",
      "Collaborators",
      "Priority",
      "Status",
      "Due date",
    ]);
    expect([...host.querySelectorAll("tbody th")].map((cell) => cell.textContent)).toEqual([
      "To Do",
      "In Progress",
      "No section",
    ]);
    expect(rows()).toContain("Wireframes12MLMediumOn TrackToday");
    expect(host.querySelector('[aria-label="1 attachments"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="2 comments"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Mia Lee"]')?.textContent).toBe("ML");
    expect(mocks.list).toHaveBeenCalledWith("acme", "p1");
  });

  it("shows two letters for collaborators with a single-word or one-letter name", async () => {
    mocks.list.mockResolvedValue({
      ...RESPONSE,
      results: [task({ assignee_ids: ["ann", "one-letter"] })],
    });
    await render();
    expect(host.querySelector('[aria-label="Ann"]')?.textContent).toBe("AN");
    expect(host.querySelector('[aria-label="P"]')?.textContent).toBe("PP");
  });

  it("collapses a group and opens a task in the peek overview", async () => {
    await render();
    await act(async () => button("To Do").click());
    expect(rows().some((row) => row?.startsWith("Wireframes"))).toBe(false);
    expect(button("To Do").getAttribute("aria-expanded")).toBe("false");
    await act(async () => button("Copy").click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t2" });
  });

  it("expands nested tasks and preselects the parent and section when adding a subtask", async () => {
    mocks.list.mockResolvedValue({
      ...RESPONSE,
      results: [...TASKS, task({ id: "child", name: "Mobile layout", parent_id: "t1", section_id: "s1" })],
    });
    await render();
    expect(button("Mobile layout")).toBeUndefined();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Subtasks for Wireframes"]')!.click());
    expect(button("Mobile layout")).toBeDefined();
    await act(async () => button("Add Subtask").click());
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({
      project_id: "p1",
      section_id: "s1",
      parent_id: "t1",
    });
  });

  it("opens an unset due date in the calendar and saves a date without opening the task", async () => {
    const item = task({ start_date: "2026-10-28" });
    const initial = { ...RESPONSE, results: [item] };
    mocks.list.mockResolvedValue(initial);
    mocks.updateIssue.mockImplementation(async () => {
      mocks.list.mockResolvedValue({ ...initial, results: [{ ...item, target_date: "2026-10-30" }] });
    });
    await render();
    const cell = host.querySelector('[aria-label="Due date for Task"]')!;
    const trigger = cell.querySelector("button")!;
    expect(trigger.textContent).toBe("—");
    await act(async () => trigger.click());
    const calendarButtons = [...document.body.querySelectorAll("button")];
    const day = (label: string) => calendarButtons.find((item) => item.getAttribute("aria-label")?.includes(label))!;
    expect(day("October 28th, 2026").disabled).toBe(true);
    expect(day("October 29th, 2026").disabled).toBe(false);
    await act(async () => day("October 30th, 2026").click());
    expect(mocks.updateIssue).toHaveBeenCalledWith("acme", "p1", item.id, { target_date: "2026-10-30" });
    expect(cell.textContent).toBe("Oct 30, 2026");
    expect(mocks.setPeekIssue).not.toHaveBeenCalled();
  });

  it("disables today when a task starts later", async () => {
    mocks.list.mockResolvedValue({ ...RESPONSE, results: [task({ start_date: "2026-10-30" })] });
    await render();
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Due date for Task"] button')!;
    await act(async () => trigger.click());
    const calendarButtons = [...document.body.querySelectorAll("button")];
    expect(
      calendarButtons.find((item) => item.getAttribute("aria-label")?.includes("October 29th, 2026"))?.disabled
    ).toBe(true);
    expect(
      calendarButtons.find((item) => item.getAttribute("aria-label")?.includes("October 30th, 2026"))?.disabled
    ).toBe(false);
  });

  it("clears an existing due date from the calendar", async () => {
    await render();
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Due date for Wireframes"] button')!;
    expect(trigger.textContent).toBe("Today");
    await act(async () => trigger.click());
    const clear = [...document.body.querySelectorAll("button")].find((item) => item.textContent === "Clear due date")!;
    await act(async () => clear.click());
    expect(mocks.updateIssue).toHaveBeenCalledWith("acme", "p1", "t1", { target_date: null });
  });

  it("sorts tasks within their section", async () => {
    mocks.list.mockResolvedValue({
      ...RESPONSE,
      results: [...TASKS, task({ id: "t4", name: "Assets", section_id: "s1" })],
    });
    await render();
    await act(async () => button("Sort").click());
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      "Default order",
      "Due date (earliest first)",
      "Due date (latest first)",
      "Due date (expired)",
      "Name (A–Z)",
      "Last updated (newest first)",
    ]);
    expect(options[0].getAttribute("aria-checked")).toBe("true");
    await act(async () => options[4].click());
    expect(
      rows()
        .slice(1, 3)
        .map((row) => row?.split(/None|12/)[0])
    ).toEqual(["Assets", "Wireframes"]);
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

  it("shows a blank project empty with an Add Stage button", async () => {
    mocks.sections = [];
    mocks.list.mockResolvedValue({ ...RESPONSE, results: [] });
    mocks.createSection.mockResolvedValue({ id: "s9", name: "Backlog", sort_order: 1 });
    await render();
    expect(host.querySelectorAll("tbody th")).toHaveLength(0);
    expect(host.textContent).toContain("No tasks yet.");
    await act(async () => button("Add Stage").click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Stage name"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, "Backlog");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Add").click());
    expect(mocks.createSection).toHaveBeenCalledWith("acme", "p1", "Backlog");
    expect(mocks.toast).toHaveBeenCalledWith({ type: "success", title: "Stage added" });
  });

  it("is read-only for guests", async () => {
    mocks.canEdit = false;
    await render();
    expect(host.querySelector('[aria-label="Due date for Wireframes"] button')).toBeNull();
    expect(button("Add task")).toBeUndefined();
    expect(button("Add task in To Do")).toBeUndefined();
    expect(button("Add Stage")).toBeUndefined();
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
    expect(rows()).toContain("Wireframes12MLMediumOn TrackToday");
  });
});
