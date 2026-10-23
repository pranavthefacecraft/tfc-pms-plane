import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProjectLayout, { handle } from "@/app/(all)/[workspaceSlug]/(projects)/layout";
import { WorkspaceContentWrapper } from "./content-wrapper";

const mocks = vi.hoisted(() => ({ collapsed: false }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ sidebarCollapsed: mocks.collapsed }),
}));
vi.mock("@/lib/app-rail", () => ({ useAppRailVisibility: () => ({ shouldRenderAppRail: false }) }));
vi.mock("@/components/navigation", () => ({ AppRailRoot: () => null }));
vi.mock("@/components/navigation/top-navigation-root", () => ({
  TopNavigationRoot: ({ showWorkspaceMenu = true }: { showWorkspaceMenu?: boolean }) => (
    <header data-testid="top-navigation">{showWorkspaceMenu && <button>Workspace</button>}</header>
  ),
}));
vi.mock("@/components/power-k/projects-app-provider", () => ({ ProjectsAppPowerKProvider: () => null }));
vi.mock("@/app/(all)/[workspaceSlug]/(projects)/_sidebar", () => ({
  ProjectAppSidebar: () => <aside data-testid="sidebar">Sidebar</aside>,
}));
vi.mock("@/app/(all)/[workspaceSlug]/(projects)/extended-project-sidebar", () => ({
  ExtendedProjectSidebar: () => null,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.collapsed = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  router.dispose();
  host.remove();
  vi.unstubAllGlobals();
});

async function render(path: string) {
  router = createMemoryRouter(
    [
      {
        path: "/:workspaceSlug",
        element: (
          <WorkspaceContentWrapper>
            <Outlet />
          </WorkspaceContentWrapper>
        ),
        children: [
          {
            element: <ProjectLayout />,
            handle,
            children: [
              { index: true, element: <div>Home content</div> },
              { path: "notifications", element: <div>Inbox content</div> },
            ],
          },
          { path: "settings", element: <div>Settings content</div> },
        ],
      },
    ],
    { initialEntries: [path] }
  );
  await act(() => root.render(<RouterProvider router={router} />));
}

it("puts exactly one top bar in the main content, beside the full-height sidebar", async () => {
  await render("/workspace");
  const topBar = host.querySelector('[data-testid="top-navigation"]');
  const sidebar = host.querySelector('[data-testid="sidebar"]');
  expect(host.querySelectorAll('[data-testid="top-navigation"]')).toHaveLength(1);
  expect(topBar?.parentElement?.tagName).toBe("MAIN");
  expect(sidebar?.parentElement).toBe(topBar?.parentElement?.parentElement);
  expect(topBar?.querySelector("button")).toBeNull();
  expect(host.textContent).toContain("Home content");
});

it.each(["collapsed", "notifications"])("retains workspace switching when sidebar is %s", async (state) => {
  mocks.collapsed = state === "collapsed";
  await render(state === "notifications" ? "/workspace/notifications" : "/workspace");
  expect(host.querySelectorAll('[data-testid="top-navigation"]')).toHaveLength(1);
  expect(host.querySelector("header button")?.textContent).toBe("Workspace");
});

it("preserves the outer top bar for settings layouts", async () => {
  await render("/workspace/settings");
  expect(host.querySelectorAll('[data-testid="top-navigation"]')).toHaveLength(1);
  expect(host.querySelector("header button")?.textContent).toBe("Workspace");
  expect(host.querySelector("main")).toBeNull();
  expect(host.textContent).toContain("Settings content");
});

it.each(["/workspace", "/workspace/settings"])("removes outer left, right and bottom gutters on %s", async (path) => {
  await render(path);
  const wrapper = host.querySelector(".flex-grow");
  expect(wrapper).not.toBeNull();
  expect(wrapper?.className).not.toMatch(/\b(?:p|px|py|pl|pr|pb)-/);
});
