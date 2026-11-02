import { expect, it } from "vitest";
import { EMPTY_FILTERS, addDays, filterCount, matchesTaskFilters, toggleValue } from "./my-tasks-filters.helpers";
import type { TTaskFilters } from "./my-tasks-filters.helpers";
import type { TaskRow } from "./my-tasks-board.helpers";

const TODAY = "2026-10-31";
const row = (name: string, due: string | null, extra: Partial<TaskRow> = {}) =>
  ({ key: name, name, due, completed: false, project: { project_id: "web" }, ...extra }) as TaskRow;
const rows = [
  row("late", "2026-10-30"),
  row("late done", "2026-10-29", { completed: true }),
  row("today", TODAY),
  row("soon", "2026-11-07"),
  row("later", "2026-11-08"),
  row("undated", null),
];
const names = (filters: Partial<TTaskFilters>) =>
  rows.filter((item) => matchesTaskFilters(item, { ...EMPTY_FILTERS, ...filters }, TODAY)).map((item) => item.name);

it("matches due date options and combines selected ones", () => {
  expect(names({})).toHaveLength(rows.length);
  expect(names({ due: ["overdue"] })).toEqual(["late"]);
  expect(names({ due: ["today"] })).toEqual(["today"]);
  expect(names({ due: ["week"] })).toEqual(["soon"]);
  expect(names({ due: ["none"] })).toEqual(["undated"]);
  expect(names({ due: ["overdue", "none"] })).toEqual(["late", "undated"]);
  expect(names({ due: ["custom"], from: "2026-10-30", to: "2026-11-07" })).toEqual(["late", "today", "soon"]);
  expect(names({ due: ["custom"], from: "2026-11-01" })).toEqual(["soon", "later"]);
});

it("combines groups and counts selected options", () => {
  const personal = row("mine", null, { project: undefined, personal: {} as TaskRow["personal"] } as Partial<TaskRow>);
  const filters = { ...EMPTY_FILTERS, accounts: ["company"], statuses: ["completed"] };
  expect(matchesTaskFilters(rows[1], filters, TODAY)).toBe(true);
  expect(matchesTaskFilters(rows[0], filters, TODAY)).toBe(false);
  expect(matchesTaskFilters(personal, { ...EMPTY_FILTERS, projects: ["web"] }, TODAY)).toBe(false);
  expect(matchesTaskFilters(personal, { ...EMPTY_FILTERS, accounts: ["personal"] }, TODAY)).toBe(true);
  expect(filterCount({ ...filters, due: ["today"], projects: ["web"] })).toBe(4);
  expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
  expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
});
