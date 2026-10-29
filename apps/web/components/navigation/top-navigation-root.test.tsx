import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { TopNavigationRoot } from "./top-navigation-root";

const counts = vi.hoisted(() => ({ mention_unread_notifications_count: 0, total_unread_notifications_count: 3 }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => "/team/notifications/",
}));
vi.mock("swr", () => ({ default: () => ({}) }));
vi.mock("@/hooks/store/notifications", () => ({
  useWorkspaceNotifications: () => ({ unreadNotificationsCount: counts, getUnreadNotificationsCount: vi.fn() }),
}));
vi.mock("@/hooks/use-navigation-preferences", () => ({
  useAppRailPreferences: () => ({ preferences: { displayMode: "icon" } }),
}));
vi.mock("@/components/navigation", () => ({ TopNavPowerK: () => <input aria-label="Search" /> }));
vi.mock("./create-menu", () => ({ TopNavCreateMenu: () => <button>Create</button> }));
vi.mock("@/components/workspace/sidebar/user-menu-root", () => ({
  UserMenuRoot: () => <button>Profile</button>,
}));
vi.mock("@/components/workspace/sidebar/workspace-menu-root", () => ({
  WorkspaceMenuRoot: () => <button>Workspace</button>,
}));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/sidebar/sidebar-item", () => ({
  AppSidebarItem: ({ item }: { item: { href: string; icon: ReactNode; isActive: boolean } }) => (
    <a href={item.href} data-active={item.isActive}>
      {item.icon}
    </a>
  ),
}));

it.each([0, 3])("retains hidden Create and shows the notification bell with unread count %s", (unread) => {
  counts.total_unread_notifications_count = unread;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <TopNavigationRoot showWorkspaceMenu={false} />
    </MemoryRouter>
  );
  const create = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Create");
  expect(host.firstElementChild?.classList.contains("py-4")).toBe(true);
  expect(host.firstElementChild?.classList.contains("shrink-0")).toBe(true);
  expect(host.firstElementChild?.classList.contains("bg-[#ffffff]")).toBe(true);
  expect(host.firstElementChild?.classList.contains("border-b")).toBe(true);
  expect(host.firstElementChild?.classList.contains("border-[#E2E6EF]")).toBe(true);
  expect(create).toBeDefined();
  expect(create?.parentElement?.hidden).toBe(true);
  expect(create?.parentElement?.classList.contains("hidden")).toBe(true);
  const notification = host.querySelector('a[href="/team/notifications/"]');
  expect(notification?.querySelector("svg.lucide-bell")).not.toBeNull();
  expect(notification?.getAttribute("aria-current")).toBe("page");
  expect(notification?.classList.contains("rounded-lg")).toBe(true);
  expect(notification?.classList.contains("border")).toBe(true);
  expect(notification?.querySelector("span") !== null).toBe(unread > 0);
  expect(notification?.closest("[hidden]")).toBeNull();
  expect(host.querySelector("input")?.closest("[hidden]")).toBeNull();
});
