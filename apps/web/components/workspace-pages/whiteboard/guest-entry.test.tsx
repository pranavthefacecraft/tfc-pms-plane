import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WhiteboardGuestEntry } from "./guest-entry";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }));
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
  WorkspaceShell: ({ children }: { children: ReactNode }) => <section data-testid="workspace">{children}</section>,
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
  GuestWhiteboard: () => (
    <div data-testid="board" data-guest="true">
      Canvas
    </div>
  ),
}));
vi.mock("./guest-shell", () => ({
  GuestWhiteboardShell: ({ children }: { children: ReactNode }) => (
    <section data-testid="guest-shell">{children}</section>
  ),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.toast.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <WhiteboardGuestEntry workspaceSlug="team" pageId="board" />
      </SWRConfig>
    );
  });
}

it.each(["viewer", "editor"])("requires explicit joining and explains %s board-only access", async (role) => {
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: false, guest_role: role } });
  mocks.post.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: role } });
  await render();
  expect(mocks.post).not.toHaveBeenCalled();
  expect(host.textContent).toContain(role === "editor" ? "Editor" : "Viewer");
  expect(host.textContent).toContain("whiteboard only");
  expect(host.querySelector('[data-testid="board"]')).toBeNull();
  await act(async () => host.querySelector("button")?.click());
  expect(mocks.post).toHaveBeenCalledWith("/api/workspaces/team/workspace-pages/board/guest/");
  expect(host.querySelector('[data-testid="board"]')?.getAttribute("data-guest")).toBe("true");
  expect(host.querySelector('[data-testid="workspace"]')).toBeNull();
  expect(host.querySelector('[data-testid="guest-shell"]')).not.toBeNull();
});

it("preserves workspace and project shells for existing members", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: true, joined: true, guest_role: "disabled" } });
  await render();
  expect(host.querySelector('[data-testid="workspace"] [data-testid="projects"] [data-testid="board"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="board"]')?.getAttribute("data-guest")).toBe("false");
});

it("opens a previously joined guest directly without workspace UI", async () => {
  mocks.get.mockResolvedValue({ data: { is_member: false, joined: true, guest_role: "viewer" } });
  await render();
  expect(host.querySelector('[data-testid="board"]')?.getAttribute("data-guest")).toBe("true");
  expect(host.querySelector('[data-testid="workspace"]')).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
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
