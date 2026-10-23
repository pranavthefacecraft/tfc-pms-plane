import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarToolMenu } from "./sidebar-tool-menu";

const mocks = vi.hoisted(() => ({
  pathname: "",
  toggleSidebar: vi.fn(),
  toggleExtendedSidebar: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "personal" }),
  usePathname: () => mocks.pathname,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: ReactNode; onClick: () => void }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("@makeplane/propel/components/collapsible", () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/sidebar/sidebar-navigation", () => ({
  SidebarNavItem: ({ children, isActive }: { children: ReactNode; isActive: boolean }) => (
    <span data-active={isActive}>{children}</span>
  ),
}));
vi.mock("@/hooks/use-local-storage", () => ({
  default: () => ({ storedValue: true, setValue: vi.fn() }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({
    toggleSidebar: mocks.toggleSidebar,
    toggleExtendedSidebar: mocks.toggleExtendedSidebar,
    isExtendedSidebarOpened: true,
  }),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.toggleSidebar.mockReset();
  mocks.toggleExtendedSidebar.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it.each([
  ["/personal/tool/shared-whiteboards/owner/board", "Whiteboard"],
  ["/personal/tool/whiteboards/board", "Whiteboard"],
  ["/personal/tool/pages/page", "Notepad"],
])("highlights the correct tool for %s and links to the visitor's workspace", async (pathname, activeLabel) => {
  mocks.pathname = pathname;
  await act(() => root.render(<SidebarToolMenu />));
  expect(host.querySelector('[data-active="true"]')?.textContent).toBe(activeLabel);
  expect(Array.from(host.querySelectorAll("a")).map((link) => link.getAttribute("href"))).toEqual([
    "/personal/tool/pages/",
    "/personal/tool/whiteboards/",
  ]);
  expect(host.querySelector("[disabled]")).toBeNull();
});
