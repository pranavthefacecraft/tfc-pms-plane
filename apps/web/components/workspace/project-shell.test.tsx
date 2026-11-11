import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectShell } from "./project-shell";

const mocks = vi.hoisted(() => ({ collapsed: false, pathname: "", toggle: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => mocks.pathname,
}));
vi.mock("@plane/hooks", () => ({
  useLocalStorage: () => ({ storedValue: 250, setValue: vi.fn() }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({
    sidebarCollapsed: mocks.collapsed,
    toggleSidebar: mocks.toggle,
    sidebarPeek: false,
    toggleSidebarPeek: vi.fn(),
    isExtendedSidebarOpened: false,
    isAnySidebarDropdownOpen: false,
  }),
}));
vi.mock("@/components/sidebar/resizable-sidebar", () => ({
  ResizableSidebar: ({
    children,
    isCollapsed,
    width,
    collapsedContent,
  }: {
    children: ReactNode;
    isCollapsed: boolean;
    width: number;
    collapsedContent: ReactNode;
  }) => (
    <aside data-testid="sidebar" data-collapsed={isCollapsed} data-width={width}>
      {isCollapsed ? collapsedContent : children}
    </aside>
  ),
}));
vi.mock("@/app/(all)/[workspaceSlug]/(projects)/sidebar", () => ({
  AppSidebar: ({ compact }: { compact?: boolean }) => <nav data-compact={!!compact}>Workspace navigation</nav>,
}));
vi.mock("@/app/(all)/[workspaceSlug]/(projects)/extended-sidebar", () => ({
  ExtendedAppSidebar: () => null,
}));
vi.mock("@/app/(all)/[workspaceSlug]/(projects)/extended-project-sidebar", () => ({
  ExtendedProjectSidebar: () => null,
}));
vi.mock("@/components/power-k/projects-app-provider", () => ({
  ProjectsAppPowerKProvider: () => null,
}));
vi.mock("@/components/navigation/top-navigation-root", () => ({
  TopNavigationRoot: ({
    showWorkspaceMenu,
    showSidebarToggle,
  }: {
    showWorkspaceMenu: boolean;
    showSidebarToggle?: boolean;
  }) => (
    <header data-workspace-switcher={showWorkspaceMenu} data-sidebar-toggle={showSidebarToggle}>
      Top bar
    </header>
  ),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.collapsed = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it.each(["/team/notifications/", "/team/notifications/item/", "/team/"])(
  "renders workspace navigation alongside page content at %s",
  async (pathname) => {
    mocks.pathname = pathname;
    await act(() =>
      root.render(
        <MemoryRouter initialEntries={[pathname]}>
          <ProjectShell>
            <section>Inbox list and content</section>
          </ProjectShell>
        </MemoryRouter>
      )
    );
    expect(host.querySelector("nav")?.textContent).toBe("Workspace navigation");
    expect(host.querySelector('[data-testid="sidebar"]')?.getAttribute("data-width")).toBe("250");
    expect(host.querySelector("main section")?.textContent).toBe("Inbox list and content");
    expect(host.querySelector("header")?.getAttribute("data-workspace-switcher")).toBe("false");
  }
);

it("keeps compact sidebar navigation instead of the old workspace switcher when collapsed", async () => {
  mocks.pathname = "/team/notifications/";
  mocks.collapsed = true;
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={[mocks.pathname]}>
        <ProjectShell>
          <section>Inbox</section>
        </ProjectShell>
      </MemoryRouter>
    )
  );
  expect(host.querySelector('[data-testid="sidebar"]')?.getAttribute("data-collapsed")).toBe("true");
  expect(host.querySelector("nav")?.getAttribute("data-compact")).toBe("true");
  expect(host.querySelector("header")?.getAttribute("data-workspace-switcher")).toBe("false");
  expect(host.querySelector("header")?.getAttribute("data-sidebar-toggle")).toBe("true");
  expect(host.querySelector("main section")?.textContent).toBe("Inbox");
});
