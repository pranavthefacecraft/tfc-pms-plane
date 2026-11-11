/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SidebarWrapper } from "./sidebar-wrapper";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/hooks", () => ({ useOutsideClickDetector: () => undefined }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleSidebar: () => undefined, sidebarCollapsed: false }),
}));
vi.mock("@/hooks/use-window-size", () => ({ default: () => [1200, 800] }));
vi.mock("@/components/navigation/customize-navigation-dialog", () => ({ CustomizeNavigationDialog: () => null }));
vi.mock("./sidebar-toggle-button", () => ({
  AppSidebarToggleButton: () => <button data-testid="sidebar-toggle">Toggle sidebar</button>,
}));
vi.mock("./sidebar-footer", () => ({ SidebarFooter: () => <footer>Help Center and Logout Account</footer> }));
vi.mock("@makeplane/propel/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/workspace/edition-badge", () => ({
  WorkspaceEditionBadge: () => <button>Community</button>,
}));

it("retains the Community button inside a hidden footer without hiding navigation", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <SidebarWrapper title="Workspace">
      <a href="/projects">Projects</a>
    </SidebarWrapper>
  );
  const community = host.querySelector("[hidden] button");
  expect(community?.textContent).toBe("Community");
  expect(community?.parentElement?.hidden).toBe(true);
  expect(community?.parentElement?.classList.contains("hidden")).toBe(true);
  expect(host.querySelector("a")?.closest("[hidden]")).toBeNull();
  expect(host.querySelector('img[alt="PMS by Clevdex"]')).toBeNull();
  expect(host.querySelectorAll('[data-testid="sidebar-toggle"]')).toHaveLength(1);
  expect(host.querySelector("span")?.parentElement?.querySelector('[data-testid="sidebar-toggle"]')).not.toBeNull();
});

it("keeps the expand control, scrollable icon navigation and footer in compact mode", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <SidebarWrapper compact title="Projects" header={<button>Workspace</button>}>
      <a href="/projects" aria-label="Projects">
        <svg />
      </a>
    </SidebarWrapper>
  );
  expect(host.querySelector("[data-sidebar-compact]")).not.toBeNull();
  expect(host.querySelectorAll('[data-testid="sidebar-toggle"]')).toHaveLength(1);
  expect(host.querySelector("nav")?.classList.contains("overflow-y-auto")).toBe(true);
  expect(host.querySelector("a")?.closest("[hidden]")).toBeNull();
  expect(host.querySelector("footer")).not.toBeNull();
  expect(host.querySelector("img")).toBeNull();
  expect(host.textContent).not.toContain("Workspace");
});

it("retains the hidden workspace switcher without hiding the logo, toggle or navigation", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <SidebarWrapper
      title="Projects"
      header={<button data-testid="workspace-switcher">Workspace</button>}
      quickActions={<button data-testid="create">New work item</button>}
    >
      <a href="/projects">Projects</a>
    </SidebarWrapper>
  );
  const header = host.querySelector('[data-testid="workspace-switcher"]');
  const logo = host.querySelector('img[alt="PMS by Clevdex"]');
  const create = host.querySelector('[data-testid="create"]');
  const navigation = host.querySelector("a");
  const toggle = host.querySelector('[data-testid="sidebar-toggle"]');
  expect(header).not.toBeNull();
  expect(logo?.getAttribute("src")).toBe("/clevdex-pms-lockup.svg");
  expect(logo?.getAttribute("width")).toBe("184");
  expect(logo?.getAttribute("height")).toBe("40");
  expect(create).not.toBeNull();
  expect(navigation).not.toBeNull();
  if (!logo || !header || !create || !navigation) throw new Error("Sidebar logo, header, action or navigation missing");
  expect(logo.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(logo.closest("button, a")).toBeNull();
  expect(logo.parentElement?.classList.contains("bg-white")).toBe(true);
  expect(host.querySelectorAll('[data-testid="sidebar-toggle"]')).toHaveLength(1);
  expect(toggle?.parentElement?.previousElementSibling).toBe(logo.parentElement);
  expect(toggle?.parentElement?.parentElement?.classList.contains("flex")).toBe(true);
  expect(toggle?.parentElement?.classList.contains("shrink-0")).toBe(true);
  expect(header.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(create.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(header.parentElement?.hidden).toBe(true);
  expect(header.parentElement?.classList.contains("hidden")).toBe(true);
  expect(logo.closest("[hidden]")).toBeNull();
  expect(toggle?.closest("[hidden]")).toBeNull();
  expect(create.closest("[hidden]")).toBeNull();
  expect(navigation.closest("[hidden]")).toBeNull();
  expect(host.querySelector("footer")?.closest("[hidden]")).toBeNull();
  expect(
    navigation.compareDocumentPosition(host.querySelector("footer")!) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  const heading = Array.from(host.querySelectorAll("span")).find((element) => element.textContent === "Projects");
  const customize = host.querySelector('button[aria-label="customize_navigation"]');
  expect(heading?.parentElement?.hidden).toBe(true);
  expect(heading?.parentElement?.classList.contains("hidden")).toBe(true);
  expect(customize).not.toBeNull();
  expect(customize?.closest("[hidden]")).toBe(heading?.parentElement);
});
