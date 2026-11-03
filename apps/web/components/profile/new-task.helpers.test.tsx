import { beforeEach, expect, it, vi } from "vitest";
import type { TNewTaskDraft, TTaskSaveProgress } from "./new-task.helpers";
import { newTaskError, saveProjectTask, taskDescriptionHTML } from "./new-task.helpers";

const state = vi.hoisted(() => ({ create: vi.fn(), relation: vi.fn(), upload: vi.fn(), field: vi.fn() }));
vi.mock("@/services/issue/issue.service", () => ({
  IssueService: class {
    createIssue = state.create;
    createIssueRelation = state.relation;
  },
}));
vi.mock("@/services/issue/issue_attachment.service", () => ({
  IssueAttachmentService: class {
    uploadIssueAttachment = state.upload;
  },
}));
vi.mock("@/components/projects/custom-fields/service", () => ({ customFields: { setValue: state.field } }));

const draft = (): TNewTaskDraft => ({
  name: "  Ship it  ",
  description: "<script>unsafe</script>\nDetails",
  priority: "medium",
  start_date: "2026-10-30",
  target_date: "2026-11-02",
  projectId: "project",
  assignees: ["teammate"],
  stateId: "todo",
  fieldValues: { stage: "copy", status: "review" },
  dependencies: [{ id: "dependency", name: "Blocked by this" }],
  files: [new File(["test"], "brief.txt")],
  subtasks: [{ id: "draft-subtask", name: "  Check it  " }],
});
beforeEach(() => {
  vi.resetAllMocks();
  state.create.mockResolvedValue({ id: "parent", name: "Ship it" });
  state.relation.mockResolvedValue({});
  state.upload.mockResolvedValue({});
  state.field.mockResolvedValue({});
});

it("saves project properties, custom choices, dependencies, files and parent-linked subtasks", async () => {
  const data = draft();
  await saveProjectTask("team", data, { completed: new Set() });
  expect(state.create).toHaveBeenNthCalledWith(1, "team", "project", {
    project_id: "project",
    name: "Ship it",
    priority: "medium",
    start_date: "2026-10-30",
    target_date: "2026-11-02",
    assignee_ids: ["teammate"],
    state_id: "todo",
    description_html: "<p>&lt;script&gt;unsafe&lt;/script&gt;<br>Details</p>",
  });
  expect(state.field).toHaveBeenCalledWith("team", "project", "parent", "status", "review");
  expect(state.relation).toHaveBeenCalledWith("team", "project", "parent", {
    related_list: [{ relation_type: "blocked_by", related_issue: "dependency" }],
  });
  expect(state.upload).toHaveBeenCalledWith("team", "project", "parent", data.files[0]);
  expect(state.create).toHaveBeenNthCalledWith(2, "team", "project", {
    name: "Check it",
    parent_id: "parent",
    assignee_ids: ["teammate"],
    priority: "medium",
    state_id: "todo",
  });
});

it("retains confirmed progress and retries failed details without recreating the parent or completed steps", async () => {
  const progress: TTaskSaveProgress = { completed: new Set() };
  state.upload.mockRejectedValueOnce(new Error("offline"));
  await expect(saveProjectTask("team", draft(), progress)).rejects.toThrow("offline");
  expect(progress.issue?.id).toBe("parent");
  expect(state.create).toHaveBeenCalledTimes(2);
  await saveProjectTask("team", draft(), progress);
  expect(state.create).toHaveBeenCalledTimes(2);
  expect(state.relation).toHaveBeenCalledTimes(1);
  expect(state.field).toHaveBeenCalledTimes(2);
  expect(state.upload).toHaveBeenCalledTimes(2);
});

it("does not checkpoint a failed parent creation", async () => {
  const progress: TTaskSaveProgress = { completed: new Set() };
  state.create.mockRejectedValueOnce(new Error("permission denied"));
  await expect(saveProjectTask("team", draft(), progress)).rejects.toThrow("permission denied");
  expect(progress.issue).toBeUndefined();
  expect(state.field).not.toHaveBeenCalled();
});

it("creates through a layout store action and keeps the chosen section", async () => {
  const create = vi.fn().mockResolvedValue({ id: "parent", name: "Ship it" });
  await saveProjectTask(
    "team",
    { ...draft(), sectionId: null, dependencies: [], files: [], subtasks: [], fieldValues: {} },
    { completed: new Set() },
    create
  );
  expect(create).toHaveBeenCalledWith("project", expect.objectContaining({ project_id: "project", section_id: null }));
  expect(state.create).not.toHaveBeenCalled();
});

it("escapes description HTML rather than interpreting user input", () => {
  expect(taskDescriptionHTML('Hello <img src=x onerror="bad">')).toContain("&lt;img");
});

it("always provides an error message even when the API returns an empty body", () => {
  expect(newTaskError({})).toContain("Could not finish saving");
  expect(newTaskError({ name: ["This field is required."] })).toBe("name: This field is required.");
});
