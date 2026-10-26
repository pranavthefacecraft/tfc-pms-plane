import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SidebarMenuItems } from "./sidebar-menu-items";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ isExtendedSidebarOpened: false, toggleExtendedSidebar: vi.fn() }),
}));
vi.mock("@/components/workspace-notifications/notification-app-sidebar-option", () => ({
  NotificationAppSidebarOption: () => <span>Unread</span>,
}));
vi.mock("@/hooks/use-local-storage", () => ({ default: () => ({ storedValue: true, setValue: vi.fn() }) }));
vi.mock("@/hooks/use-navigation-preferences", () => ({
  usePersonalNavigationPreferences: () => ({
    preferences: { items: { drafts: { enabled: true, sort_order: 0 }, your_work: { enabled: true, sort_order: 1 } } },
  }),
  useWorkspaceNavigationPreferences: () => ({ preferences: { items: {} } }),
}));
vi.mock("@makeplane/propel/components/collapsible", () => ({
  Collapsible: ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
    <section>
      {trigger}
      {children}
    </section>
  ),
}));
vi.mock("./sidebar-item", () => ({
  SidebarItemBase: ({ item }: { item: { key: string } }) => <a href={`/${item.key}`}>{item.key}</a>,
}));
vi.mock("./sidebar-tool-menu", () => ({ SidebarToolMenu: () => <div>Tool</div> }));
vi.mock("./quick-actions", () => ({ SidebarQuickActions: () => <button>New work item</button> }));

it("places creation after personal links and before Workspace", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<SidebarMenuItems />);
  const personal = host.firstElementChild;
  const action = personal?.nextElementSibling;
  expect(personal?.querySelectorAll("a").length).toBeGreaterThan(1);
  expect(action?.textContent).toBe("New work item");
  expect(action?.nextElementSibling?.textContent).toContain("common.workspace");
  expect(host.querySelectorAll("button").length).toBe(2);
});

it("always lists Inbox directly after Home, ahead of optional personal links", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<SidebarMenuItems />);
  const personalLinks = Array.from(host.firstElementChild?.querySelectorAll("a") ?? []);
  expect(personalLinks.slice(0, 2).map((link) => link.textContent)).toEqual(["home", "inbox"]);
  expect(personalLinks.filter((link) => link.textContent === "inbox")).toHaveLength(1);
});
