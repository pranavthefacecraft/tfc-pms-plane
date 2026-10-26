import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS } from "@plane/constants";
import { SidebarItemBase } from "./sidebar-item";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "Inbox" }) }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => "/team/notifications/",
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
vi.mock("@/components/sidebar/sidebar-navigation", () => ({
  SidebarNavItem: ({ children, isActive }: { children: ReactNode; isActive: boolean }) => (
    <div data-active={isActive}>{children}</div>
  ),
}));

it("renders an unpinned Inbox link with the workspace URL, active state and unread badge", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <SidebarItemBase
        item={WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS["inbox"]}
        additionalStaticItems={["inbox"]}
        additionalRender={(key, slug) => <span>{key === "inbox" && slug === "team" ? "3 unread" : ""}</span>}
      />
    </MemoryRouter>
  );
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/team/notifications/");
  expect(host.querySelector('[data-active="true"]')).not.toBeNull();
  expect(host.textContent).toContain("Inbox");
  expect(host.textContent).toContain("3 unread");
});
