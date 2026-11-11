import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS } from "@plane/constants";
import { SidebarItemBase } from "./sidebar-item";

const route = vi.hoisted(() => ({ pathname: "/team/" }));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => (key === "activity" ? "Activity" : key) }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => route.pathname,
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user" } }),
  useUserPermissions: () => ({ allowPermissions: () => true }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleSidebar: vi.fn(), isExtendedSidebarOpened: false, toggleExtendedSidebar: vi.fn() }),
}));
vi.mock("@/hooks/use-navigation-preferences", () => ({
  useWorkspaceNavigationPreferences: () => ({ isWorkspaceItemPinned: () => false }),
}));

it.each([true, false])("preserves the dashboard route with Activity styling (active: %s)", (active) => {
  route.pathname = active ? "/team/" : "/team/projects/";
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <SidebarItemBase item={WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS["home"]} />
    </MemoryRouter>
  );
  const link = host.querySelector("a");
  const row = link?.firstElementChild;
  expect(link?.getAttribute("href")).toBe("/team/");
  expect(link?.textContent).toBe("Activity");
  expect(link?.querySelector("svg.lucide-activity")).not.toBeNull();
  expect(row?.classList.contains("hover:text-[#135DDD]")).toBe(true);
  expect(row?.classList.contains("hover:bg-[#EAF2FF]")).toBe(true);
  expect(row?.classList.contains("text-[#135DDD]")).toBe(active);
  expect(row?.classList.contains("bg-[#EAF2FF]")).toBe(active);
});

it("labels personal work My tasks without changing its profile route", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <SidebarItemBase item={WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS["your-work"]} />
    </MemoryRouter>
  );
  expect(host.querySelector("a")?.textContent).toBe("My tasks");
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/team/profile/user/");
  expect(host.querySelector("svg.lucide-list")).not.toBeNull();
});

it.each(["home", "your-work"])("keeps %s accessible as an icon-only link", (key) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <SidebarItemBase compact item={WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS[key]} />
    </MemoryRouter>
  );
  const link = host.querySelector("a");
  expect(link?.textContent).toBe("");
  expect(link?.querySelector("svg")).not.toBeNull();
  expect(link?.getAttribute("aria-label")).toBe(key === "home" ? "Activity" : "My tasks");
  expect(link?.getAttribute("title")).toBe(link?.getAttribute("aria-label"));
  expect(link?.getAttribute("href")).toBe(key === "home" ? "/team/" : "/team/profile/user/");
});
