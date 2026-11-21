import { act, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NewTaskPanel } from "./new-task-panel";
import { EditTaskPanel } from "@/components/issues/issue-modal/edit-task-panel";
import { IssueAssignmentAndDueDate } from "@/components/issues/issue-detail/summary-properties";
import type { TNewTaskDraft } from "./new-task.helpers";

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
  invite: vi.fn(),
  pickerClose: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  removeRelation: vi.fn(),
  refresh: vi.fn(),
  fetchIssue: vi.fn(),
  fetchMembers: vi.fn(),
  role: 20,
}));
vi.mock("@/hooks/use-issues-actions", () => ({ useIssuesActions: () => ({ updateIssue: state.update }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: { getIssueById: () => ({ assignee_ids: ["teammate"] }), fetchIssue: state.fetchIssue },
    fetchRelations: state.refresh,
    fetchAttachments: state.refresh,
    fetchSubIssues: state.refresh,
    fetchActivities: state.refresh,
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ project: { fetchProjectMembers: state.fetchMembers } }),
}));
vi.mock("@/components/issues/issue-detail/relation-select", () => ({ IssueRelationSelect: () => null }));
vi.mock("@/hooks/store/use-editor-asset", () => ({ useEditorAsset: () => ({}) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "team" }) }),
}));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: ({ initialValue }: { initialValue: string }) => <div data-description={initialValue} />,
}));
vi.mock("@/services/issue/issue_relation.service", () => ({
  IssueRelationService: class {
    listIssueRelations = async () => ({ blocked_by: [{ id: "previous", name: "Previous dependency" }] });
    deleteIssueRelation = state.removeRelation;
  },
}));
vi.mock("@plane/blocks/select", () => ({ useSelectContext: () => ({ close: state.pickerClose }) }));
vi.mock("@/services/project-collaborators.service", () => ({
  ProjectCollaboratorsService: class {
    invite = state.invite;
  },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/user", () => ({
  useUserProfile: () => ({ data: { start_of_the_week: 1 } }),
  useUserPermissions: () => ({
    getProjectRoleByWorkspaceSlugAndProjectId: () => state.role,
    getWorkspaceRoleByWorkspaceSlug: () => state.role,
  }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: { is_smtp_configured: true } }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    joinedProjectIds: ["project", "other"],
    getProjectById: (id: string) => ({ id, name: id === "project" ? "Marketing" : "Other", archived_at: null }),
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    fetchProjectStates: state.states,
    getProjectDefaultStateId: () => "todo",
    getStateById: () => undefined,
  }),
}));
vi.mock("@/services/personal-task.service", () => ({ personalTaskService: { create: state.create } }));
vi.mock("@/services/issue/issue.service", () => ({
  IssueService: class {
    createIssue = state.issue;
    createIssueRelation = state.relation;
    retrieve = state.retrieve;
    subIssues = async () => ({ sub_issues: [{ id: "child", name: "Existing subtask" }] });
  },
}));
vi.mock("@/services/issue/issue_attachment.service", () => ({
  IssueAttachmentService: class {
    uploadIssueAttachment = state.upload;
    getIssueAttachments = async () => [{ id: "asset", attributes: { name: "brief.pdf" } }];
  },
}));
vi.mock("@/components/projects/custom-fields/service", () => ({
  customFields: { list: state.fields, setValue: state.setField, values: async () => ({ status: "approved" }) },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: ({
    value,
    onChange,
    disabled,
    emptyMessage,
    footer,
  }: {
    value: string[];
    onChange: (ids: string[]) => void;
    disabled: boolean;
    emptyMessage?: (query: string) => ReactNode;
    footer?: ReactNode;
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <select
          aria-label="Assigned to"
          disabled={disabled}
          value={value[0] ?? ""}
          onChange={(event) => onChange([event.target.value])}
        >
          <option value="">Choose teammate</option>
          <option value="teammate">Alex</option>
        </select>
        {emptyMessage?.("new@example.com")}
        <button type="button" disabled={disabled} onClick={() => setOpen(true)}>
          Open assignee dropdown
        </button>
        {open && footer}
      </>
    );
  },
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
vi.mock("@/components/common/task-form-content", async () => {
  const { Dialog } = await import("@base-ui/react/dialog");
  return {
    TaskFormContent: ({ children }: { children: ReactNode }) => (
      <Dialog.Portal container={host}>
        <Dialog.Popup>{children}</Dialog.Popup>
      </Dialog.Portal>
    ),
  };
});

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.resetAllMocks();
  state.role = 20;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.create.mockResolvedValue({ id: "private", name: "My task" });
  state.issue.mockResolvedValue({ id: "issue", name: "My task" });
  state.setField.mockResolvedValue({});
  state.relation.mockResolvedValue({});
  state.upload.mockResolvedValue({});
  state.update.mockResolvedValue(undefined);
  state.refresh.mockResolvedValue(undefined);
  state.removeRelation.mockResolvedValue(undefined);
  state.retrieve.mockResolvedValue({
    id: "issue",
    name: "Existing task",
    description_html: "<p><strong>Existing description</strong></p>",
    priority: "low",
    start_date: "2026-11-20",
    target_date: "2026-11-25",
    assignee_ids: ["teammate"],
    state_id: "todo",
  });
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
async function render(defaults?: Partial<TNewTaskDraft>) {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <NewTaskPanel workspaceSlug="team" onClose={state.close} onSaved={state.saved} defaults={defaults} />
      </SWRConfig>
    )
  );
}
async function change(label: string, value: string) {
  const input = document.body.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
  await act(() => {
    const prototype = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function save() {
  await act(() => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

async function renderEdit() {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <EditTaskPanel slug="team" projectId="project" issueId="issue" onClose={state.close} />
      </SWRConfig>
    )
  );
}

it("prefills the shared task form and discards edits on cancel", async () => {
  await renderEdit();
  expect(host.textContent).toContain("Edit Task");
  expect(host.textContent).not.toContain("Start date");
  expect(host.textContent).toContain("Due date");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Task name"]')?.value).toBe("Existing task");
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Status"]')?.value).toBe("approved");
  expect(host.textContent).toContain("Previous dependency");
  expect(host.textContent).toContain("brief.pdf");
  expect(host.textContent).toContain("Existing subtask");
  expect(host.querySelector("[data-description]")?.getAttribute("data-description")).toContain("<strong>");
  await change("Task name", "Unsaved change");
  await act(() => button("Cancel").click());
  expect(state.close).toHaveBeenCalledOnce();
  expect(state.update).not.toHaveBeenCalled();
  expect(state.issue).not.toHaveBeenCalled();
});

it("updates the existing task and only saves changed fields and dependencies", async () => {
  await renderEdit();
  await change("Task name", "Updated task");
  await act(() =>
    host.querySelector<HTMLButtonElement>('[aria-label="Remove dependency Previous dependency"]')!.click()
  );
  await act(() => button("Add dependencies").click());
  await act(() => button("Choose dependency").click());
  await save();
  expect(state.update).toHaveBeenCalledExactlyOnceWith("project", "issue", { name: "Updated task" });
  expect(state.removeRelation).toHaveBeenCalledExactlyOnceWith("team", "project", "issue", {
    relation_type: "blocked_by",
    related_issue: "previous",
  });
  expect(state.relation).toHaveBeenCalledExactlyOnceWith("team", "project", "issue", {
    related_list: [{ relation_type: "blocked_by", related_issue: "dependency" }],
  });
  expect(state.setField).not.toHaveBeenCalled();
  expect(state.issue).not.toHaveBeenCalled();
  expect(state.close).toHaveBeenCalledOnce();
});

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
  expect(host.textContent).not.toContain("Start date");
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
    stage: "todo",
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
  await render({ target_date: "2026-11-02" });
  await change("Task name", "Project task");
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

it("persists a selected personal stage without exposing private tasks to other teammates", async () => {
  await render();
  await change("Task name", "Doing privately");
  await change("Stage", "in_progress");
  await save();
  expect(state.create).toHaveBeenCalledWith("team", expect.objectContaining({ stage: "in_progress" }));
  expect(state.invite).not.toHaveBeenCalled();
});

it("confirms editor access before queuing an email assignment and clears it when switching projects", async () => {
  await render();
  await change("Task name", "Invite and assign");
  await change("Link to Project", "project");
  await act(() => button("Invite: new@example.com").click());
  expect(state.pickerClose).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("Editor access");
  await change("Invite email", "New@Example.com");
  await act(() => button("Invite on save").click());
  expect(state.issue).not.toHaveBeenCalled();
  expect(host.textContent).toContain("new@example.com");
  state.invite.mockResolvedValue({ added: [], invited: ["new@example.com"] });
  await save();
  expect(state.invite).toHaveBeenCalledWith("team", "project", [{ email: "new@example.com", role: 15 }], "issue");
  await change("Link to Project", "other");
  expect(host.querySelector('[aria-label="Remove invitation new@example.com"]')).toBeNull();
});

async function renderInlineAssignee(disabled = false) {
  await act(() =>
    root.render(
      <IssueAssignmentAndDueDate
        workspaceSlug="team"
        projectId="project"
        issueId="issue"
        disabled={disabled}
        compactAssignee
        allowAssigneeInvites
        issueOperations={{ fetch: vi.fn(), update: state.update, remove: vi.fn() }}
      />
    )
  );
}

it.each([true, false])("invites by email on an existing task (already a teammate: %s)", async (existing) => {
  const email = "new@example.com";
  state.invite.mockResolvedValue({ added: existing ? [email] : [], invited: existing ? [] : [email] });
  await renderInlineAssignee();
  await act(() => button("Invite: new@example.com").click());
  expect(document.body.querySelector<HTMLInputElement>('[aria-label="Invite email"]')?.value).toBe(email);
  expect(state.invite).not.toHaveBeenCalled();
  await change("Invite email", "New@Example.com");
  const send = Array.from(document.body.querySelectorAll("button")).find(
    (item) => item.textContent === "Send invitation"
  )!;
  await act(() => send.click());
  expect(state.invite).toHaveBeenCalledExactlyOnceWith("team", "project", [{ email, role: 15 }], "issue");
  expect(state.fetchIssue).toHaveBeenCalledTimes(existing ? 1 : 0);
  expect(state.fetchMembers).toHaveBeenCalledTimes(existing ? 1 : 0);
  expect(state.update).not.toHaveBeenCalled();
  expect(document.body.querySelector('[aria-label="Invite email"]')).toBeNull();
});

it("offers the inline invite action only after opening the dropdown", async () => {
  await renderInlineAssignee();
  expect(host.textContent).not.toContain("Invite by email");
  await act(() => button("Open assignee dropdown").click());
  await act(() => button("Invite by email").click());
  expect(state.pickerClose).toHaveBeenCalledOnce();
  const dialog = document.body.querySelector('[role="dialog"][aria-label="Invite and assign by email"]');
  expect(dialog).not.toBeNull();
  expect(host.contains(dialog)).toBe(false);
  const input = dialog!.querySelector<HTMLInputElement>('[aria-label="Invite email"]')!;
  expect(input.value).toBe("");
  await act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.body.querySelector('[aria-label="Invite email"]')).toBeNull();
  expect(state.invite).not.toHaveBeenCalled();
});

it("does not offer inline invitations to read-only users or non-admins", async () => {
  await renderInlineAssignee(true);
  expect(host.textContent).not.toContain("Invite by email");
  state.role = 15;
  await renderInlineAssignee();
  await act(() => button("Open assignee dropdown").click());
  expect(host.textContent).not.toContain("Invite by email");
  expect(host.textContent).not.toContain("Invite: new@example.com");
});

it("queues invitations from the Edit Task form until the existing task is saved", async () => {
  state.invite.mockResolvedValue({ added: [], invited: ["new@example.com"] });
  await renderEdit();
  await act(() => button("Invite by email").click());
  await change("Invite email", "new@example.com");
  await act(() => button("Invite on save").click());
  expect(state.invite).not.toHaveBeenCalled();
  await save();
  expect(state.invite).toHaveBeenCalledExactlyOnceWith(
    "team",
    "project",
    [{ email: "new@example.com", role: 15 }],
    "issue"
  );
  expect(state.issue).not.toHaveBeenCalled();
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
