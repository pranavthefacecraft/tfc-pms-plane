/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions } from "@plane/constants";
import { TopNavCreateMenu } from "./create-menu";

const state = vi.hoisted(() => ({
  role: 20,
  projects: ["project-1"],
  creating: false,
  issue: vi.fn(),
  project: vi.fn(),
  page: vi.fn(),
  whiteboard: vi.fn(),
  invite: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleCreateIssueModal: state.issue, toggleCreateProjectModal: state.project }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ joinedProjectIds: state.projects }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { inviteMembersToWorkspace: state.invite } }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: (roles: number[]) => roles.includes(state.role) }),
}));
vi.mock("@/components/workspace-pages/use-create-page", () => ({
  useCreateWorkspacePage: (_slug: string, type: "page" | "whiteboard") => ({
    createPage: state[type],
    isCreating: state.creating,
  }),
}));
vi.mock("@/components/workspace-pages/helpers", () => ({
  getToolTypeIcon: () => () => <svg />,
}));
vi.mock("@/components/workspace/members", () => ({
  SendWorkspaceInvitationModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="invite-modal" /> : null,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // eslint-disable-next-line no-extend-native -- jsdom lacks the Web Animations API used by the real menu.
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  state.role = EUserPermissions.ADMIN;
  state.projects = ["project-1"];
  state.creating = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  vi.unstubAllGlobals();
});

async function openMenu() {
  await act(() => root.render(<TopNavCreateMenu workspaceSlug="thefacecraft" />));
  await act(() => host.querySelector("button")?.click());
}

function item(label: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (element) => element.textContent === label
  );
}

it("opens the Create menu with all five admin actions", async () => {
  await openMenu();
  for (const label of ["common.work_item", "common.project", "common.page", "Whiteboard", "common.invite"]) {
    expect(item(label)).toBeDefined();
  }
  expect(host.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
});

it.each([
  ["common.work_item", "issue"],
  ["common.project", "project"],
  ["common.page", "page"],
  ["Whiteboard", "whiteboard"],
] as const)("uses the existing %s creation action and closes the menu", async (label, action) => {
  await openMenu();
  await act(() => item(label)?.click());
  expect(state[action]).toHaveBeenCalledOnce();
  if (action === "issue" || action === "project") expect(state[action]).toHaveBeenCalledWith(true);
  expect(host.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
});

it("opens the existing invitation modal", async () => {
  await openMenu();
  await act(() => item("common.invite")?.click());
  expect(host.querySelector('[data-testid="invite-modal"]')).not.toBeNull();
});

it("does not allow creating work items without a joined project", async () => {
  state.projects = [];
  await openMenu();
  expect(item("common.work_item")?.getAttribute("aria-disabled")).toBe("true");
  await act(() => item("common.work_item")?.click());
  expect(state.issue).not.toHaveBeenCalled();
});

it("hides invitations from non-admin members but retains creation actions", async () => {
  state.role = EUserPermissions.MEMBER;
  await openMenu();
  expect(item("common.invite")).toBeUndefined();
  expect(item("common.project")).toBeDefined();
});

it.each([EUserPermissions.GUEST, -1])("does not expose workspace creation for role %s", async (role) => {
  state.role = role;
  await openMenu();
  expect(host.querySelector("button")).toBeNull();
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

it("disables duplicate page and whiteboard creation while pending", async () => {
  state.creating = true;
  await openMenu();
  expect(item("common.page")?.getAttribute("aria-disabled")).toBe("true");
  expect(item("Whiteboard")?.getAttribute("aria-disabled")).toBe("true");
});

it("dismisses the menu with Escape", async () => {
  await openMenu();
  await act(() =>
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  );
  expect(host.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
});
