/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtendedAppHeader } from "@/components/common/extended-app-header";
import type { TWorkspacePage, TWorkspacePageListParams } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGES_SWR_KEY } from "./helpers";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  boards: [] as TWorkspacePage[],
  mode: "ACCORDION",
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ sidebarCollapsed: true }),
}));
vi.mock("@/hooks/use-navigation-preferences", () => ({
  useProjectNavigationPreferences: () => ({ preferences: { navigationMode: mocks.mode } }),
}));
vi.mock("@/components/sidebar/sidebar-toggle-button", () => ({
  AppSidebarToggleButton: () => <button>Toggle sidebar</button>,
}));
vi.mock("@/services/page/workspace-page.service", () => ({
  WorkspacePageService: class {
    list = mocks.list;
  },
}));

function page(id: string, name = "Project brief", overrides: Partial<TWorkspacePage> = {}): TWorkspacePage {
  return {
    id,
    name,
    tool_type: "page",
    access: 0,
    logo_props: {},
    owned_by: "owner",
    owner: null,
    updated_by: null,
    workspace: "workspace",
    created_at: "2026-10-20",
    updated_at: "2026-10-20",
    attachment: { entity_type: "project", project_id: "project", issue_id: null, is_accessible: true },
    ...overrides,
  };
}

function Revalidate() {
  const { mutate } = useSWRConfig();
  return <button onClick={() => void mutate(WORKSPACE_PAGES_SWR_KEY("workspace"))}>Refresh Notepad</button>;
}

function RevalidateBoards() {
  const { mutate } = useSWRConfig();
  return (
    <button onClick={() => void mutate(WORKSPACE_PAGES_SWR_KEY("workspace", "whiteboard"))}>Refresh boards</button>
  );
}

describe("project header page shortcuts", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mode = "ACCORDION";
    mocks.boards = [];
    mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
      Promise.resolve(params.type === "whiteboard" ? mocks.boards : [page("brief")])
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  async function render(path = "/workspace/projects/project/overview", extra?: ReactNode) {
    await act(async () => {
      root.render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route
                path="/:workspaceSlug/projects/:projectId/:view"
                element={<ExtendedAppHeader header={<div>Project breadcrumb and actions</div>} />}
              />
              <Route path="/:workspaceSlug/tool/pages" element={<ExtendedAppHeader header={<div>Notepad</div>} />} />
            </Routes>
            {extra}
          </MemoryRouter>
        </SWRConfig>
      );
    });
  }

  it.each(["overview", "issues", "cycles", "settings"])("shows an icon and named page link on %s", async (view) => {
    await render(`/workspace/projects/project/${view}`);
    expect(mocks.list).toHaveBeenCalledWith("workspace", { type: "page" });
    const link = host.querySelector('nav[aria-label="Project pages and whiteboards"] a');
    expect(link?.getAttribute("href")).toBe("/workspace/tool/pages/brief/");
    expect(link?.textContent).toBe("Project brief");
    expect(link?.querySelector("svg")).not.toBeNull();
    expect(host.textContent).toContain("Project breadcrumb and actions");
  });

  it("excludes task resources, other projects, and inaccessible attachments", async () => {
    const resources = [
      page("direct"),
      page("task", "Task page", {
        attachment: { entity_type: "issue", project_id: "project", issue_id: "task", is_accessible: true },
      }),
      page("other", "Other project", {
        attachment: { entity_type: "project", project_id: "other", issue_id: null, is_accessible: true },
      }),
      page("restricted", "Restricted", {
        attachment: { entity_type: "project", project_id: "project", issue_id: null, is_accessible: false },
      }),
      page("unattached", "Unattached", { attachment: null }),
    ];
    mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
      Promise.resolve(
        params.type === "whiteboard"
          ? resources.map((item) => ({ ...item, id: `board-${item.id}`, tool_type: "whiteboard" }))
          : resources
      )
    );
    await render();
    expect(host.querySelectorAll("nav a")).toHaveLength(2);
    expect(host.querySelector("nav a")?.textContent).toBe("Project brief");
  });

  it("does not fetch or show project shortcuts outside projects", async () => {
    await render("/workspace/tool/pages");
    expect(mocks.list).not.toHaveBeenCalled();
    expect(host.querySelector("nav")).toBeNull();
  });

  it("does not add an empty navigation area when no pages are attached", async () => {
    mocks.list.mockResolvedValue([]);
    await render();
    expect(host.querySelector("nav")).toBeNull();
  });

  it("uses Untitled for blank names and keeps full long names in titles", async () => {
    const longName = "A very long project documentation page name ".repeat(8);
    mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
      Promise.resolve(params.type === "whiteboard" ? [] : [page("blank", "  "), page("long", longName)])
    );
    await render();
    const links = host.querySelectorAll("nav a");
    expect(links[0].textContent).toBe("Untitled");
    expect(links[1].getAttribute("title")).toBe(longName.trim());
    expect(links[1].querySelector("span")?.className).toContain("truncate");
    expect(host.querySelector("nav")?.className).toContain("overflow-x-auto");
  });

  it("shows shortcuts in tabbed navigation without duplicating the sidebar toggle", async () => {
    mocks.mode = "TABBED";
    await render();
    expect(host.querySelector("nav a")).not.toBeNull();
    expect(host.textContent).not.toContain("Toggle sidebar");
  });

  it("refreshes after attachment, rename, and detach using the shared Notepad cache", async () => {
    await render(undefined, <Revalidate />);
    async function refresh(pages: TWorkspacePage[]) {
      mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
        Promise.resolve(params.type === "whiteboard" ? mocks.boards : pages)
      );
      await act(async () => {
        const button = [...host.querySelectorAll("button")].find((node) => node.textContent === "Refresh Notepad");
        button?.click();
      });
    }
    await refresh([page("brief", "Renamed"), page("new", "Newly attached")]);
    expect(host.querySelectorAll("nav a")).toHaveLength(2);
    expect(host.querySelector("nav")?.textContent).toContain("Renamed");
    await refresh([]);
    expect(host.querySelector("nav")).toBeNull();
  });

  it("shows explicit failure and supports retry", async () => {
    mocks.list.mockRejectedValue(new Error("Offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not refresh pages or whiteboards.");
    mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
      Promise.resolve(params.type === "whiteboard" ? [] : [page("recovered")])
    );
    await act(async () => {
      [...host.querySelectorAll("button")].find((node) => node.textContent === "Retry")?.click();
    });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector("nav a")?.getAttribute("href")).toContain("recovered");
  });

  it("shows directly attached whiteboards with their own icon and route", async () => {
    mocks.boards = [page("board", "Planning board", { tool_type: "whiteboard" })];
    await render();
    expect(mocks.list).toHaveBeenCalledWith("workspace", { type: "whiteboard" });
    const links = host.querySelectorAll("nav a");
    expect(links).toHaveLength(2);
    expect(links[1].getAttribute("href")).toBe("/workspace/tool/whiteboards/board/");
    expect(links[1].textContent).toBe("Planning board");
    expect(links[1].querySelector("svg")?.innerHTML).not.toBe(links[0].querySelector("svg")?.innerHTML);
  });

  it("refreshes whiteboard attachment, rename, and removal independently of Notepad", async () => {
    await render(undefined, <RevalidateBoards />);
    async function refresh(boards: TWorkspacePage[]) {
      mocks.boards = boards;
      await act(async () => {
        [...host.querySelectorAll("button")].find((node) => node.textContent === "Refresh boards")?.click();
      });
    }
    await refresh([page("board", "New board", { tool_type: "whiteboard" })]);
    expect(host.querySelector("nav")?.textContent).toContain("New board");
    await refresh([page("board", "Renamed board", { tool_type: "whiteboard" })]);
    expect(host.querySelector("nav")?.textContent).toContain("Renamed board");
    await refresh([]);
    expect(host.querySelectorAll("nav a")).toHaveLength(1);
    expect(host.querySelector("nav")?.textContent).toContain("Project brief");
  });

  it("retains page links when whiteboards fail and recovers on retry", async () => {
    mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
      params.type === "whiteboard" ? Promise.reject(new Error("Offline")) : Promise.resolve([page("brief")])
    );
    await render();
    expect(host.querySelector("nav a")?.textContent).toBe("Project brief");
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    mocks.list.mockImplementation((_slug: string, params: TWorkspacePageListParams) =>
      Promise.resolve(
        params.type === "whiteboard" ? [page("board", "Board", { tool_type: "whiteboard" })] : [page("brief")]
      )
    );
    await act(async () => {
      [...host.querySelectorAll("button")].find((node) => node.textContent === "Retry")?.click();
    });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelectorAll("nav a")).toHaveLength(2);
  });
});
