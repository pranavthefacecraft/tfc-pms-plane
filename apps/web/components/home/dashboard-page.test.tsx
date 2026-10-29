import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import WorkspaceDashboardPage from "@/app/(all)/[workspaceSlug]/(projects)/page";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ currentWorkspace: { name: "Team" } }),
}));
vi.mock("@/components/core/app-header", () => ({
  AppHeader: ({ header }: { header: ReactNode }) => <header>{header}</header>,
}));
vi.mock("@/components/core/content-wrapper", () => ({
  ContentWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/home", () => ({ WorkspaceHomeView: () => <div>Dashboard widgets</div> }));
vi.mock("@/app/(all)/[workspaceSlug]/(projects)/header", () => ({
  WorkspaceDashboardHeader: () => (
    <div>
      Activity <button>Manage widgets</button>
    </div>
  ),
}));

it("retains the dashboard header hidden without hiding dashboard content", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<WorkspaceDashboardPage />);
  const header = host.querySelector("header");
  expect(header?.textContent).toContain("Activity");
  expect(header?.querySelector("button")?.textContent).toBe("Manage widgets");
  expect(header?.parentElement?.hidden).toBe(true);
  expect(header?.parentElement?.classList.contains("hidden")).toBe(true);
  expect(host.querySelector("main")?.textContent).toBe("Dashboard widgets");
  expect(host.querySelector("main")?.closest("[hidden]")).toBeNull();
});
