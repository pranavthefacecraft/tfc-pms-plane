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
vi.mock("./sidebar-toggle-button", () => ({ AppSidebarToggleButton: () => null }));
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
  const community = host.querySelector("button");
  expect(community?.textContent).toBe("Community");
  expect(community?.parentElement?.hidden).toBe(true);
  expect(community?.parentElement?.classList.contains("hidden")).toBe(true);
  expect(host.querySelector("a")?.closest("[hidden]")).toBeNull();
});
