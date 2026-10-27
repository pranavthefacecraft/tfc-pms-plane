import { expect, it, vi } from "vitest";
import { createIssuePayload } from "@plane/utils";
import {
  EIssueGroupByToServerOptions,
  DRAG_ALLOWED_GROUPS,
  EServerGroupByToFilterOptions,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
} from "@plane/constants";
import { getGroupByColumns, handleGroupDragDrop } from "@/components/issues/issue-layouts/utils";
import { getSectionQuickAddData } from "@/components/issues/issue-layouts/quick-add/utils";

const state = vi.hoisted(() => ({
  sections: [
    { id: "design", name: "Design", sort_order: 10000, icon: "palette", icon_color: "#ff0088" },
    { id: "dev", name: "Development", sort_order: 20000 },
  ],
}));
vi.mock("@/lib/store-context", () => ({
  store: {
    router: { workspaceSlug: "workspace", projectId: "project" },
    section: { getSections: () => state.sections },
  },
}));
vi.mock("@/components/issues/issue-layouts/spreadsheet/columns", () =>
  Object.fromEntries(
    [
      "SpreadsheetAssigneeColumn",
      "SpreadsheetAttachmentColumn",
      "SpreadsheetCreatedOnColumn",
      "SpreadsheetDueDateColumn",
      "SpreadsheetEstimateColumn",
      "SpreadsheetLabelColumn",
      "SpreadsheetModuleColumn",
      "SpreadsheetCycleColumn",
      "SpreadsheetLinkColumn",
      "SpreadsheetPriorityColumn",
      "SpreadsheetStartDateColumn",
      "SpreadsheetStateColumn",
      "SpreadsheetSubIssueColumn",
      "SpreadsheetUpdatedOnColumn",
    ].map((name) => [name, () => null])
  )
);
vi.mock("@/store/issue/issue-details/sub_issues_filter.store", () => ({ DEFAULT_DISPLAY_PROPERTIES: {} }));
vi.mock("@/store/issue/helpers/base-issues.store", () => ({
  ISSUE_FILTER_DEFAULT_DATA: { section: "section_id", state: "state_id" },
}));

it("renders independent sections and a separate Untitled section column", () => {
  const columns = getGroupByColumns({ groupBy: "section", includeNone: true, isWorkspaceLevel: false });
  expect(columns?.map(({ id, name, payload }) => ({ id, name, payload }))).toEqual([
    { id: "design", name: "Design", payload: { section_id: "design" } },
    { id: "dev", name: "Development", payload: { section_id: "dev" } },
    { id: "None", name: "Untitled section", payload: { section_id: null } },
  ]);
  expect(columns?.[0].icon).toHaveProperty("props.section.icon", "palette");
  expect(columns?.[0].icon).toHaveProperty("props.section.icon_color", "#ff0088");
});
it.each([
  ["dev", "dev"],
  ["None", null],
])("dragging to %s changes section without changing status", async (destinationId, expected) => {
  const issue = createIssuePayload("project", { id: "task", state_id: "completed-state", section_id: "design" });
  const update = vi.fn();
  await handleGroupDragDrop(
    { id: "task", columnId: "design", groupId: "design" },
    { id: undefined, columnId: destinationId!, groupId: destinationId! },
    () => issue,
    () => [],
    update,
    "section",
    null
  );
  expect(update).toHaveBeenCalledWith(
    "project",
    "task",
    expect.objectContaining({ section_id: expected }),
    expect.anything()
  );
  expect(update.mock.calls[0][2]).not.toHaveProperty("state_id");
  expect(issue.state_id).toBe("completed-state");
});
it("maps section grouping and group pagination to the backend field", () => {
  expect(EIssueGroupByToServerOptions.section).toBe("section_id");
  expect(EServerGroupByToFilterOptions.section_id).toBe("section");
  expect(DRAG_ALLOWED_GROUPS).toContain("section");
  for (const layout of ["list", "kanban"] as const) {
    expect(ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.layoutOptions[layout].display_filters.group_by).toContain("section");
  }
});
it.each([
  ["None", null],
  ["54cfe4be-0f96-426d-9d8b-81b2512b4916", "54cfe4be-0f96-426d-9d8b-81b2512b4916"],
] as const)("quick-add maps section %s to a valid assignment without changing status", (groupId, sectionId) => {
  const data = getSectionQuickAddData(groupId);
  expect(data).toEqual({ section_id: sectionId });
  expect(data).not.toHaveProperty("section");
  expect(createIssuePayload("project", { state_id: "backlog", ...data })).toMatchObject({
    section_id: sectionId,
    state_id: "backlog",
  });
});
