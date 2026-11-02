import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { MyTasksPage } from "./my-tasks-page";
import type { TPersonalTask } from "@/services/personal-task.service";
import type { TMyTaskListItem } from "@/services/workspace-my-tasks.service";

const state = vi.hoisted(() => ({
  personal: vi.fn(),
  assigned: vi.fn(),
  update: vi.fn(),
  patch: vi.fn(),
  peek: vi.fn(),
  toast: vi.fn(),
  sections: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me", display_name: "Maya Patel", user_timezone: "UTC" } }),
  useUserPermissions: () => ({ allowPermissions: () => true }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: () => ({ display_name: "Maya Patel" }) }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ peekIssue: null, setPeekIssue: state.peek }),
}));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date("2026-10-31T12:00:00Z") }),
}));
vi.mock("@/services/workspace-my-tasks.service", () => ({
  MyTasksService: class {
    all = state.assigned;
  },
}));
vi.mock("@/services/issue/issue.service", () => ({
  IssueService: class {
    patchIssue = state.patch;
  },
}));
vi.mock("@/services/personal-task.service", () => ({
  personalTaskService: { list: state.personal, update: state.update },
  personalTasksKey: (slug: string, id: string) => ["personal-tasks", slug, id],
  personalTaskError: () => "Please try again.",
}));
vi.mock("@/services/project/project-section.service", () => ({
  ProjectSectionService: class {
    list = state.sections;
  },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("./create-task-button", () => ({
  ProfileCreateTaskButton: ({ ariaLabel }: { ariaLabel?: string }) => <button aria-label={ariaLabel}>Add task</button>,
}));
vi.mock("./personal-task-dialog", () => ({
  PersonalTaskDialog: ({ task }: { task: TPersonalTask }) => <div role="dialog">{task.name}</div>,
}));
const personal: TPersonalTask = {
  id: "private",
  name: "Buy supplies",
  priority: "none",
  description: "",
  start_date: null,
  target_date: null,
  completed_at: null,
  created_at: "2026-10-31",
  updated_at: "2026-10-31",
};
const project: TMyTaskListItem = {
  id: "assigned",
  name: "Website Builder",
  project_id: "project",
  project_identifier: "WEB",
  project_name: "Website Redesign",
  assignee_ids: ["me"],
  sequence_id: 1,
  priority: "none",
  target_date: "2026-10-31",
  completed_at: null,
  state_id: "started",
  state_group: "started",
  state_name: "In progress",
  state_color: "#135DDD",
  completed_state_id: "done",
  default_state_id: "todo",
  section_id: "review",
  section_name: "Waiting for review",
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const animationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  // oxlint-disable-next-line no-extend-native -- JSDOM does not implement the Web Animations API.
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  state.personal.mockResolvedValue([personal]);
  state.assigned.mockResolvedValue([project]);
  state.update.mockResolvedValue({});
  state.patch.mockResolvedValue({});
  state.sections.mockResolvedValue([
    { id: "todo-section", name: "To Do", sort_order: 1 },
    { id: "review", name: "Waiting for review", sort_order: 2 },
    { id: "done-section", name: "Done", sort_order: 3 },
  ]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  // oxlint-disable-next-line no-extend-native -- Restore the browser API after each test.
  if (animationsDescriptor) Object.defineProperty(Element.prototype, "getAnimations", animationsDescriptor);
  else Reflect.deleteProperty(Element.prototype, "getAnimations");
});
async function render() {
  await act(async () =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <MyTasksPage workspaceSlug="team" />
      </SWRConfig>
    )
  );
}
async function click(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (element) => element.textContent === label || element.getAttribute("aria-label") === label
  );
  expect(button).toBeDefined();
  await act(() => button?.click());
}
it("renders Figma columns and actual personal/project task data without legacy profile widgets", async () => {
  await render();
  expect(host.querySelector("h1")?.textContent).toBe("My Tasks");
  expect(Array.from(host.querySelectorAll("th")).map((item) => item.textContent)).toEqual([
    "Name",
    "Due date",
    "Collaborators",
    "Projects",
    "Status",
  ]);
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(host.textContent).toContain("Today");
  expect(host.textContent).toContain("No due date");
  expect(host.textContent).toContain("In progress");
  expect(host.textContent).not.toContain("Summary");
  await click("Website Builder");
  expect(state.peek).toHaveBeenCalledWith({ workspaceSlug: "team", projectId: "project", issueId: "assigned" });
  await click("Buy supplies");
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("Buy supplies");
});
it("completes personal and assigned project tasks through existing APIs", async () => {
  await render();
  await click("Complete Buy supplies");
  expect(state.update).toHaveBeenCalledWith("team", "private", { is_completed: true });
  await click("Complete Website Builder");
  expect(state.patch).toHaveBeenCalledWith("team", "project", "assigned", { state_id: "done" });
});
it("reports load failure separately from an empty list and supports retry", async () => {
  state.assigned.mockRejectedValueOnce(new Error("offline"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
  expect(host.textContent).not.toContain("No tasks yet");
  await click("Retry");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
});
it("surfaces failed completion without claiming success", async () => {
  state.update.mockRejectedValue(new Error("Permission denied"));
  await render();
  await click("Complete Buy supplies");
  expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: "Permission denied" }));
});

async function select(label: string, value: string) {
  const element = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  expect(element).not.toBeNull();
  await act(() => {
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

it("filters by account, project and completion with reset recovery", async () => {
  await render();
  await click("Filter");
  await select("Account", "personal");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(host.querySelector("tbody")?.textContent).toContain("Buy supplies");
  await select("Project", "project");
  expect(host.textContent).toContain("No matching tasks");
  const reset = Array.from(document.querySelectorAll("button")).find((item) => item.textContent === "Reset filters");
  await act(() => reset?.click());
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
  await select("Status", "completed");
  expect(host.textContent).toContain("No matching tasks");
});

it("searches task names and clears a no-match search", async () => {
  await render();
  const input = host.querySelector<HTMLInputElement>('[aria-label="Search tasks"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(() => {
    setter?.call(input, "unmatched");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).toContain("No matching tasks");
  await click("Clear filters");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
});

async function openBoard() {
  await render();
  const tab = Array.from(host.querySelectorAll('[role="tab"]')).find((item) => item.textContent === "Board");
  await act(() => (tab as HTMLButtonElement | undefined)?.click());
}
function column(label: string) {
  return host.querySelector<HTMLElement>(`section[aria-label="${label}"]`);
}
async function drag(name: string, target: string) {
  const card = host.querySelector<HTMLButtonElement>(`section button[aria-label="${name}"]`);
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  const fire = async (element: Element | null, type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    await act(() => element?.dispatchEvent(event));
  };
  await fire(card, "dragstart");
  await fire(column(target), "dragover");
  await fire(column(target), "drop");
}

it("shows a Figma board grouped by project sections with counts and add buttons", async () => {
  await openBoard();
  expect(host.querySelector("table")).toBeNull();
  expect(Array.from(host.querySelectorAll("section h3")).map((item) => item.textContent)).toEqual([
    "To Do",
    "In Progress",
    "Waiting For Review",
    "Done",
  ]);
  expect(column("To Do")?.textContent).toContain("Buy supplies");
  expect(column("Waiting For Review")?.textContent).toContain("Website Builder");
  expect(column("Waiting For Review")?.textContent).toContain("Due today");
  expect(column("Waiting For Review")?.textContent).toContain("Website Redesign");
  expect(column("In Progress")?.querySelector("header")?.textContent).toContain("0");
  expect(column("To Do")?.querySelector("header")?.lastElementChild?.textContent).toBe("1");
  expect(host.querySelector('[aria-label="Add task to Done"]')).not.toBeNull();
  await click("Website Builder");
  expect(state.peek).toHaveBeenCalledWith({ workspaceSlug: "team", projectId: "project", issueId: "assigned" });
});

it("moves project tasks into matching sections and completes tasks dropped in Done", async () => {
  await openBoard();
  await drag("Website Builder", "Done");
  expect(state.sections).toHaveBeenCalledWith("team", "project");
  expect(state.patch).toHaveBeenCalledWith("team", "project", "assigned", {
    section_id: "done-section",
    state_id: "done",
  });
  await drag("Buy supplies", "Done");
  expect(state.update).toHaveBeenCalledWith("team", "private", { is_completed: true });
});

it("rejects moves that have no matching section without changing the task", async () => {
  await openBoard();
  await drag("Website Builder", "In Progress");
  expect(state.patch).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({ type: "error", message: 'Website Redesign has no "In Progress" section.' })
  );
  await drag("Buy supplies", "Waiting For Review");
  expect(state.update).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: "Personal tasks can only move between To Do and Done." })
  );
});

it("applies filters to the board", async () => {
  await openBoard();
  await click("Filter");
  await select("Account", "company");
  expect(column("To Do")?.textContent).not.toContain("Buy supplies");
  expect(column("Waiting For Review")?.textContent).toContain("Website Builder");
});
