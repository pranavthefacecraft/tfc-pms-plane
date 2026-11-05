/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, MemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectSettingsLayout, {
  handle,
} from "@/app/(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/layout";
import { WorkspaceContentWrapper } from "@/components/workspace/content-wrapper";
import { SettingsSidebarItem } from "@/components/settings/sidebar/item";

const mocks = vi.hoisted(() => ({ back: vi.fn(), path: "" }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ Logo: () => <span>Project icon</span> }));
vi.mock("@makeplane/propel/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@makeplane/propel/components/icon-button", () => ({
  IconButton: ({ onClick, "aria-label": label }: { onClick: () => void; "aria-label": string }) => (
    <button aria-label={label} onClick={onClick} />
  ),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ getProjectRoleByWorkspaceSlugAndProjectId: () => 20 }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ currentWorkspace: { slug: "team" } }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getPartialProjectById: () => ({ name: "Rafw Res", logo_props: {} }) }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.back }) }));
vi.mock("@/lib/app-rail", () => ({ useAppRailVisibility: () => ({ shouldRenderAppRail: false }) }));
vi.mock("@/components/navigation", () => ({ AppRailRoot: () => null }));
vi.mock("@/components/navigation/top-navigation-root", () => ({
  TopNavigationRoot: ({ showWorkspaceMenu = true }: { showWorkspaceMenu?: boolean }) => (
    <header>
      {showWorkspaceMenu && <button>Old workspace menu</button>}
      <input aria-label="Search commands" />
      <button>Notifications</button>
      <button>Profile and workspaces</button>
    </header>
  ),
}));
vi.mock("@/layouts/auth-layout/project-wrapper", () => ({
  ProjectAuthWrapper: ({
    children,
    projectId,
    workspaceSlug,
  }: {
    children: ReactNode;
    projectId: string;
    workspaceSlug: string;
  }) => (
    <div data-auth-project={projectId} data-auth-workspace={workspaceSlug}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/settings/mobile/nav", () => ({
  SettingsMobileNav: () => <button>Toggle settings menu</button>,
}));
vi.mock("./sidebar/item-categories", () => ({
  ProjectSettingsSidebarItemCategories: () => <nav>Existing project settings navigation</nav>,
}));

describe("cosmetic project settings shell", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let router: ReturnType<typeof createMemoryRouter>;
  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    router.dispose();
    host.remove();
  });
  async function render(suffix: string) {
    mocks.path = `/team/settings/projects/p1/${suffix}`;
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
              path: "settings/projects/:projectId",
              element: <ProjectSettingsLayout params={{ workspaceSlug: "team", projectId: "p1" }} />,
              handle,
              children: [
                { index: true, element: <button>Update project</button> },
                { path: "members", element: <button>Add member</button> },
                { path: "features/cycles", element: <button>Enable cycles</button> },
                { path: "features/modules", element: <button>Enable modules</button> },
              ],
            },
          ],
        },
      ],
      { initialEntries: [mocks.path] }
    );
    await act(() => root.render(<RouterProvider router={router} />));
  }
  it.each([
    ["", "Update project"],
    ["members", "Add member"],
    ["features/cycles", "Enable cycles"],
    ["features/modules", "Enable modules"],
  ])("preserves page content and auth while displaying the PMS shell on %s", async (suffix, action) => {
    await render(suffix);
    expect(host.querySelectorAll("header")).toHaveLength(1);
    expect(host.textContent).not.toContain("Old workspace menu");
    expect(host.textContent).toContain("Profile and workspaces");
    expect(host.textContent).toContain(action);
    expect(host.querySelector('[data-auth-project="p1"][data-auth-workspace="team"]')).not.toBeNull();
    expect(host.querySelector('img[alt="PMS by Clevdex"]')?.getAttribute("src")).toBe("/clevdex-pms-lockup.svg");
    expect(host.textContent).toContain("Existing project settings navigation");
    await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Back to project"]')!.click());
    expect(mocks.back).toHaveBeenCalledWith("/team/projects/p1/issues/");
  });
  it("keeps existing sidebar links and changes only the selected appearance", async () => {
    await render("");
    await act(() =>
      root.render(
        <MemoryRouter>
          <SettingsSidebarItem
            as="link"
            href="/team/settings/projects/p1/members/"
            isActive
            appearance="pms"
            label="Members"
            iconNode={<span>Icon</span>}
          />
        </MemoryRouter>
      )
    );
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/team/settings/projects/p1/members/");
    expect(host.querySelector("a")?.className).toContain("bg-[#EAF2FF]");
  });
});
