import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DashboardWidgets } from "./home-dashboard-widgets";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => "/team/",
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-home", () => ({
  useHome: () => ({
    toggleWidgetSettings: vi.fn(),
    showWidgetSettings: false,
    orderedWidgets: ["quick_links", "recents"],
    widgetsMap: { quick_links: { is_enabled: true }, recents: { is_enabled: true } },
    loading: false,
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ loader: "loaded" }) }));
vi.mock("@/components/empty-state/simple-empty-state-root", () => ({ SimpleEmptyState: () => null }));
vi.mock("./widgets", () => ({
  HomeLoader: () => null,
  RecentActivityWidget: () => <div data-testid="recents">Recent activity retained</div>,
}));
vi.mock("./widgets/links", () => ({
  DashboardQuickLinks: () => <button data-testid="quick-links">Add quick Link</button>,
}));
vi.mock("./widgets/manage", () => ({ ManageWidgetsModal: () => null }));
vi.mock("./widgets/my-tasks/root", () => ({
  MyTasksWidget: () => <section data-testid="my-tasks" />,
}));

it("hides Quicklinks, Recents and the My Tasks widget without unmounting them", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<DashboardWidgets />);
  for (const id of ["quick-links", "recents", "my-tasks"]) {
    const widget = host.querySelector(`[data-testid="${id}"]`);
    expect(widget).not.toBeNull();
    expect(widget?.closest("[hidden]")).not.toBeNull();
  }
});
