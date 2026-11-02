import { expect, it } from "vitest";
import { boardColumn, sectionColumn } from "./my-tasks-board.helpers";
import type { TaskRow } from "./my-tasks-board.helpers";
import type { TMyTaskListItem } from "@/services/workspace-my-tasks.service";

const project = (overrides: Partial<TMyTaskListItem>): TaskRow => {
  const task = {
    id: "task",
    name: "Task",
    state_group: "unstarted",
    section_name: null,
    ...overrides,
  } as TMyTaskListItem;
  return { key: task.id, name: task.name, due: null, completed: task.state_group === "completed", project: task };
};

it("maps section names to board columns", () => {
  expect(sectionColumn("To Do")).toBe("todo");
  expect(sectionColumn("todo")).toBe("todo");
  expect(sectionColumn("In Progress")).toBe("progress");
  expect(sectionColumn("Waiting for review")).toBe("review");
  expect(sectionColumn("In Review")).toBe("review");
  expect(sectionColumn("Done")).toBe("done");
  expect(sectionColumn("Untitled section")).toBeNull();
  expect(sectionColumn(null)).toBeNull();
});

it("places completed tasks in Done and otherwise prefers sections over state groups", () => {
  expect(boardColumn(project({ state_group: "completed", section_name: "In Progress" }))).toBe("done");
  expect(boardColumn(project({ section_name: "Waiting for review" }))).toBe("review");
  expect(boardColumn(project({ state_group: "started", section_name: "Untitled section" }))).toBe("progress");
  expect(boardColumn(project({ section_name: "Done" }))).toBe("todo");
  expect(boardColumn(project({ state_group: "cancelled" }))).toBeNull();
});
