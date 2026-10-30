import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { WorkspaceHomeView } from "./root";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "team" }) }));
vi.mock("swr", () => ({ default: () => ({}) }));
vi.mock("@plane/blocks/layout", () => ({
  ContentWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/hooks/store/use-home", () => ({ useHome: () => ({ fetchWidgets: vi.fn() }) }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me" } }),
  useUserProfile: () => ({ data: { is_tour_completed: true } }),
}));
vi.mock("@/components/onboarding/tour/root", () => ({ TourRoot: () => null }));
vi.mock("@/components/issues/peek-overview/peek-overviews", () => ({
  HomePeekOverviewsRoot: () => <div data-testid="peek" />,
}));
vi.mock("./activity-overview", () => ({ ActivityOverview: () => <section data-testid="overview" /> }));
vi.mock("./home-dashboard-widgets", () => ({ DashboardWidgets: () => <section data-testid="widgets" /> }));
vi.mock("./user-greetings", () => ({ UserGreetingsView: () => <div data-testid="greeting" /> }));

it("shows Overview and dashboard widgets without the greeting, preserving task peek", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<WorkspaceHomeView />);
  const sections = Array.from(host.querySelectorAll("main [data-testid]")).map((element) =>
    element.getAttribute("data-testid")
  );
  expect(sections).toEqual(["overview", "widgets"]);
  expect(host.querySelector('[data-testid="peek"]')).not.toBeNull();
});
