/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { HeaderFilters } from "@/components/issues/filters";
import { IssuesHeader } from "@/components/issues/header";
import { ProjectOverviewHeader } from "./overview-header";

const mocks = vi.hoisted(() => ({
  canCreate: true,
  initialized: false,
  fetchFilters: vi.fn(),
  updateFilters: vi.fn(),
  create: vi.fn(),
  toast: vi.fn(),
  count: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/breadcrumb", () => {
  return {
    Breadcrumbs: Object.assign(({ children }: { children: ReactNode }) => <nav>{children}</nav>, {
      Item: ({ component }: { component: ReactNode }) => component,
    }),
  };
});
vi.mock("@plane/blocks/layout", () => {
  return {
    Header: Object.assign(({ children }: { children: ReactNode }) => <header>{children}</header>, {
      LeftItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      RightItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    }),
  };
});
vi.mock("@/components/core/app-header", () => ({
  AppHeader: ({ header, mobileHeader }: { header: ReactNode; mobileHeader: ReactNode }) => (
    <>
      {header}
      {mobileHeader}
    </>
  ),
}));
vi.mock("@/components/breadcrumbs/common", () => ({
  CommonProjectBreadcrumbs: ({ projectId }: { projectId: string }) => <span>Project {projectId}</span>,
}));
vi.mock("@/components/common/breadcrumb-link", () => ({
  BreadcrumbLink: ({ label, href }: { label: string; href: string }) => <a href={href}>{label}</a>,
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    currentProjectDetails: { id: "project", name: "Launch", task_summary: { total: 7 } },
    getPartialProjectById: () => ({ name: "Launch" }),
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => mocks.canCreate }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleCreateIssueModal: mocks.create }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issues: { getGroupIssueCount: mocks.count },
    issuesFilter: {
      issueFilters: { displayFilters: { layout: "list" } },
      get initialized() {
        return mocks.initialized;
      },
      getIssueFilters() {
        return this.initialized ? {} : undefined;
      },
      fetchFilters: mocks.fetchFilters,
      updateFilters: mocks.updateFilters,
    },
  }),
}));
vi.mock("@/components/analytics/work-items/modal", () => ({
  WorkItemsModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog">
        <button onClick={onClose}>Close analytics</button>
      </div>
    ) : null,
}));
vi.mock("@/components/work-item-filters/filters-toggle", () => ({
  WorkItemFiltersToggle: () => <button>Existing filters</button>,
}));
vi.mock("@/components/issues/issue-layouts/filters", () => ({
  LayoutSelection: ({
    layouts,
    onChange,
  }: {
    layouts: EIssueLayoutTypes[];
    onChange: (layout: EIssueLayoutTypes) => void;
  }) => (
    <>
      {layouts.map((layout) => (
        <button key={layout} onClick={() => onChange(layout)}>
          {layout}
        </button>
      ))}
    </>
  ),
  MobileLayoutSelection: ({ onChange }: { onChange: (layout: EIssueLayoutTypes) => void }) => (
    <button onClick={() => onChange(EIssueLayoutTypes.KANBAN)}>Mobile layout</button>
  ),
  FiltersDropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DisplayFiltersSelection: ({
    handleDisplayFiltersUpdate,
    handleDisplayPropertiesUpdate,
  }: {
    handleDisplayFiltersUpdate: (filters: { group_by: "state" }) => void;
    handleDisplayPropertiesUpdate: (properties: { priority: boolean }) => void;
  }) => (
    <>
      <button onClick={() => handleDisplayFiltersUpdate({ group_by: "state" })}>Existing display</button>
      <button onClick={() => handleDisplayPropertiesUpdate({ priority: true })}>Existing properties</button>
    </>
  ),
}));

function Location() {
  return <output>{useLocation().pathname}</output>;
}

describe("project overview header", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canCreate = true;
    mocks.initialized = false;
    mocks.count.mockReturnValue(99);
    mocks.fetchFilters.mockResolvedValue(undefined);
    mocks.updateFilters.mockResolvedValue(undefined);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  async function render(node: ReactNode = <ProjectOverviewHeader workspaceSlug="workspace" projectId="project" />) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/workspace/projects/project/overview"]}>
          <Routes>
            <Route
              path="/:workspaceSlug/projects/:projectId/:view"
              element={
                <>
                  {node}
                  <Location />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });
  }
  function button(label: string) {
    const result = [...host.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === label || node.getAttribute("aria-label") === label
    );
    if (!result) throw new Error(`Missing button ${label}`);
    return result;
  }
  async function click(label: string) {
    await act(async () => button(label).click());
  }
  function toolbar(navigateToIssues = true) {
    return (
      <HeaderFilters
        workspaceSlug="workspace"
        projectId="project"
        currentProjectDetails={undefined}
        canUserCreateIssue={mocks.canCreate}
        navigateToIssues={navigateToIssues}
      />
    );
  }

  it("shows the project and Overview breadcrumb, actual total, and creation control", async () => {
    await render();
    expect(host.textContent).toContain("Project project");
    expect(host.querySelector('a[href="/workspace/projects/project/overview/"]')?.textContent).toBe("common.overview");
    expect(host.textContent).toContain("7");
    expect(mocks.count).not.toHaveBeenCalled();
    await click("issue.add.label");
    expect(mocks.create).toHaveBeenCalledWith(true, EIssuesStoreType.PROJECT);
  });

  it("includes desktop and mobile controls and opens analytics without navigation", async () => {
    await render();
    expect(host.querySelectorAll('[aria-label="common.filters"]')).toHaveLength(2);
    expect(host.querySelectorAll('[aria-label="common.analytics"]')).toHaveLength(2);
    await click("common.analytics");
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector("output")?.textContent).toBe("/workspace/projects/project/overview");
    await click("Close analytics");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it("preserves permission gating for guests on desktop and mobile", async () => {
    mocks.canCreate = false;
    await render();
    expect(host.textContent).not.toContain("issue.add.label");
    expect(host.querySelector('[aria-label="common.analytics"]')).toBeNull();
    expect(host.querySelector('[aria-label="common.filters"]')).not.toBeNull();
  });

  it.each(
    Object.values(EIssueLayoutTypes).filter((layout) =>
      ["list", "kanban", "calendar", "spreadsheet", "gantt"].includes(layout)
    )
  )("initializes filters, saves %s, and then opens Work items", async (layout) => {
    await render(toolbar());
    await click(layout);
    expect(mocks.fetchFilters).toHaveBeenCalledWith("workspace", "project");
    expect(mocks.updateFilters).toHaveBeenCalledWith("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, {
      layout,
    });
    expect(mocks.fetchFilters.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateFilters.mock.invocationCallOrder[0]
    );
    expect(host.querySelector("output")?.textContent).toBe("/workspace/projects/project/issues");
  });

  it("uses initialized filters for mobile layout selection", async () => {
    mocks.initialized = true;
    await render(toolbar());
    await click("Mobile layout");
    expect(mocks.fetchFilters).not.toHaveBeenCalled();
    expect(mocks.updateFilters).toHaveBeenCalledWith("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, {
      layout: "kanban",
    });
    expect(host.querySelector("output")?.textContent).toBe("/workspace/projects/project/issues");
  });

  it.each(["common.filters", "common.display"])(
    "opens Work items from %s without changing saved preferences",
    async (label) => {
      await render(toolbar());
      await click(label);
      expect(host.querySelector("output")?.textContent).toBe("/workspace/projects/project/issues");
      expect(mocks.updateFilters).not.toHaveBeenCalled();
    }
  );

  it.each(["fetch", "update"])("reports layout %s errors and stays on Overview", async (stage) => {
    const error = new Error("Network failed");
    if (stage === "fetch") mocks.fetchFilters.mockRejectedValue(error);
    else mocks.updateFilters.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await render(toolbar());
    await click("kanban");
    expect(log).toHaveBeenCalledWith("Could not open the selected work item layout", error);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(host.querySelector("output")?.textContent).toBe("/workspace/projects/project/overview");
    if (stage === "fetch") expect(mocks.updateFilters).not.toHaveBeenCalled();
  });

  it("leaves the existing Work items breadcrumb and count unchanged", async () => {
    await render(<IssuesHeader />);
    expect(host.querySelector('a[href="/workspace/projects/project/issues/"]')?.textContent).toBe("Work Items");
    expect(host.textContent).toContain("99");
    expect(mocks.count).toHaveBeenCalled();
  });

  it.each([false, true])("places layout and filter icons after the breadcrumb for Overview=%s", async (isOverview) => {
    await render(<IssuesHeader isOverview={isOverview} />);
    const navigation = host.querySelector('[aria-label="Work item layouts and filters"]');
    if (!navigation) throw new Error("Missing layout and filter group");
    expect(navigation?.textContent).toContain("kanban");
    expect(navigation?.textContent).toContain("Mobile layout");
    if (isOverview) expect(navigation?.querySelector('[aria-label="common.filters"]')).not.toBeNull();
    else expect(navigation?.textContent).toContain("Existing filters");
    expect(navigation?.textContent).not.toContain("common.display");
    expect(navigation?.querySelector('[aria-label="common.analytics"]')).toBeNull();
    const breadcrumb = host.querySelector("nav");
    expect(breadcrumb?.compareDocumentPosition(navigation)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const add = button("issue.add.label");
    expect(navigation?.parentElement?.contains(add)).toBe(false);
    expect(host.querySelectorAll('[aria-label="common.analytics"]')).toHaveLength(1);
  });

  it("leaves existing Work items layout and display behavior unchanged", async () => {
    await render(toolbar(false));
    await click("kanban");
    await click("Existing display");
    await click("Existing properties");
    expect(mocks.fetchFilters).not.toHaveBeenCalled();
    expect(mocks.updateFilters).toHaveBeenNthCalledWith(1, "workspace", "project", EIssueFilterType.DISPLAY_FILTERS, {
      layout: "kanban",
    });
    expect(mocks.updateFilters).toHaveBeenNthCalledWith(2, "workspace", "project", EIssueFilterType.DISPLAY_FILTERS, {
      group_by: "state",
    });
    expect(mocks.updateFilters).toHaveBeenNthCalledWith(
      3,
      "workspace",
      "project",
      EIssueFilterType.DISPLAY_PROPERTIES,
      { priority: true }
    );
    expect(host.querySelector("output")?.textContent).toBe("/workspace/projects/project/overview");
  });
});
