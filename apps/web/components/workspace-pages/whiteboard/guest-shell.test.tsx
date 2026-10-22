import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GuestWhiteboardShell } from "./guest-shell";

const mocks = vi.hoisted(() => ({
  collapsed: false,
  toggle: vi.fn(),
  peek: vi.fn(),
  outside: undefined as (() => void) | undefined,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/hooks", () => ({
  useLocalStorage: () => ({ storedValue: 250, setValue: vi.fn() }),
  useOutsideClickDetector: (_ref: unknown, callback: () => void) => {
    mocks.outside = callback;
  },
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({
    sidebarCollapsed: mocks.collapsed,
    toggleSidebar: mocks.toggle,
    sidebarPeek: false,
    toggleSidebarPeek: mocks.peek,
    isAnySidebarDropdownOpen: false,
  }),
}));
vi.mock("@/components/sidebar/resizable-sidebar", () => ({
  ResizableSidebar: ({ children, isCollapsed }: { children: ReactNode; isCollapsed: boolean }) =>
    isCollapsed ? null : <div data-testid="sidebar">{children}</div>,
}));
vi.mock("@/components/sidebar/sidebar-toggle-button", () => ({
  AppSidebarToggleButton: () => (
    <button aria-label="Toggle sidebar" onClick={() => mocks.toggle()}>
      Toggle
    </button>
  ),
}));
vi.mock("@/components/workspace/sidebar/user-menu-root", () => ({
  UserMenuRoot: () => <button aria-label="User menu">Profile</button>,
}));
vi.mock("@/components/common/modal/global", () => ({
  GlobalModals: () => <div data-testid="profile-modals" />,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.collapsed = false;
  mocks.toggle.mockReset();
  mocks.outside = undefined;
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
      <GuestWhiteboardShell workspaceSlug="thefacecraft">
        <div>Shared canvas</div>
      </GuestWhiteboardShell>
    )
  );
}
it("shows workspace chrome while keeping restricted navigation noninteractive", async () => {
  await render();
  expect(host.querySelector('aside[aria-label="Workspace sidebar"]')).not.toBeNull();
  expect(host.querySelector('header[aria-label="Workspace header"]')).not.toBeNull();
  expect(host.textContent).toContain("thefacecraft");
  expect(host.textContent).toContain("Shared canvas");
  expect(host.querySelector("a")).toBeNull();
  for (const label of [
    "Home",
    "Drafts",
    "Your work",
    "New work item",
    "Projects",
    "Views",
    "Analytics",
    "Settings",
    "Notepad",
    "Search",
  ]) {
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
    expect(button?.disabled, label).toBe(true);
  }
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Inbox"]')?.disabled).toBe(true);
  expect(host.querySelector('[aria-current="page"]')?.textContent).toContain("Whiteboard");
  expect(host.querySelector<HTMLButtonElement>('[aria-label="User menu"]')?.disabled).toBe(false);
  expect(host.querySelector('[data-testid="profile-modals"]')).not.toBeNull();
});
it("keeps a sidebar opening control in the header when collapsed", async () => {
  mocks.collapsed = true;
  await render();
  expect(host.querySelector("aside")).toBeNull();
  await act(() => host.querySelector<HTMLButtonElement>('header [aria-label="Toggle sidebar"]')?.click());
  expect(mocks.toggle).toHaveBeenCalledOnce();
});
it("closes the mobile sidebar after an outside click", async () => {
  vi.stubGlobal("innerWidth", 400);
  await render();
  await act(() => mocks.outside?.());
  expect(mocks.toggle).toHaveBeenCalledOnce();
});
it("does not close the expanded desktop sidebar after an outside click", async () => {
  vi.stubGlobal("innerWidth", 1200);
  await render();
  await act(() => mocks.outside?.());
  expect(mocks.toggle).not.toHaveBeenCalled();
});
