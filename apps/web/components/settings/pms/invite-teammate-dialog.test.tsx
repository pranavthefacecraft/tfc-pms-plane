/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteTeammateDialog } from "./invite-teammate-dialog";
import { SendProjectInvitationModal } from "@/components/project/send-project-invitation-modal";

const mocks = vi.hoisted(() => ({ invite: vi.fn(), workspaceInvite: vi.fn(), refreshed: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { inviteMembersToWorkspace: mocks.workspaceInvite } }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    workspaceProjectIds: ["p1"],
    getPartialProjectById: () => ({ id: "p1", name: "Website", member_role: 20, network: 0 }),
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ getProjectRoleByWorkspaceSlugAndProjectId: () => 20 }),
}));
vi.mock("@/services/project-collaborators.service", () => ({
  ProjectCollaboratorsService: class {
    invite = mocks.invite;
  },
}));
vi.mock("@/components/projects/invite-collaborators-dialog", () => ({
  InviteCollaboratorsDialog: ({ project }: { project: { name: string; member_role: number } }) => (
    <div role="dialog">
      Shared invitation: {project.name}, role {project.member_role}
    </div>
  ),
}));

describe("teammate invitation entry points", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invite.mockResolvedValue({ added: [], invited: ["new@acme.test"] });
    mocks.workspaceInvite.mockResolvedValue({});
    mocks.refreshed.mockResolvedValue({});
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });
  async function render() {
    await act(() =>
      root.render(<InviteTeammateDialog workspaceSlug="acme" onClose={vi.fn()} onInvited={mocks.refreshed} />)
    );
    const input = host.querySelector("input")!;
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "new@acme.test");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () =>
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
  }
  it("sends workspace-only invitations through the existing workspace API", async () => {
    await render();
    expect(host.textContent).toContain("Project access depends");
    await submit();
    expect(mocks.workspaceInvite).toHaveBeenCalledWith("acme", { emails: [{ email: "new@acme.test", role: 15 }] });
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it("uses the project invitation API when a project is selected", async () => {
    await render();
    const select = host.querySelectorAll("select")[1];
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "p1");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.textContent).toContain("workspace and the selected project");
    await submit();
    expect(mocks.invite).toHaveBeenCalledWith("acme", "p1", [{ email: "new@acme.test", role: 15 }]);
    expect(mocks.workspaceInvite).not.toHaveBeenCalled();
  });
  it("opens the same collaborator popup from Project Settings", async () => {
    await act(() =>
      root.render(<SendProjectInvitationModal isOpen workspaceSlug="acme" projectId="p1" onClose={vi.fn()} />)
    );
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Shared invitation: Website, role 20");
  });
});
