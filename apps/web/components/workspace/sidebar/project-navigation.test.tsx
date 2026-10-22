/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { ProjectNavigation } from "./project-navigation";

const mocks = vi.hoisted(() => ({
  role: 20,
  views: true,
  permissions: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleExtended: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getPartialProjectById: () => ({
      id: "project",
      cycle_view: true,
      module_view: true,
      issue_views_view: mocks.views,
      inbox_view: false,
    }),
  }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({
    isExtendedProjectSidebarOpened: true,
    toggleExtendedProjectSidebar: mocks.toggleExtended,
    toggleSidebar: mocks.toggleSidebar,
  }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueIdByIdentifier: () => undefined, getIssueById: () => undefined } }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: mocks.permissions }),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.views = true;
  mocks.permissions.mockImplementation((roles: number[]) => roles.includes(mocks.role));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(path = "/workspace/projects/project/overview") {
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <ProjectNavigation workspaceSlug="workspace" projectId="project" />
      </MemoryRouter>
    )
  );
}

it.each([EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST])(
  "places Settings immediately below Views for role %s",
  async (role) => {
    mocks.role = role;
    await render();
    const links = [...host.querySelectorAll("a")];
    const views = links.findIndex((link) => link.textContent === "sidebar.views");
    expect(views).toBeGreaterThanOrEqual(0);
    expect(links[views + 1].textContent).toBe("settings");
    expect(links[views + 1].getAttribute("href")).toBe("/workspace/settings/projects/project/");
    expect(links[views + 1].querySelector("svg")).not.toBeNull();
    expect(mocks.permissions).toHaveBeenCalledWith(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
      EUserPermissionsLevel.PROJECT,
      "workspace",
      "project"
    );
  }
);

it("keeps Settings available when Views is disabled and highlights nested settings", async () => {
  mocks.role = EUserPermissions.ADMIN;
  mocks.views = false;
  await render("/workspace/settings/projects/project/custom-fields");
  const settings = host.querySelector('a[href="/workspace/settings/projects/project/"]');
  expect(settings?.textContent).toBe("settings");
  expect(settings?.firstElementChild?.className).toContain("bg-[#EAF2FF]");
  expect(settings?.firstElementChild?.className).toContain("border-[#CBDCF8]");
  expect(host.textContent).not.toContain("sidebar.views");
});

it("preserves mobile and extended sidebar closing when opening Settings", async () => {
  mocks.role = EUserPermissions.MEMBER;
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(500);
  await render();
  await act(() => host.querySelector<HTMLAnchorElement>('a[href="/workspace/settings/projects/project/"]')?.click());
  expect(mocks.toggleSidebar).toHaveBeenCalledOnce();
  expect(mocks.toggleExtended).toHaveBeenCalledWith(false);
});
