import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WhiteboardGuestEntry } from "./guest-entry";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  toast: vi.fn(),
  fetchWorkspaces: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchCurrentUserSettings: vi.fn(),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ fetchWorkspaces: mocks.fetchWorkspaces }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserProfile: () => ({ fetchUserProfile: mocks.fetchUserProfile }),
  useUserSettings: () => ({ fetchCurrentUserSettings: mocks.fetchCurrentUserSettings }),
}));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = mocks.get;
    post = mocks.post;
  },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock("@/app/(all)/[workspaceSlug]/layout", () => ({
  WorkspaceShell: ({ children, workspaceSlug }: { children: ReactNode; workspaceSlug: string }) => (
    <section data-testid="workspace" data-workspace={workspaceSlug}>
      {children}
    </section>
  ),
}));
vi.mock("@/components/workspace/project-shell", () => ({
  ProjectShell: ({ children }: { children: ReactNode }) => <section data-testid="projects">{children}</section>,
}));
vi.mock("./detail-root", () => ({
  WhiteboardDetailRoot: ({ guest = false }: { guest?: boolean }) => (
    <div data-testid="board" data-guest={guest}>
      Canvas
    </div>
  ),
}));
vi.mock("./guest-whiteboard", () => ({
  GuestWhiteboard: ({ workspaceSlug }: { workspaceSlug: string }) => (
    <div data-testid="board" data-guest="true" data-board-workspace={workspaceSlug}>
      Canvas
    </div>
  ),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.toast.mockReset();
  mocks.fetchWorkspaces.mockReset().mockResolvedValue([]);
  mocks.fetchUserProfile.mockReset().mockResolvedValue({ is_onboarded: true });
  mocks.fetchCurrentUserSettings.mockReset().mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

async function render(navigationWorkspaceSlug?: string) {
  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter>
          <Location />
          <WhiteboardGuestEntry workspaceSlug="team" pageId="board" navigationWorkspaceSlug={navigationWorkspaceSlug} />
        </MemoryRouter>
      </SWRConfig>
    );
  });
}

it.each(["viewer", "editor"])("requires explicit joining and explains %s board-only access", async (role) => {
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: false, guest_role: role } });
  mocks.post
    .mockResolvedValueOnce({ data: { is_member: false, joined: true, guest_role: role } })
    .mockResolvedValue({ data: { workspace_slug: "personal" } });
  await render();
  expect(mocks.post).not.toHaveBeenCalled();
  expect(host.textContent).toContain(role === "editor" ? "Editor" : "Viewer");
  expect(host.textContent).toContain("whiteboard only");
  expect(host.querySelector('[data-testid="board"]')).toBeNull();
  await act(async () => host.querySelector("button")?.click());
  expect(mocks.post).toHaveBeenCalledWith("/api/workspaces/team/workspace-pages/board/guest/");
  expect(mocks.post).toHaveBeenCalledWith("/api/workspaces/team/workspace-pages/board/guest-workspace/");
  expect(host.querySelector('[data-testid="location"]')?.textContent).toBe(
    "/personal/tool/shared-whiteboards/team/board"
  );
  expect(host.querySelector('[data-testid="workspace"]')).toBeNull();
  expect(mocks.fetchWorkspaces).toHaveBeenCalled();
  expect(mocks.fetchUserProfile).toHaveBeenCalled();
  expect(mocks.fetchCurrentUserSettings).toHaveBeenCalledWith(true);
});

it("preserves workspace and project shells for existing members", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: true, joined: true, guest_role: "disabled" } });
  await render();
  expect(host.querySelector('[data-testid="workspace"] [data-testid="projects"] [data-testid="board"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="board"]')?.getAttribute("data-guest")).toBe("false");
});

it("redirects a previously joined guest into their own workspace without rejoining", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: "viewer" } });
  mocks.post.mockResolvedValue({ data: { workspace_slug: "personal" } });
  await render();
  expect(host.querySelector('[data-testid="location"]')?.textContent).toBe(
    "/personal/tool/shared-whiteboards/team/board"
  );
  expect(host.querySelector('[data-testid="workspace"]')).toBeNull();
  expect(mocks.post).not.toHaveBeenCalledWith("/api/workspaces/team/workspace-pages/board/guest/");
});

it("mounts normal navigation for the personal workspace but keeps the shared canvas scoped to its owner", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: "editor" } });
  mocks.post.mockResolvedValue({ data: { workspace_slug: "personal" } });
  await render("personal");
  expect(host.querySelector('[data-testid="workspace"]')?.getAttribute("data-workspace")).toBe("personal");
  expect(
    host.querySelector('[data-testid="projects"] [data-testid="board"]')?.getAttribute("data-board-workspace")
  ).toBe("team");
  expect(host.querySelector('[data-testid="board"]')?.getAttribute("data-guest")).toBe("true");
});

it("never mounts another visitor's workspace when an internal shared-board URL is forwarded", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: "viewer" } });
  mocks.post.mockResolvedValue({ data: { workspace_slug: "my-workspace" } });
  await render("someone-else");
  expect(host.querySelector('[data-testid="workspace"]')).toBeNull();
  expect(host.querySelector('[data-testid="location"]')?.textContent).toBe(
    "/my-workspace/tool/shared-whiteboards/team/board"
  );
});

it("returns workspace members to their original board route", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: true, joined: true, guest_role: "viewer" } });
  await render("personal");
  expect(host.querySelector('[data-testid="location"]')?.textContent).toBe("/team/tool/whiteboards/board");
  expect(mocks.post).not.toHaveBeenCalled();
});

it("shows retry instead of mounting workspace UI when automatic setup fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: "viewer" } });
  mocks.post
    .mockRejectedValueOnce(new Error("Workspace creation disabled"))
    .mockResolvedValue({ data: { workspace_slug: "personal" } });
  await render("personal");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not open your workspace");
  expect(host.querySelector('[data-testid="board"]')).toBeNull();
  await act(async () => host.querySelector("button")?.click());
  expect(host.querySelector('[data-testid="workspace"]')?.getAttribute("data-workspace")).toBe("personal");
  log.mockRestore();
});

it("does not enter the workspace if refreshing account state fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: "viewer" } });
  mocks.post.mockResolvedValue({ data: { workspace_slug: "personal" } });
  mocks.fetchWorkspaces.mockRejectedValue(new Error("Could not refresh workspaces"));
  await render("personal");
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="workspace"]')).toBeNull();
  log.mockRestore();
});

it("shows unavailable access without exposing a canvas or join button", async () => {
  mocks.get.mockRejectedValue(new Error("Guest access disabled"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("guest access may be disabled");
  expect(host.querySelector("button")?.textContent).toBe("Retry");
  expect(host.querySelector('[data-testid="board"]')).toBeNull();
});

it("reports a failed join and keeps the join action available for retry", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: false, guest_role: "viewer" } });
  mocks.post.mockRejectedValue(new Error("Disabled while joining"));
  await render();
  await act(async () => host.querySelector("button")?.click());
  expect(mocks.toast).toHaveBeenCalledWith(
    expect.objectContaining({ type: "error", title: "Could not join whiteboard" })
  );
  expect(host.querySelector("button")?.disabled).toBe(false);
  expect(host.querySelector('[data-testid="board"]')).toBeNull();
  log.mockRestore();
});
