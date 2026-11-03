/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TProjectListTask, TProjectTaskList } from "@/services/project/project-task-list.service";
import { ProjectTimeline, projectTimelineRows } from "./project-timeline";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  patchIssue: vi.fn(),
  timeline: undefined as Record<string, unknown> | undefined,
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
vi.mock("@/components/profile/my-tasks-timeline", () => ({
  MyTasksTimeline: (props: { rows: { key: string; name: string }[]; onOpen: (row: unknown) => void }) => {
    mocks.timeline = props;
    return (
      <ul aria-label="Timeline rows">
        {props.rows.map(
          (row): ReactNode => (
            <li key={row.key}>
              <button type="button" onClick={() => props.onOpen(row)}>
                {row.name}
              </button>
            </li>
          )
        )}
      </ul>
    );
  },
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

describe("projectTimelineRows", () => {
  it("maps grouped tasks to timeline rows with the project key, dates and colour", () => {
    const rows = projectTimelineRows([{ key: "s1", sectionId: "s1", name: "To Do", tasks: TASKS }], "p1", "WEB");
    expect(
      rows.map(({ key, due, completed, project }) => [
        key,
        due,
        completed,
        project.start_date,
        `${project.project_identifier}-${project.sequence_id}`,
        project.state_color,
      ])
    ).toEqual([
      ["t1", "2026-11-04", false, "2026-11-02", "WEB-1", "#00845C"],
      ["t2", "2026-11-10", true, null, "WEB-1", "#94A3B8"],
      ["t3", null, false, null, "WEB-1", "#00845C"],
    ]);
  });
});

describe("ProjectTimeline", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEdit = true;
    mocks.timeline = undefined;
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
    [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label) as HTMLButtonElement;
  type TTimelineProps = {
    rows: { key: string; task: TProjectListTask }[];
    canEdit: (row: unknown) => boolean;
    onReschedule: (row: unknown, dates: object) => Promise<void>;
  };

  it("shows the List/Board toolbar above the task timeline and opens tasks", async () => {
    await render();
    expect(button("Add task")).toBeDefined();
    expect(button("Filter")).toBeDefined();
    expect([...host.querySelectorAll('[aria-label="Timeline rows"] li')].map((item) => item.textContent)).toEqual([
      "Wireframes",
      "Launch",
      "Someday",
    ]);
    await act(async () => button("Wireframes").click());
    expect(mocks.setPeekIssue).toHaveBeenCalledWith({ workspaceSlug: "acme", projectId: "p1", issueId: "t1" });
    await act(async () => button("Add task").click());
    expect(JSON.parse(host.querySelector('[data-testid="create-modal"]')!.textContent!)).toEqual({ project_id: "p1" });
  });

  it("saves dragged dates to the task", async () => {
    await render();
    const props = mocks.timeline as unknown as TTimelineProps;
    expect(props.canEdit(props.rows[0])).toBe(true);
    await act(() => props.onReschedule(props.rows[0], { start_date: "2026-11-05", target_date: "2026-11-09" }));
    expect(mocks.patchIssue).toHaveBeenCalledWith("acme", "p1", "t1", {
      start_date: "2026-11-05",
      target_date: "2026-11-09",
    });
  });

  it("is read-only for guests", async () => {
    mocks.canEdit = false;
    await render();
    const props = mocks.timeline as unknown as TTimelineProps;
    expect(button("Add task")).toBeUndefined();
    expect(props.canEdit(props.rows[0])).toBe(false);
  });
});
