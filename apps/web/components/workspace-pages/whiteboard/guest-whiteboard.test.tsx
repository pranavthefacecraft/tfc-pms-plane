import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GuestWhiteboard } from "./guest-whiteboard";

const mocks = vi.hoisted(() => ({
  page: { name: "Shared board", description_json: { elements: [] } },
  error: undefined as Error | undefined,
  role: "viewer",
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("../use-workspace-tool-page", () => ({
  useWorkspaceToolPage: () => ({ page: mocks.page, error: mocks.error, isLoading: false }),
}));
vi.mock("./collaboration", () => ({
  useWhiteboardCollaboration: () => ({ state: { role: mocks.role } }),
}));
vi.mock("./canvas", () => ({ default: () => <div data-testid="canvas">Drawing canvas</div> }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.error = undefined;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it.each(["viewer", "editor"])(
  "shows guest %s access without workspace navigation or sharing controls",
  async (role) => {
    mocks.role = role;
    await act(async () => root.render(<GuestWhiteboard workspaceSlug="team" pageId="board" />));
    expect(host.textContent).toContain(role === "editor" ? "Editor" : "Viewer");
    expect(host.textContent).toContain("Shared board");
    expect(host.querySelector('[data-testid="canvas"]')).not.toBeNull();
    expect(host.querySelector("nav, aside, button, a")).toBeNull();
  }
);
it("does not show the canvas when board access is lost", async () => {
  mocks.error = new Error("Guest removed");
  await act(async () => root.render(<GuestWhiteboard workspaceSlug="team" pageId="board" />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Guest access may have been removed");
  expect(host.querySelector('[data-testid="canvas"]')).toBeNull();
});
