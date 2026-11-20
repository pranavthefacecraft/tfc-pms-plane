import { describe, expect, it } from "vitest";
import { sortTasks } from "./task-sort";
import type { TaskSortOrder } from "./task-sort";

const tasks = [
  { name: "Undated", due: null, completed: false },
  { name: "Due today", due: "2026-11-20", completed: false },
  { name: "Overdue", due: "2026-11-19", completed: false },
  { name: "Completed", due: "2026-11-17", completed: true },
  { name: "Most overdue", due: "2026-11-18", completed: false },
];

describe("task due-date sorting", () => {
  it.each<{ order: TaskSortOrder; expected: string[] }>([
    { order: "due-asc", expected: ["Completed", "Most overdue", "Overdue", "Due today", "Undated"] },
    { order: "due-desc", expected: ["Due today", "Overdue", "Most overdue", "Completed", "Undated"] },
    { order: "expired", expected: ["Most overdue", "Overdue", "Undated", "Due today", "Completed"] },
  ])("orders rows with $order without removing any tasks", ({ order, expected }) => {
    expect(sortTasks(tasks, order, "2026-11-20", (task) => task).map((task) => task.name)).toEqual(expected);
  });
});
