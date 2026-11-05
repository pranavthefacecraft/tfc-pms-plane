/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TProject } from "@plane/types";
import { InviteCollaboratorsDialog } from "./invite-collaborators-dialog";
import { accessNote, accessRoleLabel } from "./invite-collaborators.helpers";

const mocks = vi.hoisted(() => ({
  invite: vi.fn(),
  fetchMembers: vi.fn(),
  fetchWorkspace: vi.fn(),
  fetchProject: vi.fn(),
  copy: vi.fn(),
  toast: vi.fn(),
  members: ["me", "eve"] as string[],
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/utils", () => ({ copyUrlToClipboard: mocks.copy }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me", display_name: "Pat Owner", email: "me@acme.test" } }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ fetchProjectDetails: mocks.fetchProject }) }));
const people: Record<string, { name: string; role: number }> = {
  me: { name: "Pat Owner", role: 20 },
  eve: { name: "Eve Stone", role: 15 },
  ann: { name: "Ann Lee", role: 15 },
  boss: { name: "Workspace Admin", role: 20 },
};
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({ id, display_name: people[id].name, email: `${id}@acme.test` }),
    workspace: {
      workspaceMemberIds: Object.keys(people),
      getWorkspaceMemberDetails: (id: string) => ({ id, role: people[id].role, is_active: true }),
      fetchWorkspaceMembers: mocks.fetchWorkspace,
    },
    project: {
      fetchProjectMembers: mocks.fetchMembers,
      getProjectMemberIds: () => mocks.members,
      getProjectMemberDetails: (id: string) => ({ role: id === "me" ? 20 : 15 }),
    },
  }),
}));
vi.mock("@/services/project-collaborators.service", () => ({
  ProjectCollaboratorsService: class {
    invite = mocks.invite;
  },
}));

const PROJECT = { id: "p1", name: "Website", member_role: 20, created_by: "me", network: 0 } as unknown as TProject;

describe("invite collaborators helpers", () => {
  it("labels the creator as Owner and others by project role", () => {
    expect(accessRoleLabel("me", "me", 20)).toBe("Owner");
    expect(accessRoleLabel("eve", "me", 15)).toBe("Editor");
    expect(accessRoleLabel("gus", "me", 5)).toBe("Viewer");
    expect(accessRoleLabel("x", undefined, undefined)).toBe("Member");
  });

  it("describes who can open the project", () => {
    expect(accessNote(0)).toBe("Only invited teammates can open this project");
    expect(accessNote(2)).toBe("Everyone in the workspace can open this project");
  });
});

describe("InviteCollaboratorsDialog", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.members = ["me", "eve"];
    mocks.fetchMembers.mockResolvedValue([]);
    mocks.fetchWorkspace.mockResolvedValue([]);
    mocks.fetchProject.mockResolvedValue({});
    mocks.invite.mockResolvedValue({ added: ["ann@acme.test"], invited: [] });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = async (project: TProject = PROJECT) => {
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <InviteCollaboratorsDialog workspaceSlug="acme" project={project} onClose={vi.fn()} />
        </SWRConfig>
      )
    );
  };
  const type = (value: string) =>
    act(() => {
      const input = host.querySelector<HTMLInputElement>("#invite-collaborators-input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

  it("shows people with access and the access note", async () => {
    await render();
    expect(host.querySelector("h2")?.textContent).toBe("Invite Collaborators");
    const rows = [...host.querySelectorAll("li")].map((row) => row.textContent);
    expect(rows).toEqual(["PPat OwnerOwner", "EEve StoneEditor"]);
    expect(host.textContent).toContain("Only invited teammates can open this project");
  });

  it("adds a workspace member to the project and refreshes the members", async () => {
    await render();
    await type("ann");
    const option = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Ann Lee"))!;
    await act(async () => option.click());
    expect(mocks.invite).toHaveBeenCalledWith("acme", "p1", [{ email: "ann@acme.test", role: 15 }]);
    expect(mocks.fetchProject).toHaveBeenCalledWith("acme", "p1");
    expect(mocks.fetchMembers).toHaveBeenCalledTimes(2);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Collaborator added" }));
  });

  it("loads the workspace roster and searches by email", async () => {
    await render();
    expect(mocks.fetchWorkspace).toHaveBeenCalledWith("acme");
    await type("ann@acme.test");
    expect(host.querySelector('ul[aria-label="Suggestions"]')?.textContent).toContain("Ann Lee");
    expect(host.textContent).not.toContain("Invite ann@acme.test");
  });

  it("allows viewer invitations", async () => {
    await render();
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Project role"]')!;
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "5");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await type("ann");
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Ann Lee"))!.click()
    );
    expect(mocks.invite).toHaveBeenCalledWith("acme", "p1", [{ email: "ann@acme.test", role: 5 }]);
  });

  it("sends an accepted role for workspace admins, whose admin role is enforced by the backend", async () => {
    await render();
    await type("boss@acme.test");
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Workspace Admin"))!.click()
    );
    expect(mocks.invite).toHaveBeenCalledWith("acme", "p1", [{ email: "boss@acme.test", role: 15 }]);
  });

  it("reports an invitation failure without claiming success", async () => {
    mocks.invite.mockRejectedValue(new Error("Forbidden"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render();
    await type("new@acme.test");
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Invite new@acme.test")!.click()
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not add this teammate");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    vi.restoreAllMocks();
  });

  it("does not suggest current members and invites new emails", async () => {
    mocks.invite.mockResolvedValue({ added: [], invited: ["new@acme.test"] });
    await render();
    await type("eve");
    expect(host.textContent).toContain("No teammates found");
    await type("new@acme.test");
    const invite = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Invite new@acme.test"
    )!;
    await act(async () => invite.click());
    expect(mocks.invite).toHaveBeenCalledWith("acme", "p1", [{ email: "new@acme.test", role: 15 }]);
    expect(host.textContent).toContain("Invited");
  });

  it("copies the project link and hides the invite box for non-admins", async () => {
    await render({ ...PROJECT, member_role: 15 } as TProject);
    expect(host.querySelector("#invite-collaborators-input")).toBeNull();
    expect(host.textContent).toContain("Only project admins can invite collaborators.");
    const copy = [...host.querySelectorAll("button")].find((button) => button.textContent === "Copy project link")!;
    await act(async () => copy.click());
    expect(mocks.copy).toHaveBeenCalledWith("acme/projects/p1/overview");
  });
});
