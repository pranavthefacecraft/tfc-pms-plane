/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TProject } from "@plane/types";
import { CreateProjectDialog } from "./create-project-dialog";
import {
  EMPTY_PROJECT_DRAFT,
  collaboratorRole,
  identifierCandidates,
  isEmail,
  projectAttachmentUrl,
  projectDraftError,
  teammateRoleOptions,
  teammateSuggestions,
  withTeammate,
} from "./create-project-dialog.helpers";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  bulkAdd: vi.fn(),
  upload: vi.fn(),
  invite: vi.fn(),
  applyTemplate: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  projectMap: {} as Record<string, { identifier: string }>,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me", display_name: "Pat Owner", email: "pat@acme.test" } }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    createProject: mocks.createProject,
    updateProject: mocks.updateProject,
    projectMap: mocks.projectMap,
  }),
}));
const people: Record<string, { name: string; role: number }> = {
  me: { name: "Pat Owner", role: 20 },
  ann: { name: "Ann Lee", role: 20 },
  eve: { name: "Eve Stone", role: 15 },
  gus: { name: "Guest Gus", role: 5 },
};
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({ id, display_name: people[id].name, email: `${id}@acme.test` }),
    project: { bulkAddMembersToProject: mocks.bulkAdd },
    workspace: {
      workspaceMemberIds: Object.keys(people),
      getWorkspaceMemberDetails: (id: string) => ({ id, role: people[id].role, is_active: true }),
    },
  }),
}));
vi.mock("@/services/project-collaborators.service", () => ({
  ProjectCollaboratorsService: class {
    invite = mocks.invite;
  },
}));
vi.mock("./project-templates", () => ({ applyProjectTemplate: mocks.applyTemplate }));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    uploadProjectAsset = mocks.upload;
  },
}));

describe("create project helpers", () => {
  it("validates required fields and date order", () => {
    expect(projectDraftError(EMPTY_PROJECT_DRAFT)).toBe("Enter a project name.");
    const named = { ...EMPTY_PROJECT_DRAFT, name: "Launch" };
    expect(projectDraftError({ ...named, name: "Q4 (plan)" })).toMatch(/special characters/);
    expect(projectDraftError(named)).toBe("Select a start date.");
    expect(projectDraftError({ ...named, startDate: "2026-11-02" })).toBe("Select a due date.");
    expect(projectDraftError({ ...named, startDate: "2026-11-02", dueDate: "2026-11-01" })).toMatch(/before/);
    expect(projectDraftError({ ...named, startDate: "2026-11-02", dueDate: "2026-11-02" })).toBeNull();
  });

  it("suggests short unique identifiers", () => {
    expect(identifierCandidates("Website Redesign", [], 3)).toEqual(["WR", "WR2", "WR3"]);
    expect(identifierCandidates("Marketing", ["marke"], 2)).toEqual(["MARKE2", "MARKE3"]);
    expect(identifierCandidates("!!", [], 1)).toEqual(["PRJ"]);
  });

  it("maps teammate roles to what the API accepts and builds attachment links", () => {
    expect(collaboratorRole(20, 5)).toBe(20);
    expect(collaboratorRole(15)).toBe(15);
    expect(collaboratorRole(15, 5)).toBe(5);
    expect(collaboratorRole(5, 15)).toBe(5);
    expect(teammateRoleOptions(20)).toEqual([20]);
    expect(teammateRoleOptions(15)).toEqual([15, 5]);
    expect(teammateRoleOptions(5)).toEqual([5]);
    expect(isEmail(" new@acme.test ")).toBe(true);
    expect(isEmail("ann")).toBe(false);
    expect(projectAttachmentUrl("https://pms.test/", "acme", "p1", "a1")).toBe(
      "https://pms.test/api/assets/v2/workspaces/acme/projects/p1/download/a1/"
    );
  });
});

describe("teammate helpers", () => {
  const people = [
    { id: "me", name: "Pat", email: "pat@acme.test", isActive: true },
    { id: "ann", name: "Ann Lee", email: "ann@acme.test", isActive: true },
    { id: "old", name: "Ann Old", email: "old@acme.test", isActive: false },
  ];
  const me = { id: "me", email: "pat@acme.test" };

  it("suggests active members by name or email and offers unknown emails as invites", () => {
    expect(teammateSuggestions("  ", people, [], me)).toEqual({ term: "", suggestions: [], canInviteEmail: false });
    expect(teammateSuggestions("ANN", people, [], me).suggestions.map((person) => person.id)).toEqual(["ann"]);
    expect(teammateSuggestions("ann", people, [{ memberId: "ann", email: "", role: 15 }], me).suggestions).toEqual([]);
    expect(teammateSuggestions("ann@acme.test", people, [], me).canInviteEmail).toBe(false);
    expect(teammateSuggestions("pat@acme.test", people, [], me).canInviteEmail).toBe(false);
    expect(teammateSuggestions("New@Acme.test", people, [], me)).toMatchObject({
      term: "new@acme.test",
      canInviteEmail: true,
    });
    expect(teammateSuggestions("new@acme.test", people, [{ email: "new@acme.test", role: 5 }], me).canInviteEmail).toBe(
      false
    );
  });

  it("does not add the same teammate twice", () => {
    const list = [{ memberId: "ann", email: "ann@acme.test", role: 15 }];
    expect(withTeammate(list, { memberId: "ann", email: "", role: 5 })).toBe(list);
    expect(withTeammate(list, { email: "ANN@acme.test", role: 5 })).toHaveLength(2);
    const invited = [{ email: "x@acme.test", role: 15 }];
    expect(withTeammate(invited, { email: "X@acme.test", role: 5 })).toBe(invited);
  });
});

describe("CreateProjectDialog", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectMap = { old: { identifier: "WR" } };
    mocks.createProject.mockImplementation((_slug: string, data: Partial<TProject>) =>
      Promise.resolve({ ...data, id: "new" })
    );
    mocks.updateProject.mockResolvedValue({});
    mocks.bulkAdd.mockResolvedValue(undefined);
    mocks.upload.mockResolvedValue({ asset_id: "asset" });
    mocks.invite.mockResolvedValue({ added: [], invited: ["new@acme.test"] });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<CreateProjectDialog isOpen onClose={onClose} workspaceSlug="acme" />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    act(() => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const input = (selector: string) => host.querySelector<HTMLInputElement>(selector)!;
  const button = (text: string) => [...host.querySelectorAll("button")].find((node) => node.textContent === text)!;
  const inviteInput = () => input('input[placeholder="Enter email or teammate name"]');
  const pressEnter = () =>
    act(() => inviteInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  const openPicker = () => act(() => host.querySelector<HTMLButtonElement>("button[aria-controls]")!.click());
  const fillRequired = () => {
    type(input('input[placeholder="e.g. Website Redesign"]'), "Website Redesign");
    const [start, due] = host.querySelectorAll<HTMLInputElement>('input[type="date"]');
    type(start, "2026-11-03");
    type(due, "2026-11-30");
  };

  it("sets up the chosen template's stages after creating the project", async () => {
    act(() => root.render(<CreateProjectDialog isOpen onClose={onClose} workspaceSlug="acme" template="general" />));
    fillRequired();
    await act(async () => button("Create Project").click());
    expect(mocks.applyTemplate).toHaveBeenCalledWith(expect.anything(), "acme", "new", "general");
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/new/overview");
  });

  it("skips templates when none was chosen", async () => {
    fillRequired();
    await act(async () => button("Create Project").click());
    expect(mocks.applyTemplate).not.toHaveBeenCalled();
  });

  it("keeps Create Project disabled until the required fields are valid", () => {
    expect(host.textContent).toContain("Create Project");
    expect(button("Create Project").disabled).toBe(true);
    fillRequired();
    expect(button("Create Project").disabled).toBe(false);
  });

  it("creates the project with dates, collaborators and an attached file", async () => {
    fillRequired();
    type(host.querySelector("textarea")!, "Refresh the marketing site");
    openPicker();
    expect(host.textContent).toContain("Only me");
    expect(host.textContent).toContain("Pat Owner");

    type(inviteInput(), "ann");
    act(() => button("Ann Leeann@acme.test").click());
    type(inviteInput(), "eve");
    pressEnter();
    type(inviteInput(), "gus");
    pressEnter();
    type(inviteInput(), "pat");
    expect(host.textContent).toContain("No teammates found");
    type(inviteInput(), "new@acme.test");
    act(() => button("Invite new@acme.test").click());

    expect(host.textContent).toContain("4 teammates selected");
    expect(host.textContent).not.toContain("Only me");
    expect(host.querySelector('[aria-label="Role for Ann Lee"]')).toBeNull();
    expect(host.querySelector('[aria-label="Role for Guest Gus"]')).toBeNull();
    const eveRole = host.querySelector<HTMLSelectElement>('select[aria-label="Role for Eve Stone"]')!;
    act(() => {
      eveRole.value = "5";
      eveRole.dispatchEvent(new Event("change", { bubbles: true }));
    });
    type(inviteInput(), "ann");
    expect(host.textContent).toContain("No teammates found");

    const file = new File(["brief"], "brief.pdf", { type: "application/pdf" });
    const fileInput = input('input[type="file"]');
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    act(() => fileInput.dispatchEvent(new Event("change", { bubbles: true })));
    expect(host.textContent).toContain("brief.pdf");

    await act(async () => button("Create Project").click());

    expect(mocks.createProject).toHaveBeenCalledWith(
      "acme",
      expect.objectContaining({
        name: "Website Redesign",
        identifier: "WR2",
        description: "Refresh the marketing site",
        start_date: "2026-11-03",
        target_date: "2026-11-30",
      })
    );
    expect(mocks.bulkAdd).toHaveBeenCalledWith("acme", "new", {
      members: [
        { member_id: "ann", role: 20 },
        { member_id: "eve", role: 5 },
        { member_id: "gus", role: 5 },
      ],
    });
    expect(mocks.invite).toHaveBeenCalledWith("acme", "new", [{ email: "new@acme.test", role: 15 }]);
    expect(mocks.upload).toHaveBeenCalledWith(
      "acme",
      "new",
      { entity_identifier: "new", entity_type: "PROJECT_ATTACHMENT" },
      file
    );
    expect(mocks.updateProject).toHaveBeenCalledWith("acme", "new", {
      overview_resources: [
        {
          title: "brief.pdf",
          url: expect.stringMatching(
            /^https?:\/\/[^/]+\/api\/assets\/v2\/workspaces\/acme\/projects\/new\/download\/asset\/$/
          ),
          kind: "link",
        },
      ],
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: "Project created. Invitations sent to 1 person." })
    );
    expect(onClose).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/new/overview");
  });

  it("retries with the next identifier when one is already taken", async () => {
    mocks.createProject
      .mockRejectedValueOnce({ identifier: ["PROJECT_IDENTIFIER_ALREADY_EXIST"] })
      .mockImplementationOnce((_slug: string, data: Partial<TProject>) => Promise.resolve({ ...data, id: "new" }));
    fillRequired();
    await act(async () => button("Create Project").click());
    expect(mocks.createProject.mock.calls.map(([, data]) => data.identifier)).toEqual(["WR2", "WR3"]);
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/new/overview");
  });

  it("shows an error and stays open when the name is taken", async () => {
    mocks.createProject.mockRejectedValueOnce({ name: ["PROJECT_NAME_ALREADY_EXIST"] });
    fillRequired();
    await act(async () => button("Create Project").click());
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "A project with this name already exists." })
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("warns when the follow-up steps fail but keeps the project", async () => {
    mocks.bulkAdd.mockRejectedValueOnce(new Error("nope"));
    fillRequired();
    openPicker();
    type(inviteInput(), "eve");
    pressEnter();
    type(inviteInput(), "x@acme.test");
    pressEnter();
    await act(async () => button("Create Project").click());
    expect(mocks.bulkAdd).toHaveBeenCalledWith("acme", "new", { members: [{ member_id: "eve", role: 15 }] });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "warning", title: "Project created" }));
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/new/overview");
  });

  it("removes teammates and keeps Enter from submitting the form", () => {
    fillRequired();
    openPicker();
    type(inviteInput(), "eve");
    pressEnter();
    expect(mocks.createProject).not.toHaveBeenCalled();
    expect(host.textContent).toContain("1 teammate selected");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Remove Eve Stone"]')!.click());
    expect(host.textContent).toContain("Only me");
    expect(host.textContent).toContain("Add collaborators");
  });
});
