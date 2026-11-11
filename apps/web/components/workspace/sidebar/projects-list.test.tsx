import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { SidebarProjectsList } from "./projects-list";

const mocks = vi.hoisted(() => ({ limited: true, pathname: "/team/projects/one/overview" }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => mocks.pathname,
}));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ Logo: () => <svg data-project-icon /> }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleCreateProjectModal: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => true }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ isExtendedProjectSidebarOpened: false, toggleExtendedProjectSidebar: vi.fn() }),
}));
vi.mock("@/hooks/use-navigation-preferences", () => ({
  useProjectNavigationPreferences: () => ({
    preferences: { showLimitedProjects: mocks.limited, limitedProjectsCount: 1 },
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    joinedProjectIds: ["one", "two"],
    getPartialProjectById: (id: string) => ({ id, name: `Project ${id}`, logo_props: {} }),
  }),
}));
vi.mock("@/components/project/create-project-modal", () => ({ CreateProjectModal: () => null }));
vi.mock("./projects-list-item", () => ({ SidebarProjectsListItem: () => <div data-project-row /> }));
vi.mock("@makeplane/propel/components/collapsible", () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

it.each([true, false])("keeps project icon links, current selection and project limit (limited: %s)", (limited) => {
  mocks.limited = limited;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <SidebarProjectsList compact />
    </MemoryRouter>
  );
  const allProjects = host.querySelector('a[aria-label="projects"]');
  expect(allProjects?.parentElement?.classList.contains("gap-3")).toBe(true);
  const project = host.querySelector('a[aria-label="Project one"]');
  expect(allProjects?.getAttribute("href")).toBe("/team/projects/");
  expect(allProjects?.querySelector("svg")).not.toBeNull();
  expect(project?.getAttribute("href")).toBe("/team/projects/one/overview/");
  expect(project?.getAttribute("title")).toBe("Project one");
  expect(project?.textContent).toBe("");
  expect(project?.querySelector("[data-project-icon]")).not.toBeNull();
  expect(project?.firstElementChild?.classList.contains("bg-[#EAF2FF]")).toBe(true);
  expect(host.querySelectorAll("[data-project-icon]")).toHaveLength(limited ? 1 : 2);
});

it("matches expanded project and creation row gaps to the main menu", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <SidebarProjectsList />
    </MemoryRouter>
  );
  const list = host.querySelector("[data-project-row]")?.parentElement;
  expect(list?.classList.contains("gap-3")).toBe(true);
  expect(list?.classList.contains("pt-3")).toBe(true);
  expect(list?.textContent).toContain("Create a project");
});
