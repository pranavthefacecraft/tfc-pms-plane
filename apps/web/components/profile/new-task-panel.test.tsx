import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NewTaskPanel } from "./new-task-panel";

const state = vi.hoisted(() => ({
  create: vi.fn(),
  issue: vi.fn(),
  states: vi.fn(),
  fields: vi.fn(),
  setField: vi.fn(),
  relation: vi.fn(),
  upload: vi.fn(),
  toast: vi.fn(),
  close: vi.fn(),
  saved: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    joinedProjectIds: ["project", "other"],
    getProjectById: (id: string) => ({ id, name: id === "project" ? "Marketing" : "Other", archived_at: null }),
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ fetchProjectStates: state.states, getProjectDefaultStateId: () => "todo" }),
}));
vi.mock("@/services/personal-task.service", () => ({ personalTaskService: { create: state.create } }));
vi.mock("@/services/issue/issue.service", () => ({
  IssueService: class {
    createIssue = state.issue;
    createIssueRelation = state.relation;
  },
}));
vi.mock("@/services/issue/issue_attachment.service", () => ({
  IssueAttachmentService: class {
    uploadIssueAttachment = state.upload;
  },
}));
vi.mock("@/components/projects/custom-fields/service", () => ({
  customFields: { list: state.fields, setValue: state.setField },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: ({
    value,
    onChange,
    disabled,
  }: {
    value: string[];
    onChange: (ids: string[]) => void;
    disabled: boolean;
  }) => (
    <select
      aria-label="Assigned to"
      disabled={disabled}
      value={value[0] ?? ""}
      onChange={(event) => onChange([event.target.value])}
    >
      <option value="">Choose teammate</option>
      <option value="teammate">Alex</option>
    </select>
  ),
}));
vi.mock("@/components/core/modals/existing-issues-list-modal", () => ({
  ExistingIssuesListModal: ({
    handleOnSubmit,
  }: {
    handleOnSubmit: (tasks: { id: string; name: string }[]) => Promise<void>;
  }) => (
    <button type="button" onClick={() => void handleOnSubmit([{ id: "dependency", name: "Write copy" }])}>
      Choose dependency
    </button>
  ),
}));
vi.mock("@/components/common/task-form-content", () => ({
  TaskFormContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.create.mockResolvedValue({ id: "private", name: "My task" });
  state.issue.mockResolvedValue({ id: "issue", name: "My task" });
  state.setField.mockResolvedValue({});
  state.relation.mockResolvedValue({});
  state.upload.mockResolvedValue({});
  state.states.mockResolvedValue([
    { id: "todo", name: "To do" },
    { id: "doing", name: "In progress" },
  ]);
  state.fields.mockResolvedValue([
    { id: "status", name: "Status", field_type: "single_select", options: [{ id: "approved", name: "Approved" }] },
  ]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) => Array.from(host.querySelectorAll("button")).find((item) => item.textContent === text)!;
async function render() {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <NewTaskPanel workspaceSlug="team" onClose={state.close} onSaved={state.saved} />
      </SWRConfig>
    )
  );
}
async function change(label: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
  await act(() => {
    const prototype = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function save() {
  await act(() => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

it("matches the field list and keeps project-only actions disabled for private tasks", async () => {
  await render();
  for (const field of [
    "New Task",
    "Assigned to",
    "Due date",
    "Link to Project",
    "Dependencies",
    "Priority",
    "Stage",
    "Status",
    "Attach File",
    "Description",
    "Subtasks",
  ])
    expect(host.textContent).toContain(field);
  expect(button("Add dependencies").disabled).toBe(true);
  expect(button("+ Add subtask").disabled).toBe(true);
  expect(host.querySelector<HTMLInputElement>('[type="file"]')?.disabled).toBe(true);
  expect(button("Save").disabled).toBe(true);
  expect(state.fields).not.toHaveBeenCalled();
  expect(state.states).not.toHaveBeenCalled();
  await change("Task name", "My task");
  await save();
  expect(state.create).toHaveBeenCalledWith("team", {
    name: "My task",
    description: "",
    priority: "medium",
    start_date: null,
    target_date: null,
  });
  expect(state.issue).not.toHaveBeenCalled();
  expect(state.saved).toHaveBeenCalledWith(expect.objectContaining({ id: "private" }));
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({ type: "success", message: expect.stringContaining("Personal tasks") })
  );
});

it("enables real project fields without losing task content when choosing a project", async () => {
  await render();
  await change("Task name", "Keep title");
  await change("Link to Project", "project");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Task name"]')?.value).toBe("Keep title");
  expect(button("Add dependencies").disabled).toBe(false);
  expect(button("+ Add subtask").disabled).toBe(false);
  expect(host.querySelector<HTMLInputElement>('[type="file"]')?.disabled).toBe(false);
  await change("Assigned to", "teammate");
  await change("Stage", "doing");
  await change("Status", "approved");
  await act(() => button("+ Add subtask").click());
  expect(host.querySelector('[aria-label="Subtask 1"]')).not.toBeNull();
  await act(() => button("Add dependencies").click());
  await act(() => button("Choose dependency").click());
  expect(host.textContent).toContain("Write copy");
});

it("resets project-specific selections when returning to a private task", async () => {
  await render();
  await change("Link to Project", "project");
  await act(() => button("+ Add subtask").click());
  await change("Task name", "Private again");
  await change("Link to Project", "");
  expect(host.querySelector('[aria-label="Subtask 1"]')).toBeNull();
  await save();
  expect(state.create).toHaveBeenCalledWith("team", expect.objectContaining({ name: "Private again" }));
  expect(state.issue).not.toHaveBeenCalled();
});

it("saves selected project assignees, dates, priority, workflow and status", async () => {
  await render();
  await change("Task name", "Project task");
  await change("Due date", "2026-11-02");
  await change("Link to Project", "project");
  await change("Assigned to", "teammate");
  await change("Stage", "doing");
  await change("Status", "approved");
  await change("Priority", "high");
  await save();
  expect(state.create).not.toHaveBeenCalled();
  expect(state.issue).toHaveBeenCalledWith(
    "team",
    "project",
    expect.objectContaining({
      name: "Project task",
      target_date: "2026-11-02",
      priority: "high",
      state_id: "doing",
      assignee_ids: ["teammate"],
    })
  );
  expect(state.setField).toHaveBeenCalledWith("team", "project", "issue", "status", "approved");
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({ type: "success", message: expect.stringContaining("Marketing") })
  );
});

it("uses existing Stage custom options rather than hardcoding workflow labels", async () => {
  state.fields.mockResolvedValue([
    { id: "stage", name: "Stage", field_type: "single_select", options: [{ id: "copy", name: "Copy" }] },
  ]);
  await render();
  await change("Link to Project", "project");
  await change("Task name", "Copy task");
  await change("Stage", "copy");
  await save();
  expect(state.setField).toHaveBeenCalledWith("team", "project", "issue", "stage", "copy");
});

it("reports partial saves and retries only unfinished details", async () => {
  state.setField.mockRejectedValueOnce(new Error("offline"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await render();
  await change("Task name", "Project task");
  await change("Link to Project", "project");
  await change("Status", "approved");
  await save();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("The task was created");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Task name"]')?.disabled).toBe(true);
  expect(state.close).not.toHaveBeenCalled();
  await save();
  expect(state.issue).toHaveBeenCalledTimes(1);
  expect(state.setField).toHaveBeenCalledTimes(2);
  expect(state.close).toHaveBeenCalledOnce();
  log.mockRestore();
});

it("retains draft values and does not report success when saving fails", async () => {
  state.create.mockRejectedValue({ name: ["Invalid task"] });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await render();
  await change("Task name", "Keep me");
  await save();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Invalid task");
  expect(state.close).not.toHaveBeenCalled();
  expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  log.mockRestore();
});

it("surfaces metadata failures and disables Save until retry succeeds", async () => {
  state.fields.mockRejectedValue(new Error("offline"));
  await render();
  await change("Task name", "Not yet");
  await change("Link to Project", "project");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
  expect(button("Save").disabled).toBe(true);
  state.fields.mockResolvedValue([]);
  await act(() => button("Retry").click());
  expect(button("Save").disabled).toBe(false);
  expect(host.textContent).toContain("No Status field is configured");
});

it("blocks duplicate submissions and panel dismissal while a task save is pending", async () => {
  let resolve!: (value: { id: string; name: string }) => void;
  state.create.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await render();
  await change("Task name", "One task");
  await save();
  await save();
  expect(state.create).toHaveBeenCalledTimes(1);
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Close task panel"]')?.disabled).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  expect(state.toast).not.toHaveBeenCalled();
  await act(() => resolve({ id: "saved", name: "One task" }));
  expect(state.close).toHaveBeenCalledOnce();
});

it("queues files before saving and allows removing them without uploading", async () => {
  await render();
  await change("Link to Project", "project");
  const file = new File(["brief"], "brief.txt", { type: "text/plain" });
  const input = host.querySelector<HTMLInputElement>('[type="file"]')!;
  await act(() => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.textContent).toContain("brief.txt");
  expect(state.upload).not.toHaveBeenCalled();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Remove file brief.txt"]')?.click());
  expect(host.textContent).not.toContain("brief.txt");
});

it("rejects invalid implicit submissions before creating any task", async () => {
  await render();
  await change("Task name", "   ");
  await save();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Enter a task name.");
  expect(state.create).not.toHaveBeenCalled();
  await change("Task name", "Parent");
  await change("Link to Project", "project");
  await act(() => button("+ Add subtask").click());
  await save();
  expect(state.issue).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Enter a name for every subtask.");
});
