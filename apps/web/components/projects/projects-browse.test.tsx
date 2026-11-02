/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TProject } from "@plane/types";
import { ProjectsBrowse } from "./projects-browse";
import { browseProjects, initials, lastModifiedLabel } from "./projects-browse.helpers";

const mocks = vi.hoisted(() => ({
  projects: {} as Record<string, TProject>,
  canCreate: true,
  push: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ Logo: () => null }));
vi.mock("@/components/project/create-project-modal", () => ({
  CreateProjectModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Create project</div> : null),
}));
vi.mock("@/components/project/join-project-modal", () => ({
  JoinProjectModal: ({ project }: { project: TProject }) => <div role="dialog">Join {project.name}</div>,
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date(2025, 9, 28, 12) }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    workspaceProjectIds: Object.keys(mocks.projects),
    getProjectById: (id: string) => mocks.projects[id],
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => mocks.canCreate }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: (id: string) => ({ id, display_name: `${id} person` }) }),
}));

function project(id: string, name: string, updated: Date, extra: Partial<TProject> = {}): TProject {
  return {
    id,
    name,
    identifier: id.toUpperCase(),
    updated_at: updated,
    created_at: updated,
    member_role: 15,
    members: [],
    logo_props: {},
    archived_at: null,
    ...extra,
  } as unknown as TProject;
}

describe("projects browse helpers", () => {
  const now = new Date(2025, 9, 28, 12);

  it("labels today and earlier dates", () => {
    expect(lastModifiedLabel(new Date(2025, 9, 28, 1), now)).toBe("Today");
    expect(lastModifiedLabel(new Date(2025, 9, 26), now)).toBe("Oct 26");
    expect(lastModifiedLabel(new Date(2024, 9, 26), now)).toBe("Oct 26, 2024");
    expect(lastModifiedLabel(undefined, now)).toBe("—");
  });

  it("searches by name or identifier and sorts by last modified", () => {
    const list = [
      project("abc", "Alpha", new Date(2025, 9, 1)),
      project("web", "Website", new Date(2025, 9, 20)),
      project("app", "Mobile app", new Date(2025, 9, 10)),
    ];
    expect(browseProjects(list, "", "desc").map((p) => p.name)).toEqual(["Website", "Mobile app", "Alpha"]);
    expect(browseProjects(list, "", "asc").map((p) => p.name)).toEqual(["Alpha", "Mobile app", "Website"]);
    expect(browseProjects(list, "WEB", "desc").map((p) => p.name)).toEqual(["Website"]);
    expect(browseProjects(list, "abc", "desc").map((p) => p.name)).toEqual(["Alpha"]);
  });

  it("builds initials", () => {
    expect(initials("Jane van Doe")).toBe("JV");
    expect(initials("  ")).toBe("?");
  });
});

describe("ProjectsBrowse", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canCreate = true;
    mocks.projects = {
      web: project("web", "Website", new Date(2025, 9, 28, 9), { members: ["ann", "bob", "cat", "dan"] }),
      ops: project("ops", "Operations", new Date(2025, 9, 26), { member_role: null }),
    };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter>
          <ProjectsBrowse workspaceSlug="acme" />
        </MemoryRouter>
      )
    );
  const rowNames = () => [...host.querySelectorAll("tbody tr p:first-child")].map((node) => node.textContent);

  it("lists projects with join state, collaborators and last modified", () => {
    render();
    expect(host.querySelector("h1")?.textContent).toBe("Projects");
    expect(rowNames()).toEqual(["Website", "Operations"]);
    const [website, operations] = host.querySelectorAll("tbody tr");
    expect(website.textContent).toContain("Joined");
    expect(website.textContent).toContain("Today");
    expect(website.textContent).toContain("+2");
    expect(website.querySelector('a[href^="/acme/settings/projects/web/members"]')).not.toBeNull();
    expect(operations.textContent).toContain("Join project");
    expect(operations.textContent).toContain("Oct 26");
  });

  it("toggles the last modified sort and filters by search", () => {
    render();
    const sort = [...host.querySelectorAll("th button")].find((node) => node.textContent?.includes("Last modified"));
    act(() => (sort as HTMLButtonElement).click());
    expect(rowNames()).toEqual(["Operations", "Website"]);

    const input = host.querySelector<HTMLInputElement>('input[aria-label="Search projects"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, "oper");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rowNames()).toEqual(["Operations"]);
  });

  it("opens joined projects and asks to join the others", () => {
    render();
    const [website, operations] = host.querySelectorAll<HTMLTableRowElement>("tbody tr");
    act(() => website.click());
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/web/issues");
    act(() => operations.click());
    expect(host.textContent).toContain("Join Operations");
  });

  it("opens the create project modal and hides it without permission", () => {
    render();
    const create = [...host.querySelectorAll("button")].find((node) => node.textContent === "Create Project");
    act(() => create!.click());
    expect(host.textContent).toContain("Create project");

    mocks.canCreate = false;
    render();
    expect([...host.querySelectorAll("button")].some((node) => node.textContent === "Create Project")).toBe(false);
  });
});
