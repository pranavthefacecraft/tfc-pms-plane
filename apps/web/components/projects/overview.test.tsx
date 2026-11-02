/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectOverview } from "./overview";
import { safeResourceUrl } from "@/helpers/project-overview.helper";

const mocks = vi.hoisted(() => ({
  project: {} as IProject,
  admin: true,
  fetch: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("./project-page-header", () => ({
  ProjectPageHeader: ({ name, active }: { name: string; active: string }) => <h1 data-active-tab={active}>{name}</h1>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ fetchProjectDetails: mocks.fetch, updateProject: mocks.update }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => mocks.admin }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({
      id,
      display_name: id === "owner" ? "Project Owner" : "Team Member",
      avatar_url: "",
    }),
    project: {
      fetchProjectMembers: () => Promise.resolve([]),
      getProjectMemberIds: () => ["owner", "member"],
      getProjectMemberDetails: () => ({ role: 15 }),
    },
  }),
}));

describe("project overview", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin = true;
    mocks.project = {
      id: "project",
      name: "Launch",
      identifier: "LCH",
      description: "Launch goals",
      project_lead: "owner",
      health: "",
      archived_at: null,
      overview_resources: [],
      task_summary: { total: 4, completed: 1, started: 1, cancelled: 1, overdue: 1 },
      sort_order: null,
      logo_props: { in_use: "emoji" },
      workspace: "workspace",
      cycle_view: true,
      issue_views_view: true,
      module_view: true,
      page_view: true,
      inbox_view: true,
    };
    mocks.fetch.mockImplementation(() => Promise.resolve(mocks.project));
    mocks.update.mockImplementation((_slug: string, _id: string, payload: Partial<IProject>) => {
      mocks.project = { ...mocks.project, ...payload };
      return Promise.resolve(mocks.project);
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  async function render(url = "/") {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[url]}>
          <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
            <ProjectOverview workspaceSlug="workspace" projectId="project" />
          </SWRConfig>
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
  async function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
    await act(() => {
      setter?.call(element, value);
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  }
  async function submit(form: HTMLFormElement) {
    await act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  }

  it("renders the Figma overview: header tabs, description, teammates and key resources", async () => {
    mocks.project.overview_resources = [
      { title: "Project brief", url: "https://example.com/brief", kind: "link" },
      {
        title: "brief.pdf",
        url: "https://pms.example.com/api/assets/v2/workspaces/workspace/projects/project/download/asset/",
        kind: "link",
      },
    ];
    await render();
    expect(host.querySelector("h1")?.textContent).toBe("Launch");
    expect(host.querySelector("h1")?.getAttribute("data-active-tab")).toBe("overview");
    expect(host.textContent).toContain("Project Description");
    expect(host.textContent).toContain("Launch goals");
    expect(host.textContent).toContain("Project Teammates");
    const people = [...host.querySelectorAll("section[aria-labelledby=overview-teammates] li")];
    expect(people.map((node) => node.textContent)).toEqual(["POProject OwnerProject owner", "TMTeam MemberTeammate"]);
    expect(host.querySelector('a[href^="/workspace/settings/projects/project/members"]')?.textContent).toContain(
      "Add Teammate"
    );
    expect(host.textContent).toContain("Key Resources");
    expect(host.textContent).toContain("Attached file");
    expect(host.querySelector('a[aria-label="Open Project brief"]')?.getAttribute("href")).toBe(
      "https://example.com/brief"
    );
    // Health, progress, dates and the owner picker are hidden in this layout.
    expect(host.querySelector("progress")).toBeNull();
    expect(host.querySelector("select")).toBeNull();
    expect(host.textContent).not.toContain("Project health");
  });
  it("lists the project creator as owner when no lead is set", async () => {
    mocks.project.project_lead = null;
    mocks.project.created_by = "member";
    await render();
    const people = [...host.querySelectorAll("section[aria-labelledby=overview-teammates] li")];
    expect(people.map((node) => node.textContent)).toEqual(["TMTeam MemberProject owner", "POProject OwnerTeammate"]);
  });
  it("keeps the previous layout with exact progress at ?view=classic", async () => {
    await render("/?view=classic");
    expect(host.textContent).toContain("Launch goals");
    expect(host.textContent).toContain("Project Owner");
    expect(host.textContent).toContain("Team Member");
    expect(host.textContent).toContain("25%");
    expect(host.textContent).toContain("Not set");
    expect(host.querySelector("progress")?.value).toBe(1);
    expect(host.querySelector("progress")?.max).toBe(4);
    expect(host.querySelector('a[href="/workspace/projects/project/issues/"]')).not.toBeNull();
  });
  it("edits the existing description and persists through the project API", async () => {
    await render();
    await act(() => button("Edit description").click());
    await change(host.querySelector("textarea")!, "Updated scope");
    await submit(host.querySelector("form")!);
    expect(mocks.update).toHaveBeenCalledWith("workspace", "project", { description: "Updated scope" });
    expect(host.textContent).toContain("Updated scope");
    expect(host.querySelector("textarea")).toBeNull();
  });
  it("retains a failed description draft and allows retry", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.update.mockRejectedValueOnce(new Error("Offline"));
    await render();
    await act(() => button("Edit description").click());
    await change(host.querySelector("textarea")!, "Keep this draft");
    await submit(host.querySelector("form")!);
    expect(host.querySelector("textarea")?.value).toBe("Keep this draft");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    await submit(host.querySelector("form")!);
    expect(host.querySelector("textarea")).toBeNull();
    expect(errorLog).toHaveBeenCalled();
  });
  it("updates health and owner through the same project API", async () => {
    await render("/?view=classic");
    await change(host.querySelector('select[aria-label="Project health"]')!, "at_risk");
    expect(mocks.update).toHaveBeenLastCalledWith("workspace", "project", { health: "at_risk" });
    await change(host.querySelector('select[aria-label="Project owner"]')!, "member");
    expect(mocks.update).toHaveBeenLastCalledWith("workspace", "project", { project_lead: "member" });
  });
  it("adds a whiteboard resource and removes only its project link", async () => {
    await render();
    await act(() => button("Add resource").click());
    await change(host.querySelector("select:not([aria-label])")!, "whiteboard");
    await change(host.querySelector("#overview-resource-title")!, "Planning board");
    await change(host.querySelector("#overview-resource-url")!, "https://example.com/tool/whiteboards/board");
    await submit(host.querySelector("form")!);
    expect(mocks.update).toHaveBeenCalledWith("workspace", "project", {
      overview_resources: [
        { title: "Planning board", url: "https://example.com/tool/whiteboards/board", kind: "whiteboard" },
      ],
    });
    expect(host.querySelector('a[href="https://example.com/tool/whiteboards/board"]')?.getAttribute("rel")).toBe(
      "noopener noreferrer"
    );
    await act(() => button("Remove Planning board").click());
    expect(mocks.update).toHaveBeenLastCalledWith("workspace", "project", { overview_resources: [] });
  });
  it.each(["guest/member", "archived"])("keeps %s projects read-only", async (mode) => {
    if (mode === "archived") mocks.project.archived_at = "2026-01-01";
    else mocks.admin = false;
    await render();
    expect(host.querySelector("button")).toBeNull();
    expect(host.querySelector("select")).toBeNull();
    expect(host.textContent).toContain("Launch goals");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("shows a recoverable loading error rather than empty success", async () => {
    mocks.fetch.mockRejectedValue(new Error("Offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
    expect(button("Retry")).toBeDefined();
  });
  it("rejects executable and malformed resource URLs", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "/relative", "bad"]) {
      expect(safeResourceUrl(url)).toBeUndefined();
    }
    expect(safeResourceUrl("https://example.com/board")).toBe("https://example.com/board");
  });
  it("shows truthful empty-project progress without assuming a healthy status", async () => {
    mocks.project.task_summary = { total: 0, completed: 0, started: 0, cancelled: 0, overdue: 0 };
    await render("/?view=classic");
    expect(host.textContent).toContain("0%");
    expect(host.textContent).toContain("Not set");
    expect(host.querySelector("progress")?.value).toBe(0);
  });
  it("rejects duplicate resources without sending a write request", async () => {
    mocks.project.overview_resources = [{ title: "Existing", url: "https://example.com/brief", kind: "link" }];
    await render();
    await act(() => button("Add resource").click());
    await change(host.querySelector("#overview-resource-title")!, "Duplicate");
    await change(host.querySelector("#overview-resource-url")!, "https://example.com/brief");
    await submit(host.querySelector("form")!);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("already linked");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps resource drafts available after a failed save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.update.mockRejectedValueOnce(new Error("Offline"));
    await render();
    await act(() => button("Add resource").click());
    await change(host.querySelector("#overview-resource-title")!, "Keep this resource");
    await change(host.querySelector("#overview-resource-url")!, "https://example.com/brief");
    await submit(host.querySelector("form")!);
    expect(host.querySelector<HTMLInputElement>("#overview-resource-title")?.value).toBe("Keep this resource");
    expect(host.querySelector<HTMLInputElement>("#overview-resource-url")?.value).toBe("https://example.com/brief");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
