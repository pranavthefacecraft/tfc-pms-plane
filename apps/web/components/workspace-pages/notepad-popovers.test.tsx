import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { LinkWorkspacePagePopover } from "./link-page-popover";
import { NotepadCollaborators } from "./notepad-collaborators";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  attach: vi.fn(),
  sharing: vi.fn(),
  invite: vi.fn(),
  revoke: vi.fn(),
  onAttached: vi.fn(),
  onChange: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    joinedProjectIds: ["project", "other"],
    getPartialProjectById: (id: string) => ({
      id,
      name: id === "project" ? "Website" : "Other workspace",
      identifier: "WEB",
      workspace: id === "project" ? "team-id" : "other-id",
    }),
  }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "team-id" }) }),
}));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    searchEntity = mocks.search;
  },
}));
vi.mock("@/services/page/workspace-page.service", () => ({
  WorkspacePageService: class {
    attach = mocks.attach;
    sharing = mocks.sharing;
    invite = mocks.invite;
    revoke = mocks.revoke;
  },
}));
const page: TWorkspacePage = {
  id: "note",
  name: "Notes",
  tool_type: "page",
  access: 1,
  logo_props: {},
  owned_by: "owner",
  owner: { id: "owner", display_name: "Owner", first_name: "Owner", last_name: "", avatar_url: null },
  updated_by: null,
  workspace: "team-id",
  created_at: "",
  updated_at: "",
  attachment: null,
};
const sharing = { access: 1, collaborators: [], pending: [] };
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.search.mockResolvedValue({
    issue: [{ id: "task", name: "Write brief", project__identifier: "WEB", sequence_id: 3 }],
  });
  mocks.attach.mockResolvedValue(page);
  mocks.sharing.mockResolvedValue(sharing);
  mocks.invite.mockResolvedValue({ ...sharing, pending: ["guest@example.com"] });
  mocks.revoke.mockResolvedValue(sharing);
  mocks.onChange.mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
async function click(text: string) {
  await act(() => button(text).click());
}
async function input(label: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function render(kind: "link" | "sharing" | "whiteboard" = "link", canManage = true) {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {kind !== "sharing" ? (
          <LinkWorkspacePagePopover
            workspaceSlug="team"
            page={kind === "whiteboard" ? { ...page, tool_type: "whiteboard" } : page}
            onAttached={mocks.onAttached}
            disabled={!canManage}
          />
        ) : (
          <NotepadCollaborators workspaceSlug="team" page={page} canManage={canManage} onChange={mocks.onChange} />
        )}
      </SWRConfig>
    )
  );
}
async function openLink() {
  await render();
  await click("Link Task / Project");
  await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
}
async function openSharing() {
  await render("sharing");
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="Add collaborator"]')!.click());
}

it("opens an anchored combined search with only current-workspace projects and links a task", async () => {
  await openLink();
  expect(document.body.textContent).toContain("Link Notepad");
  expect(document.body.textContent).toContain("Website");
  expect(document.body.textContent).toContain("Write brief");
  expect(document.body.textContent).not.toContain("Other workspace");
  await click("Write briefWEB-3");
  expect(mocks.attach).toHaveBeenCalledWith("team", "note", { entity_type: "issue", entity_id: "task" });
  expect(mocks.onAttached).toHaveBeenCalledWith(page);
  expect(document.body.textContent).not.toContain("Link Notepad");
});
it("filters projects, searches tasks, and links a project without tabs", async () => {
  await openLink();
  await input("Search tasks or projects", "Website");
  await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
  expect(mocks.search).toHaveBeenLastCalledWith("team", { count: 20, query_type: ["issue"], query: "Website" });
  await click("WebsiteProject");
  expect(mocks.attach).toHaveBeenCalledWith("team", "note", { entity_type: "project", entity_id: "project" });
});
it("reports search failure and permits retry rather than pretending there are no results", async () => {
  mocks.search.mockRejectedValueOnce(new Error("network"));
  await openLink();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not search tasks");
  await click("Retry");
  await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
  expect(document.body.textContent).toContain("Write brief");
});
it("keeps the popover open on attachment failure and retries successfully", async () => {
  await openLink();
  mocks.attach.mockRejectedValueOnce(new Error("network"));
  await click("WebsiteProject");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not link");
  await click("WebsiteProject");
  expect(document.body.textContent).not.toContain("Link Notepad");
});
it("shows owner plus an invite control, queues the email and displays pending recipients", async () => {
  await openSharing();
  expect(document.body.textContent).toContain("Only Me");
  await input("Collaborator email", "guest@example.com");
  await act(() =>
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(mocks.invite).toHaveBeenCalledWith("team", "note", "guest@example.com");
  expect(document.body.textContent).toContain("guest@example.com (invited)");
  expect(document.body.textContent).toContain("No workspace or project access");
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="Remove guest@example.com"]')!.click());
  expect(mocks.revoke).toHaveBeenCalledWith("team", "note", { email: "guest@example.com" });
});
it("requires confirmation before Only Me revokes collaborators and pending invites", async () => {
  await openSharing();
  await click("Only Me");
  expect(mocks.revoke).not.toHaveBeenCalled();
  await click("Make private");
  expect(mocks.revoke).toHaveBeenCalledWith("team", "note", { only_me: true });
  expect(mocks.onChange).toHaveBeenCalled();
});
it("reports invite failures and leaves the email available for retry", async () => {
  mocks.invite.mockRejectedValueOnce(new Error("queue down"));
  await openSharing();
  await input("Collaborator email", "guest@example.com");
  await act(() =>
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not update collaborators");
  expect(document.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe("guest@example.com");
});
it("does not offer sharing management to nonowners", async () => {
  await render("sharing", false);
  expect(document.querySelector('[aria-label="Add collaborator"]')).toBeNull();
  expect(mocks.sharing).not.toHaveBeenCalled();
});
it("reuses the compact dropdown for whiteboards and refreshes the linked board", async () => {
  await render("whiteboard");
  await click("Link to Task or Project");
  await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
  expect(document.body.textContent).toContain("Link Whiteboard");
  await click("WebsiteProject");
  expect(mocks.attach).toHaveBeenCalledWith("team", "note", { entity_type: "project", entity_id: "project" });
  expect(mocks.toast).toHaveBeenCalledWith({ type: "success", title: "Whiteboard linked" });
});
it("keeps viewer and paused whiteboard linking disabled", async () => {
  await render("whiteboard", false);
  expect(button("Link to Task or Project").disabled).toBe(true);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("closes an open whiteboard dropdown when editing is paused", async () => {
  await render("whiteboard");
  await click("Link to Task or Project");
  await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
  expect(document.body.textContent).toContain("Link Whiteboard");
  await render("whiteboard", false);
  expect(document.body.textContent).not.toContain("Link Whiteboard");
  expect(button("Link to Task or Project").disabled).toBe(true);
});
