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
vi.mock("./sidebar-tool-menu", () => ({ SidebarToolMenu: () => <div>Tools</div> }));
vi.mock("./pms-settings-link", () => ({
  PMSSettingsLink: () => <a href="/team/pms-settings/account">PMS Settings</a>,
}));
vi.mock("./quick-actions", () => ({ SidebarQuickActions: () => <button>New work item</button> }));

it.each([false, true])("keeps menu spacing consistent and workspace navigation hidden (compact: %s)", (compact) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<SidebarMenuItems compact={compact} />);
  const personal = host.firstElementChild;
  const settings = personal?.lastElementChild;
  const tools = settings?.previousElementSibling;
  const hiddenSection = personal?.nextElementSibling;
  const action = hiddenSection?.firstElementChild;
  expect(personal?.classList.contains("flex-col")).toBe(true);
  expect(personal?.classList.contains("gap-3")).toBe(true);
  expect(tools?.parentElement).toBe(personal);
  expect(settings?.parentElement).toBe(personal);
  expect(tools?.textContent).toBe("Tools");
  expect(settings?.textContent).toBe("PMS Settings");
  expect(settings?.closest("[hidden]")).toBeNull();
  expect(personal?.querySelectorAll("a").length).toBeGreaterThan(1);
  expect(action?.textContent).toBe("New work item");
  expect(action?.nextElementSibling?.textContent).toContain("common.workspace");
  expect(hiddenSection?.hasAttribute("hidden")).toBe(true);
  expect(hiddenSection?.classList.contains("hidden")).toBe(true);
  expect(tools?.closest("[hidden]")).toBeNull();
  expect(host.querySelector('a[href="/projects"]')?.closest("[hidden]")).toBe(hiddenSection);
  expect(host.querySelector("#extended-sidebar-toggle")?.closest("[hidden]")).toBe(hiddenSection);
  expect(host.querySelectorAll("button").length).toBe(2);
});

it("retains Inbox and Drafts but hides only their sidebar entries", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<SidebarMenuItems />);
  const personalLinks = Array.from(host.firstElementChild?.querySelectorAll(":scope > div > a") ?? []);
  expect(personalLinks.slice(0, 2).map((link) => link.textContent)).toEqual(["home", "inbox"]);
  expect(personalLinks.filter((link) => link.textContent === "inbox")).toHaveLength(1);
  for (const key of ["inbox", "drafts"]) {
    const link = host.querySelector(`a[href="/${key}"]`);
    expect(link).not.toBeNull();
    expect(link?.parentElement?.hidden).toBe(true);
    expect(link?.parentElement?.classList.contains("hidden")).toBe(true);
  }
  const visibleLinks = personalLinks.filter((link) => !link.closest("[hidden]"));
  expect(visibleLinks.map((link) => link.textContent)).toEqual(["home", "your_work"]);
});
