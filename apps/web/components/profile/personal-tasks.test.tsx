import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PersonalTaskDialog } from "./personal-task-dialog";
import { PersonalTasks, PersonalTasksList } from "./personal-tasks";
import { ProfileCreateTaskButton } from "./create-task-button";
import type { TPersonalTask } from "@/services/personal-task.service";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  close: vi.fn(),
  saved: vi.fn(),
  authorized: true,
  profileUser: "me",
  projects: ["project"],
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/issues/issue-modal/modal", () => ({
  CreateUpdateIssueModal: () => null,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", userId: state.profileUser }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: state.push }) }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me" } }),
  useUserPermissions: () => ({ allowPermissions: () => state.authorized }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    joinedProjectIds: state.projects,
    getProjectById: (id: string) => ({ id, name: "Destination", archived_at: null }),
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ fetchProjectStates: vi.fn(), getProjectDefaultStateId: () => "" }),
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => null }));
vi.mock("@/components/core/modals/existing-issues-list-modal", () => ({ ExistingIssuesListModal: () => null }));
vi.mock("@/services/personal-task.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/personal-task.service")>()),
  personalTaskService: {
    list: state.list,
    create: state.create,
    update: state.update,
    remove: state.remove,
    move: state.move,
  },
}));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogMain: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeading: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/common/task-form-content", () => ({
  TaskFormContent: ({ children, presentation = "dialog" }: { children: ReactNode; presentation?: string }) => (
    <div data-presentation={presentation}>{children}</div>
  ),
}));

const task: TPersonalTask = {
  id: "task",
  name: "Private task",
  description: "My notes",
  priority: "high",
  start_date: "2026-10-27",
  target_date: "2026-10-29",
  completed_at: null,
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const cache = () => new Map();
const render = (element: ReactNode) =>
  act(() =>
    root.render(
      <SWRConfig value={{ provider: cache, dedupingInterval: 0, shouldRetryOnError: false }}>{element}</SWRConfig>
    )
  );
const button = (label: string) =>
  Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label)!;
const click = (label: string) => act(() => button(label).click());
const change = async (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  await act(() => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
};
const submit = () =>
  act(() => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.authorized = true;
  state.profileUser = "me";
  state.projects = ["project"];
  state.list.mockResolvedValue([task]);
  state.create.mockResolvedValue(task);
  state.update.mockResolvedValue(task);
  state.remove.mockResolvedValue(undefined);
  state.move.mockResolvedValue({ id: "issue", project_id: "project", name: task.name });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("creates a task without project data and closes only after saving", async () => {
  await render(<PersonalTaskDialog workspaceSlug="workspace" onClose={state.close} onSaved={state.saved} />);
  expect(host.textContent).toContain("No project");
  expect(button("Save").disabled).toBe(true);
  expect(host.textContent).toContain("Enter a task name to enable Save.");
  expect(state.toast).not.toHaveBeenCalled();
  await change(host.querySelector<HTMLInputElement>("input[required]")!, "  My task  ");
  await submit();
  expect(state.create).toHaveBeenCalledExactlyOnceWith("workspace", {
    name: "My task",
    description: "",
    priority: "none",
    start_date: null,
    target_date: null,
  });
  expect(state.saved).toHaveBeenCalledWith(task);
  expect(state.close).toHaveBeenCalledOnce();
  expect(state.toast).toHaveBeenCalledWith({
    type: "success",
    title: "Task saved",
    message: expect.stringContaining("My tasks under Personal tasks"),
  });
});

it("preserves input and shows errors when saving fails", async () => {
  state.update.mockRejectedValue(new Error("offline"));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await render(
    <PersonalTaskDialog workspaceSlug="workspace" task={task} onClose={state.close} onSaved={state.saved} />
  );
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Please try again");
  expect(host.querySelector<HTMLInputElement>("input[required]")!.value).toBe(task.name);
  expect(state.close).not.toHaveBeenCalled();
  expect(state.toast).toHaveBeenCalled();
  expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  log.mockRestore();
});

it("opens Add task as a side panel and retains personal-task saving", async () => {
  await render(<ProfileCreateTaskButton workspaceSlug="workspace" userId="me" label="Add task" />);
  await click("Add task");
  expect(host.querySelector('[data-presentation="side-panel"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Close task panel"]')).not.toBeNull();
  await change(host.querySelector<HTMLInputElement>("input[required]")!, "Panel task");
  await submit();
  expect(state.create).toHaveBeenCalledWith("workspace", expect.objectContaining({ name: "Panel task" }));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("keeps the panel open while saving, including when its close control is clicked", async () => {
  let resolve!: (value: TPersonalTask) => void;
  state.create.mockImplementation(
    () =>
      new Promise<TPersonalTask>((done) => {
        resolve = done;
      })
  );
  await render(
    <PersonalTaskDialog
      presentation="side-panel"
      workspaceSlug="workspace"
      onClose={state.close}
      onSaved={state.saved}
    />
  );
  await change(host.querySelector<HTMLInputElement>("input[required]")!, "Pending task");
  await submit();
  const close = host.querySelector<HTMLButtonElement>('[aria-label="Close task panel"]')!;
  expect(close.disabled).toBe(true);
  await act(() => close.click());
  expect(state.close).not.toHaveBeenCalled();
  expect(state.toast).not.toHaveBeenCalled();
  await act(() => resolve(task));
  expect(state.close).toHaveBeenCalledOnce();
});

it("prevents duplicate submissions while a save is pending", async () => {
  let resolve!: (value: TPersonalTask) => void;
  state.update.mockImplementation(
    () =>
      new Promise<TPersonalTask>((done) => {
        resolve = done;
      })
  );
  await render(
    <PersonalTaskDialog workspaceSlug="workspace" task={task} onClose={state.close} onSaved={state.saved} />
  );
  await submit();
  await submit();
  expect(state.update).toHaveBeenCalledOnce();
  expect(button("Cancel").disabled).toBe(true);
  await act(() => resolve(task));
});

it("shows private tasks and completes and reopens them", async () => {
  state.update.mockResolvedValueOnce({ ...task, completed_at: "2026-10-28T00:00:00Z" }).mockResolvedValueOnce(task);
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  expect(host.textContent).toContain("Private to you");
  expect(host.textContent).toContain(task.name);
  await act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(state.update).toHaveBeenLastCalledWith("workspace", "task", { is_completed: true });
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
  await act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(state.update).toHaveBeenLastCalledWith("workspace", "task", { is_completed: false });
});

it("adds a newly created task to the Your work list immediately", async () => {
  state.list.mockResolvedValue([]);
  await render(
    <>
      <ProfileCreateTaskButton workspaceSlug="workspace" userId="me" />
      <PersonalTasksList workspaceSlug="workspace" userId="me" />
    </>
  );
  await click("add_work_item");
  await change(host.querySelector<HTMLInputElement>("input[required]")!, "Private task");
  await submit();
  expect(host.querySelector("ul")?.textContent).toContain(task.name);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("updates the list after editing a task", async () => {
  state.update.mockResolvedValue({ ...task, name: "Changed title" });
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  await click(task.name);
  await change(host.querySelector<HTMLInputElement>("input[required]")!, "Changed title");
  await submit();
  expect(host.querySelector("ul")?.textContent).toContain("Changed title");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("disables moving without projects but still shows personal tasks", async () => {
  state.projects = [];
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  expect(button("Move to project").disabled).toBe(true);
  expect(host.textContent).toContain(task.name);
});

it("confirms deletion before removing a task", async () => {
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  await click("Delete");
  expect(state.remove).not.toHaveBeenCalled();
  expect(host.textContent).toContain("cannot be undone");
  await click("Delete task");
  expect(state.remove).toHaveBeenCalledWith("workspace", task.id);
  expect(host.textContent).toContain("No personal tasks yet");
});

it("warns about project visibility before moving and opens the new project task", async () => {
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  await click("Move to project");
  expect(host.textContent).toContain("will be able to see it");
  expect(button("Move task").disabled).toBe(true);
  await change(host.querySelector("select")!, "project");
  await click("Move task");
  expect(state.move).toHaveBeenCalledWith("workspace", "task", "project");
  expect(state.push).toHaveBeenCalledWith("/workspace/projects/project/issues/issue");
  expect(host.textContent).toContain("No personal tasks yet");
});

it("retains a task when a move fails", async () => {
  state.move.mockRejectedValue(new Error("failed"));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  await click("Move to project");
  await change(host.querySelector("select")!, "project");
  await click("Move task");
  expect(host.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0);
  expect(host.textContent).toContain(task.name);
  expect(state.push).not.toHaveBeenCalled();
  log.mockRestore();
});

it("shows loading failures and allows retry", async () => {
  state.list.mockRejectedValueOnce(new Error("offline"));
  await render(<PersonalTasksList workspaceSlug="workspace" userId="me" />);
  expect(host.textContent).toContain("Could not load personal tasks");
  await click("Retry");
  expect(host.textContent).toContain(task.name);
});

it.each(["other-user", "unauthorized"])("does not fetch private tasks for %s", async (mode) => {
  if (mode === "other-user") state.profileUser = "other";
  else state.authorized = false;
  await render(<PersonalTasks />);
  expect(state.list).not.toHaveBeenCalled();
  expect(host.textContent).toBe("");
});
