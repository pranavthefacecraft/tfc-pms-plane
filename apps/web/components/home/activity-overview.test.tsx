import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { TPersonalTask } from "@/services/personal-task.service";
import type { TScheduledProjectTask } from "@/services/workspace-my-tasks.service";
import { ActivityOverview } from "./activity-overview";
import {
  calendarDays,
  dateKey,
  overviewTasks,
  taskActiveToday,
  taskOnDate,
  zonedDateKey,
  defaultActivityFilter,
  matchesActivityFilter,
} from "./activity-overview.helpers";

const state = vi.hoisted(() => ({
  personal: vi.fn(),
  schedule: vi.fn(),
  peek: vi.fn(),
  canCreate: true,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me", display_name: "Maya Patel", user_timezone: "Asia/Kolkata" } }),
  useUserPermissions: () => ({ allowPermissions: () => state.canCreate }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({ display_name: id === "alex" ? "Alex Morgan" : "Team Member" }),
  }),
}));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date("2026-10-30T12:00:00Z") }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ peekIssue: null, setPeekIssue: state.peek }),
}));
vi.mock("@/services/workspace-my-tasks.service", () => ({
  MyTasksService: class {
    schedule = state.schedule;
  },
}));
vi.mock("@/services/personal-task.service", () => ({
  personalTaskService: { list: state.personal },
  personalTasksKey: (slug: string, user: string) => ["personal-tasks", slug, user],
}));
vi.mock("@/components/profile/create-task-button", () => ({
  ProfileCreateTaskButton: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("@/components/profile/personal-task-dialog", () => ({
  PersonalTaskDialog: ({ task }: { task: TPersonalTask }) => <div role="dialog">{task.name}</div>,
}));

const personal: TPersonalTask = {
  id: "personal",
  name: "Private task",
  description: "",
  priority: "none",
  start_date: "2026-10-29",
  target_date: "2026-10-31",
  completed_at: null,
  created_at: "2026-10-29T12:00:00Z",
  updated_at: "2026-10-29T12:00:00Z",
};
const project: TScheduledProjectTask = {
  id: "assigned",
  name: "Assigned task",
  project_id: "project",
  project_identifier: "PMS",
  project_name: "Website Redesign",
  assignee_ids: ["me", "alex"],
  created_by: "me",
  sequence_id: 7,
  state_group: "started",
  start_date: null,
  target_date: "2026-10-30",
  completed_at: null,
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
  // oxlint-disable-next-line no-extend-native -- JSDOM lacks the Web Animations API used by the menu.
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  state.canCreate = true;
  state.personal.mockResolvedValue([]);
  state.schedule.mockResolvedValue({ results: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  // oxlint-disable-next-line no-extend-native -- Restore the original browser API descriptor after the test.
  if (animationsDescriptor) Object.defineProperty(Element.prototype, "getAnimations", animationsDescriptor);
  else Reflect.deleteProperty(Element.prototype, "getAnimations");
});
async function render() {
  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
        <ActivityOverview workspaceSlug="team" />
      </SWRConfig>
    );
  });
}
function button(label: string) {
  return Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes(label));
}

it("renders the Figma sections and genuine empty states", async () => {
  await render();
  expect(host.textContent).toContain("Overview");
  expect(button("Add task")).toBeDefined();
  expect(host.textContent).toContain("Today's Activity");
  expect(host.textContent).toContain("No Activity Yet");
  expect(host.textContent).toContain("No schedule yet");
  expect(state.schedule).toHaveBeenCalledWith("team", "2026-10-26", "2026-11-01");
  expect(state.schedule).toHaveBeenCalledWith("team", "2026-10-30", "2026-10-30");
});

async function toggleFilter(label: string) {
  const checkbox = Array.from(document.querySelectorAll("label"))
    .find((item) => item.textContent?.trim() === label)
    ?.querySelector("input");
  expect(checkbox).toBeDefined();
  await act(() => checkbox?.click());
}

async function filterAction(label: string) {
  const target = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === label);
  expect(target).toBeDefined();
  await act(() => target?.click());
}

it("applies account filters to Activity only and resets the draft without immediately changing results", async () => {
  state.personal.mockResolvedValue([personal]);
  state.schedule.mockResolvedValue({ results: [project] });
  await render();
  await filterAction("Filter");
  await toggleFilter("Company");
  expect(host.querySelector("table")?.textContent).toContain("Assigned task");
  await filterAction("Apply");
  expect(host.querySelector("table")?.textContent).not.toContain("Assigned task");
  expect(host.querySelector("table")?.textContent).toContain("Private task");
  expect(host.querySelector('[aria-labelledby="activity-calendar-title"]')?.textContent).toContain("Assigned task");
  await filterAction("Filter (active)");
  await filterAction("Reset");
  expect(host.querySelector("table")?.textContent).not.toContain("Assigned task");
  await filterAction("Apply");
  expect(host.querySelector("table")?.textContent).toContain("Assigned task");
});

it("supports source filtering, no-match recovery and real project names", async () => {
  state.personal.mockResolvedValue([personal]);
  state.schedule.mockResolvedValue({ results: [project] });
  await render();
  await filterAction("Filter");
  await toggleFilter("Website Redesign");
  await filterAction("Apply");
  expect(host.querySelector("table")?.textContent).not.toContain("Assigned task");
  expect(host.querySelector("table")?.textContent).toContain("Private task");
  await filterAction("Filter (active)");
  await toggleFilter("PMS");
  await filterAction("Apply");
  expect(host.textContent).toContain("No matching activity");
  expect(host.querySelector("table")).toBeNull();
  await filterAction("Clear filters");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
});

it("combines source, project and account selections without leaking other results", () => {
  const tasks = overviewTasks([personal], [project]);
  expect(
    tasks
      .filter((task) => matchesActivityFilter(task, { ...defaultActivityFilter, personal: false }))
      .map((task) => task.key)
  ).toEqual(["project-assigned"]);
  expect(
    tasks.filter((task) =>
      matchesActivityFilter(task, { ...defaultActivityFilter, personal: false, excludedProjects: ["project"] })
    )
  ).toEqual([]);
  expect(tasks.filter((task) => matchesActivityFilter(task, { ...defaultActivityFilter, pms: false }))).toEqual([]);
});

it("discards unapplied changes when the filter is dismissed", async () => {
  state.personal.mockResolvedValue([personal]);
  state.schedule.mockResolvedValue({ results: [project] });
  await render();
  await filterAction("Filter");
  await toggleFilter("Personal");
  await act(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
  await filterAction("Filter");
  const personalCheckbox = Array.from(document.querySelectorAll("label"))
    .find((item) => item.textContent?.trim() === "Personal")
    ?.querySelector("input");
  expect(personalCheckbox?.checked).toBe(true);
  await filterAction("Apply");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
});

it("loads private and assigned tasks and opens their existing editors", async () => {
  state.personal.mockResolvedValue([personal]);
  state.schedule.mockResolvedValue({ results: [project] });
  await render();
  expect(host.textContent).not.toContain("No Activity Yet");
  expect(host.textContent).not.toContain("No schedule yet");
  expect(host.querySelector('[aria-label="Friday, 30 October 2026"]')?.textContent).toContain("Assigned task");
  await act(() => button("Assigned task")?.click());
  expect(state.peek).toHaveBeenCalledWith({ workspaceSlug: "team", projectId: "project", issueId: "assigned" });
  await act(() => button("Private task")?.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("Private task");
});

it("shows a previously undated personal task created today in Activity and the calendar", async () => {
  state.personal.mockResolvedValue([
    { ...personal, start_date: null, target_date: null, created_at: "2026-10-29T23:30:00Z" },
  ]);
  await render();
  expect(host.querySelector("table")?.textContent).toContain("Private task");
  expect(host.querySelector("table")?.textContent).toContain("Due 30 Oct");
  expect(host.querySelector('[aria-label="Friday, 30 October 2026"]')?.textContent).toContain("Private task");
  await act(() => button("Private task")?.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("Private task");
});

it("keeps explicitly future-dated personal tasks out of today's activity", async () => {
  state.personal.mockResolvedValue([{ ...personal, start_date: null, target_date: "2026-10-31" }]);
  await render();
  expect(host.querySelector("table")).toBeNull();
  expect(host.textContent).toContain("No Activity Yet");
  expect(host.querySelector('[aria-label="Saturday, 31 October 2026"]')?.textContent).toContain("Private task");
});

it("matches the activity table columns, project subtitles, assignee initials and date-only schedules", async () => {
  state.personal.mockResolvedValue([personal]);
  state.schedule.mockResolvedValue({ results: [project] });
  await render();
  const table = host.querySelector('table[aria-label="Today\'s activity tasks"]')!;
  expect(Array.from(table.querySelectorAll("th")).map((cell) => cell.textContent)).toEqual([
    "ACTIVITY",
    "ASSIGNED TO",
    "SOURCE",
    "TIME",
    "ACTIONS",
  ]);
  const rows = table.querySelectorAll("tbody tr");
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("Website Redesign");
  expect(rows[0].querySelector('[aria-label="Maya Patel"]')?.textContent).toBe("MP");
  expect(rows[0].querySelector('[aria-label="Alex Morgan"]')?.textContent).toBe("AM");
  expect(rows[0].textContent).toContain("PMS");
  expect(rows[0].querySelector("time")?.getAttribute("datetime")).toBe("2026-10-30");
  expect(rows[0].textContent).toContain("Due 30 Oct");
  expect(rows[0].textContent).not.toContain("09:30");
  expect(rows[1].textContent).toContain("Personal task");
  expect(rows[1].querySelector('[aria-label^="Edit assignees"]')).toBeNull();
  await act(() => rows[0].querySelector<HTMLButtonElement>('[aria-label="Edit assignees for Assigned task"]')?.click());
  expect(state.peek).toHaveBeenCalledWith({ workspaceSlug: "team", projectId: "project", issueId: "assigned" });
});

it("keeps the activity action menu functional and opens the original task detail panel", async () => {
  state.schedule.mockResolvedValue({ results: [{ ...project, assignee_ids: ["me", "alex", "third", "fourth"] }] });
  await render();
  expect(host.querySelector('[aria-label="2 more assignees"]')?.textContent).toBe("+2");
  await act(() => {
    host.querySelector<HTMLButtonElement>('[aria-label="Actions for Assigned task"]')?.click();
  });
  const open = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) =>
    item.textContent?.includes("Edit")
  );
  expect(Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())).toEqual([
    "Edit",
    "Share",
    "Delete",
  ]);
  expect(open).toBeDefined();
  await act(() => open?.click());
  expect(state.peek).toHaveBeenCalledWith({ workspaceSlug: "team", projectId: "project", issueId: "assigned" });
});

it("disables project deletion for a non-creator without project admin permissions", async () => {
  state.canCreate = false;
  state.schedule.mockResolvedValue({ results: [{ ...project, created_by: "someone-else" }] });
  await render();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Actions for Assigned task"]')?.click());
  const remove = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === "Delete"
  );
  expect(remove?.getAttribute("aria-disabled")).toBe("true");
});

it("navigates periods, resets Today and switches to a full month grid", async () => {
  await render();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Next period"]')?.click());
  expect(state.schedule).toHaveBeenCalledWith("team", "2026-11-02", "2026-11-08");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Previous period"]')?.click());
  expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe("October 2026");
  await act(() => button("Month")?.click());
  expect(host.textContent).toContain("October 2026");
  expect(state.schedule).toHaveBeenCalledWith("team", "2026-09-28", "2026-11-01");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Next period"]')?.click());
  expect(host.textContent).toContain("November 2026");
  await act(() =>
    Array.from(host.querySelectorAll("button"))
      .find((item) => item.textContent === "Today")
      ?.click()
  );
  expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe("30 October 2026");
  expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe("Day");
});

it.each(["Week", "Month"])(
  "Today switches %s view to today's tasks even when already in the current period",
  async (view) => {
    state.personal.mockResolvedValue([
      { ...personal, name: "Today only", start_date: null, target_date: "2026-10-30" },
      { ...personal, id: "tomorrow", name: "Tomorrow only", start_date: null, target_date: "2026-10-31" },
    ]);
    await render();
    await act(() => button(view)?.click());
    await act(() =>
      Array.from(host.querySelectorAll("button"))
        .find((item) => item.textContent === "Today")
        ?.click()
    );
    const calendar = host.querySelector('[aria-labelledby="activity-calendar-title"]')!;
    expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe("Day");
    expect(calendar.querySelectorAll('[aria-label="Friday, 30 October 2026"]')).toHaveLength(1);
    expect(calendar.querySelector('[aria-label="Saturday, 31 October 2026"]')).toBeNull();
    expect(calendar.textContent).toContain("Today only");
    expect(calendar.textContent).not.toContain("Tomorrow only");
    expect(state.schedule).toHaveBeenCalledWith("team", "2026-10-30", "2026-10-30");
  }
);

it("shows errors with retry rather than success-shaped empty states", async () => {
  state.schedule.mockRejectedValue(new Error("Unavailable"));
  await render();
  expect(host.querySelectorAll('[role="alert"]')).toHaveLength(2);
  expect(host.textContent).not.toContain("No Activity Yet");
  expect(host.textContent).not.toContain("No schedule yet");
  state.schedule.mockResolvedValue({ results: [] });
  await act(() => button("Retry")?.click());
  expect(host.textContent).toContain("No Activity Yet");
});

it("does not fetch private tasks or offer creation to guests", async () => {
  state.canCreate = false;
  await render();
  expect(state.personal).not.toHaveBeenCalled();
  expect(button("Add task")).toBeUndefined();
  expect(button("New task")).toBeUndefined();
  expect(host.textContent).toContain("No Activity Yet");
});

it("shows a loading state instead of claiming there are no tasks", async () => {
  state.schedule.mockReturnValue(new Promise(() => {}));
  await render();
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(2);
  expect(host.textContent).not.toContain("No Activity Yet");
});

it("uses Monday-first calendar days across month and year boundaries", () => {
  expect(calendarDays(new Date(2027, 0, 1), "day").map(dateKey)).toEqual(["2027-01-01"]);
  const days = calendarDays(new Date(2027, 0, 1), "week");
  expect(days).toHaveLength(7);
  expect(dateKey(days[0])).toBe("2026-12-28");
  expect(dateKey(days[6])).toBe("2027-01-03");
  expect(calendarDays(new Date(2026, 10, 1), "month")).toHaveLength(42);
});

it("navigates day view one date at a time and returns to today", async () => {
  await render();
  await act(() => button("Day")?.click());
  expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe("Day");
  expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe("30 October 2026");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Next period"]')?.click());
  expect(state.schedule).toHaveBeenCalledWith("team", "2026-10-31", "2026-10-31");
  await act(() => button("Today")?.click());
  expect(host.querySelector('[aria-live="polite"]')?.textContent).toBe("30 October 2026");
  expect(button("New task")).toBeDefined();
});

it("collapses crowded calendar days with a working more/fewer control", async () => {
  state.schedule.mockResolvedValue({
    results: [
      project,
      { ...project, id: "two", name: "Second" },
      { ...project, id: "three", name: "Third" },
      { ...project, id: "four", name: "Fourth" },
    ],
  });
  await render();
  const day = host.querySelector('[aria-label="Friday, 30 October 2026"]')!;
  expect(day.querySelectorAll("button[title]")).toHaveLength(2);
  expect(day.textContent).toContain("+2 more");
  await act(() => day.querySelector<HTMLButtonElement>('[aria-expanded="false"]')?.click());
  expect(day.querySelectorAll("button[title]")).toHaveLength(4);
  await act(() => day.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.click());
  expect(day.querySelectorAll("button[title]")).toHaveLength(2);
});

it("handles spanning, undated and completed tasks using the user's timezone", () => {
  const [task] = overviewTasks([personal], []);
  expect(taskOnDate(task, "2026-10-30")).toBe(true);
  expect(taskOnDate(task, "2026-11-01")).toBe(false);
  expect(taskActiveToday(task, "2026-10-30")).toBe(true);
  const [undated] = overviewTasks([{ ...personal, start_date: null, target_date: null }], []);
  expect(taskActiveToday(undated, "2026-10-30")).toBe(false);
  expect(taskOnDate(undated, "2026-10-29")).toBe(true);
  const [localUndated] = overviewTasks(
    [{ ...personal, start_date: null, target_date: null, created_at: "2026-10-29T23:30:00Z" }],
    [],
    "Asia/Kolkata"
  );
  expect(taskActiveToday(localUndated, "2026-10-30", "Asia/Kolkata")).toBe(true);
  expect(localUndated.personal?.target_date).toBeNull();
  const [done] = overviewTasks([{ ...personal, completed_at: "2026-10-29T23:30:00Z" }], []);
  expect(taskActiveToday(done, "2026-10-30", "Asia/Kolkata")).toBe(true);
  expect(taskActiveToday(done, "2026-10-30", "America/New_York")).toBe(false);
  expect(zonedDateKey(new Date("2026-12-31T23:00:00Z"), "Asia/Kolkata")).toBe("2027-01-01");
});
