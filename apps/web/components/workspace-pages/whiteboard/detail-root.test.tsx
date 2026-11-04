import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WhiteboardDetailRoot } from "./detail-root";

const mocks = vi.hoisted(() => ({
  role: "owner",
  connected: true,
  hasSession: true,
  presenter: null as object | null,
  userId: "owner",
  loading: false,
  error: undefined as Error | undefined,
  update: vi.fn(),
  apply: vi.fn(),
  detach: vi.fn(),
  access: vi.fn(),
  status: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: mocks.userId } }) }));
vi.mock("./collaboration", () => ({
  useWhiteboardCollaboration: () => ({
    connected: mocks.connected,
    state: mocks.hasSession ? { role: mocks.role, presenter: mocks.presenter } : null,
  }),
}));
vi.mock("./sharing", () => ({ WhiteboardSharing: () => <button type="button">Share</button> }));
vi.mock("../link-page-popover", () => ({
  LinkWorkspacePagePopover: ({ disabled }: { disabled: boolean }) => (
    <button type="button" disabled={disabled}>
      Link to Task or Project
    </button>
  ),
}));
vi.mock("./canvas", () => ({
  default: ({ header, onDirtyChange }: { header: ReactNode; onDirtyChange: (dirty: boolean) => void }) => (
    <div data-canvas>
      {header}
      <button type="button" onClick={() => onDirtyChange(true)}>
        Draw
      </button>
    </div>
  ),
}));
const page: TWorkspacePage = {
  id: "board",
  name: "Website Ideas",
  tool_type: "whiteboard",
  access: 0,
  logo_props: {},
  owned_by: "owner",
  owner: null,
  updated_by: null,
  workspace: "workspace",
  created_at: "2026-03-20T10:00:00Z",
  updated_at: "2026-03-20T10:00:00Z",
  attachment: null,
  description_json: { elements: [] },
};
vi.mock("../use-workspace-tool-page", () => ({
  useWorkspaceToolPage: () => ({
    page,
    error: mocks.error,
    isLoading: mocks.loading,
    saveStatus: "saved",
    setSaveStatus: mocks.status,
    applyUpdate: mocks.apply,
    updatePage: mocks.update,
    detach: mocks.detach,
    toggleAccess: mocks.access,
  }),
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.role = "owner";
  mocks.connected = true;
  mocks.hasSession = true;
  mocks.presenter = null;
  mocks.userId = "owner";
  mocks.loading = false;
  mocks.error = undefined;
  mocks.update.mockResolvedValue(page);
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
  await act(() =>
    root.render(
      <MemoryRouter>
        <WhiteboardDetailRoot workspaceSlug="team" pageId="board" />
      </MemoryRouter>
    )
  );
}
it("places title, linking and sharing controls inside the bordered canvas", async () => {
  await render();
  const canvas = host.querySelector("[data-canvas]")!;
  expect(canvas.querySelector('textarea[placeholder="Untitled Whiteboard"]')).not.toBeNull();
  expect(canvas.textContent).toContain("Link to Task or Project");
  expect(canvas.textContent).toContain("Share");
  expect(host.querySelector('section[aria-label="Whiteboard editor"]')?.className).toContain("border-[#E2E6EF]");
  expect(host.querySelector('a[aria-label="Close whiteboard"]')?.getAttribute("href")).toBe("/team/tool/whiteboards/");
  await act(() => [...host.querySelectorAll("button")].find((item) => item.textContent === "Draw")!.click());
  expect(mocks.status).toHaveBeenCalledWith("submitting");
});
it("expands and restores the whiteboard without losing the mounted canvas", async () => {
  await render();
  const canvas = host.querySelector("[data-canvas]");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Expand whiteboard"]')!.click());
  expect(host.firstElementChild?.className).toContain("fixed inset-0");
  expect(host.querySelector("[data-canvas]")).toBe(canvas);
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Exit expanded whiteboard"]')!.click());
  expect(host.firstElementChild?.className).not.toContain("fixed");
});
it.each(["viewer", "disconnected", "presenting", "joining"])(
  "keeps title and link controls disabled while %s",
  async (mode) => {
    if (mode === "viewer") mocks.role = "viewer";
    if (mode === "disconnected") mocks.connected = false;
    if (mode === "presenting") mocks.presenter = {};
    if (mode === "joining") mocks.hasSession = false;
    mocks.userId = "other";
    await render();
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true);
    expect(
      [...host.querySelectorAll("button")].find((item) => item.textContent === "Link to Task or Project")?.disabled
    ).toBe(true);
    expect(host.textContent).not.toContain("Share");
  }
);
it("retains settings and access management for owners", async () => {
  await render();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Whiteboard settings"]')!.click());
  expect(document.body.textContent).toContain("Not attached");
  expect(document.body.textContent).toContain("Link to Task or Project");
  const visibility = [...document.body.querySelectorAll("button")].find((item) => item.title === "Toggle access")!;
  await act(() => visibility.click());
  expect(mocks.access).toHaveBeenCalledOnce();
});
it("preserves title updates", async () => {
  await render();
  const input = host.querySelector("textarea")!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Updated board");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(() => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(mocks.update).toHaveBeenCalledWith({ name: "Updated board" });
});
it("preserves loading and missing-whiteboard states", async () => {
  mocks.loading = true;
  await render();
  expect(host.textContent).toContain("Loading whiteboard");
  mocks.loading = false;
  mocks.error = new Error("gone");
  await render();
  expect(host.textContent).toContain("Whiteboard not found");
  expect(host.querySelector("[data-canvas]")).toBeNull();
});
