/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PMSSettings } from "./settings";
import { InviteTeammateDialog } from "./invite-teammate-dialog";
import { PMSSettingsLink } from "@/components/workspace/sidebar/pms-settings-link";

const mocks = vi.hoisted(() => ({
  role: 20,
  invite: vi.fn(),
  projectInvite: vi.fn(),
  refresh: vi.fn(),
  onClose: vi.fn(),
  pathname: "/team/pms-settings/account",
  error: undefined as Error | undefined,
  updateUser: vi.fn(),
  user: { first_name: "Test", last_name: "Person", email: "test@example.com" },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => mocks.pathname,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/settings/profile/content/pages/general", () => ({
  GeneralProfileSettings: () => <div>Existing profile form</div>,
}));
vi.mock("@/components/settings/profile/content/pages/security", () => ({
  SecurityProfileSettings: () => <div>Existing password form</div>,
}));
vi.mock("@/components/workspace/settings/members-list", () => ({
  WorkspaceMembersList: () => <div>Existing teammate list</div>,
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: mocks.user, updateCurrentUser: mocks.updateUser }),
  useUserPermissions: () => ({
    workspaceInfoBySlug: () => ({ role: mocks.role }),
    allowPermissions: (roles: number[]) => roles.includes(mocks.role),
  }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: { is_smtp_configured: true } }) }));
vi.mock("@/components/core/modals/change-email-modal", () => ({
  ChangeEmailModal: () => <div role="dialog">Verified email change</div>,
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    workspace: {
      inviteMembersToWorkspace: mocks.invite,
      fetchWorkspaceMembers: vi.fn(),
      fetchWorkspaceMemberInvitations: vi.fn(),
      getWorkspaceMemberIds: () => ["admin", "editor", "viewer", "inactive"],
      getWorkspaceMemberDetails: (id: string) => ({
        id,
        member: { first_name: id, last_name: "Person", email: `${id}@example.com` },
        role: id === "admin" ? 20 : id === "editor" ? 15 : 5,
        is_active: id !== "inactive",
      }),
    },
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    workspaceProjectIds: ["p1", "p2"],
    getPartialProjectById: (id: string) => ({
      id,
      name: id === "p1" ? "Website" : "Restricted",
      member_role: id === "p1" ? 20 : 15,
    }),
  }),
}));
vi.mock("@/services/project-collaborators.service", () => ({
  ProjectCollaboratorsService: class {
    invite = mocks.projectInvite;
  },
}));
vi.mock("swr", () => ({
  default: () => ({ data: [], isLoading: false, error: mocks.error, mutate: mocks.refresh }),
}));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.role = 20;
  mocks.error = undefined;
  mocks.pathname = "/team/pms-settings/account";
  mocks.invite.mockResolvedValue({});
  mocks.projectInvite.mockResolvedValue({ added: [], invited: ["test@example.com"] });
  mocks.refresh.mockResolvedValue([]);
  mocks.user = { first_name: "Test", last_name: "Person", email: "test@example.com" };
  mocks.updateUser.mockResolvedValue(mocks.user);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = (node: ReactNode) => act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
const button = (text: string) => [...host.querySelectorAll("button")].find((item) => item.textContent === text);
async function enter(selector: string, value: string) {
  const node = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  await act(() => {
    const prototype = node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLInputElement ? "input" : "change", { bubbles: true }));
  });
}
const submit = () =>
  act(() => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
const inviteDialog = () =>
  render(<InviteTeammateDialog workspaceSlug="team" onClose={mocks.onClose} onInvited={mocks.refresh} />);

it("renders full-page account settings with real profile and password surfaces and URL tabs", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  expect(host.querySelector("h1")?.textContent).toBe("Settings");
  expect(host.querySelector<HTMLInputElement>("#pms-account-name")?.value).toBe("Test Person");
  expect(host.querySelector<HTMLInputElement>("#pms-account-email")?.readOnly).toBe(true);
  expect(host.textContent).not.toContain("Existing profile form");
  expect(host.textContent).toContain("Two-step verification");
  expect(host.textContent).toContain("Login history unavailable");
  expect(host.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/team/pms-settings/account/");
  expect(host.querySelector('a[href="/team/pms-settings/teammates/"]')).not.toBeNull();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it("saves the name and cancels unsaved changes without writing email", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  await enter("#pms-account-name", "Updated Person");
  await submit();
  expect(mocks.updateUser).toHaveBeenCalledWith({ first_name: "Updated", last_name: "Person" });
  await enter("#pms-account-name", "Discard This");
  await act(() => button("Cancel")!.click());
  expect(host.querySelector<HTMLInputElement>("#pms-account-name")?.value).toBe("Test Person");
});
it("preserves multi-word first names and exposes the existing security and verified email controls", async () => {
  mocks.user = { first_name: "Test First", last_name: "Person", email: "test@example.com" };
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  await enter("#pms-account-name", "New First Person");
  await submit();
  expect(mocks.updateUser).toHaveBeenCalledWith({ first_name: "New First", last_name: "Person" });
  await act(() => button("Change Password")!.click());
  expect(host.textContent).toContain("Existing password form");
  await act(() => button("Change email")!.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("Verified email change");
});
it("reports save failures and retains the unsaved name", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.updateUser.mockRejectedValueOnce(new Error("offline"));
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  await enter("#pms-account-name", "Updated Person");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
  expect(host.querySelector<HTMLInputElement>("#pms-account-name")?.value).toBe("Updated Person");
  log.mockRestore();
});
it.each(["account", "teammates"])("links the sidebar to settings and highlights %s", async (tab) => {
  mocks.pathname = `/team/pms-settings/${tab}`;
  await render(<PMSSettingsLink />);
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/team/pms-settings/account/");
  expect(host.querySelector("a")?.getAttribute("aria-current")).toBe("page");
});
it("shows teammates and opens the invite form for admins only", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  expect(host.textContent).toContain("Existing teammate list");
  const list = host.querySelector('ul[aria-label="People with access"]');
  expect(list?.querySelectorAll("li")).toHaveLength(3);
  expect(list?.textContent).toContain("admin@example.com");
  expect(list?.textContent).toContain("Admin");
  expect(list?.textContent).toContain("Editor");
  expect(list?.textContent).toContain("Viewer");
  expect(list?.textContent).not.toContain("inactive@example.com");
  expect(host.querySelector('input[aria-label="Search teammates"]')?.closest("details")).not.toBeNull();
  await act(() => button("Invite Teammates")!.click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
});
it("does not offer invitations to members or the teammate list to guests", async () => {
  mocks.role = 15;
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  expect(button("Invite Teammates")).toBeUndefined();
  mocks.role = 5;
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Only workspace admins and members");
  expect(host.textContent).not.toContain("Existing teammate list");
});
it("shows a retry action when loading teammates fails", async () => {
  mocks.error = new Error("offline");
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  await act(() => button("Retry")!.click());
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("invites to the workspace with the chosen role", async () => {
  await inviteDialog();
  await enter('input[type="email"]', "test@example.com");
  await enter("select", "5");
  await submit();
  expect(mocks.invite).toHaveBeenCalledWith("team", { emails: [{ email: "test@example.com", role: 5 }] });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.onClose).toHaveBeenCalledOnce();
});
it("offers only administered projects and invites using the project access endpoint", async () => {
  await inviteDialog();
  expect(host.textContent).not.toContain("Restricted");
  await enter('input[type="email"]', "test@example.com");
  await enter("label:last-of-type select", "p1");
  await submit();
  expect(mocks.projectInvite).toHaveBeenCalledWith("team", "p1", [{ email: "test@example.com", role: 15 }]);
  expect(mocks.invite).not.toHaveBeenCalled();
});
it("does not send an invitation again if refreshing fails after sending", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.refresh.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
  await inviteDialog();
  await enter('input[type="email"]', "test@example.com");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("invitation was sent");
  await submit();
  expect(mocks.invite).toHaveBeenCalledOnce();
  expect(mocks.onClose).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
