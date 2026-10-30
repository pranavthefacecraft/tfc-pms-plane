import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActivityTaskActionDialog } from "./activity-task-action-dialog";
import { overviewTasks } from "./activity-overview.helpers";

const state = vi.hoisted(() => ({
  status: vi.fn(),
  share: vi.fn(),
  revoke: vi.fn(),
  remove: vi.fn(),
  deleteIssue: vi.fn(),
  copy: vi.fn(),
  toast: vi.fn(),
  close: vi.fn(),
  deleted: vi.fn(),
}));
vi.mock("@/services/personal-task.service", () => ({
  personalTaskService: {
    shareStatus: state.status,
    share: state.share,
    revokeShare: state.revoke,
    remove: state.remove,
  },
  personalTaskError: () => "Request failed. Please retry.",
}));
vi.mock("@/services/issue/issue.service", () => ({
  IssueService: class {
    deleteIssue = state.deleteIssue;
  },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
function Wrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
vi.mock("@makeplane/propel/components/dialog", () => {
  return {
    Dialog: Wrapper,
    DialogBody: Wrapper,
    DialogContent: Wrapper,
    DialogHeader: Wrapper,
    DialogHeading: Wrapper,
    DialogMain: Wrapper,
    DialogTitle: Wrapper,
  };
});

const [personal] = overviewTasks(
  [
    {
      id: "personal",
      name: "Buy toys",
      description: "",
      priority: "none",
      start_date: null,
      target_date: "2026-10-30",
      completed_at: null,
      created_at: "2026-10-30T12:00:00Z",
      updated_at: "2026-10-30T12:00:00Z",
    },
  ],
  []
);
const [project] = overviewTasks(
  [],
  [
    {
      id: "issue",
      name: "Project task",
      project_id: "project",
      project_identifier: "PRJ",
      project_name: "Website",
      sequence_id: 7,
      state_group: "started",
      start_date: null,
      target_date: "2026-10-30",
      completed_at: null,
      assignee_ids: ["me"],
      created_by: "me",
    },
  ]
);
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const button = (label: string) =>
  Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label)!;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("navigator", { clipboard: { writeText: state.copy } });
  state.status.mockResolvedValue({ token: null });
  state.share.mockResolvedValue({ token: "public-token" });
  state.copy.mockResolvedValue(undefined);
  state.revoke.mockResolvedValue(undefined);
  state.remove.mockResolvedValue(undefined);
  state.deleteIssue.mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(action: "share" | "delete", task = personal) {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <ActivityTaskActionDialog
          task={task}
          action={action}
          workspaceSlug="team"
          onClose={state.close}
          onDeleted={state.deleted}
        />
      </SWRConfig>
    )
  );
}
it("requires explicit opt-in, copies a public personal link and allows revocation", async () => {
  await render("share");
  expect(state.share).not.toHaveBeenCalled();
  expect(host.textContent).toContain("without signing in");
  await act(() => button("Enable sharing & copy link").click());
  expect(state.share).toHaveBeenCalledWith("team", "personal");
  expect(state.copy).toHaveBeenCalledWith(`${window.location.origin}/shared/personal-tasks/public-token/`);
  expect(host.querySelector("input")?.value).toContain("public-token");
  await act(() => button("Stop sharing").click());
  expect(state.revoke).toHaveBeenCalledWith("team", "personal");
  expect(host.querySelector("input")).toBeNull();
});
it("copies project links without enabling public access", async () => {
  await render("share", project);
  await act(() => button("Copy link").click());
  expect(state.copy).toHaveBeenCalledWith(expect.stringContaining("/team/"));
  expect(state.share).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Existing project permissions");
});
it("requires delete confirmation and refreshes only after success", async () => {
  await render("delete");
  expect(state.remove).not.toHaveBeenCalled();
  await act(() => button("Delete task").click());
  expect(state.remove).toHaveBeenCalledWith("team", "personal");
  expect(state.deleted).toHaveBeenCalledOnce();
  expect(state.close).toHaveBeenCalledOnce();
});
it("surfaces deletion errors and keeps the dialog open", async () => {
  state.remove.mockRejectedValue(new Error("offline"));
  await render("delete");
  await act(() => button("Delete task").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Request failed");
  expect(state.deleted).not.toHaveBeenCalled();
  expect(state.close).not.toHaveBeenCalled();
});
it("exposes the generated link and revocation when clipboard access fails", async () => {
  state.copy.mockRejectedValue(new Error("clipboard denied"));
  await render("share");
  await act(() => button("Enable sharing & copy link").click());
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.querySelector("input")?.value).toContain("public-token");
  expect(button("Stop sharing")).toBeDefined();
  expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
});
it("does not allow public-sharing changes when loading its status fails", async () => {
  state.status.mockRejectedValue(new Error("offline"));
  await render("share");
  expect(button("Enable sharing & copy link").disabled).toBe(true);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load sharing");
});
