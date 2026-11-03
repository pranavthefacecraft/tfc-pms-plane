import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarToolMenu } from "./sidebar-tool-menu";

const mocks = vi.hoisted(() => ({
  pathname: "",
  toggleSidebar: vi.fn(),
  toggleExtendedSidebar: vi.fn(),
  popover: undefined as { open: boolean; onOpenChange: (open: boolean) => void } | undefined,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "personal" }),
  usePathname: () => mocks.pathname,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    "aria-current": current,
  }: {
    href: string;
    children: ReactNode;
    onClick: () => void;
    "aria-current"?: "page";
  }) => (
    <a
      href={href}
      aria-current={current}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("@makeplane/propel/components/popover", () => ({
  Popover: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => {
    mocks.popover = { open, onOpenChange };
    return <div data-open={open}>{children}</div>;
  },
  PopoverTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button" onClick={() => mocks.popover?.onOpenChange(!mocks.popover.open)}>
      {children}
    </button>
  ),
  PopoverContent: ({ children, side }: { children: ReactNode; side: string }) =>
    mocks.popover?.open ? <div data-side={side}>{children}</div> : null,
}));
vi.mock("@/components/sidebar/sidebar-navigation", () => ({
  SidebarNavItem: ({ children, isActive }: { children: ReactNode; isActive: boolean }) => (
    <span data-active={isActive}>{children}</span>
  ),
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

const trigger = () => host.querySelector("button")!;

it("opens a flyout to the right with Notepad and Whiteboard, and closes it after choosing one", async () => {
  mocks.pathname = "/personal/home";
  await act(() => root.render(<SidebarToolMenu />));
  expect(trigger().textContent).toBe("Tools");
  expect(trigger().querySelector("svg.lucide-grid2x2")).not.toBeNull();
  expect(host.querySelector("a")).toBeNull();
  await act(async () => trigger().click());
  expect(host.querySelector("[data-side]")?.getAttribute("data-side")).toBe("right");
  expect(Array.from(host.querySelectorAll("a")).map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Notepad", "/personal/tool/pages/"],
    ["Whiteboard", "/personal/tool/whiteboards/"],
  ]);
  await act(async () => host.querySelector("a")!.click());
  expect(host.querySelector("a")).toBeNull();
  expect(mocks.toggleExtendedSidebar).toHaveBeenCalledWith(false);
});

it.each([
  ["/personal/tool/shared-whiteboards/owner/board", "Whiteboard"],
  ["/personal/tool/whiteboards/board", "Whiteboard"],
  ["/personal/tool/pages/page", "Notepad"],
])("highlights Tools and the current tool for %s", async (pathname, activeLabel) => {
  mocks.pathname = pathname;
  await act(() => root.render(<SidebarToolMenu />));
  expect(host.querySelector('[data-active="true"]')?.textContent).toBe("Tools");
  await act(async () => trigger().click());
  expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe(activeLabel);
});
