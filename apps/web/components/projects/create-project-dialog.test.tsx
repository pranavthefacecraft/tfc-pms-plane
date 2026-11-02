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
  projectAttachmentUrl,
  projectDraftError,
} from "./create-project-dialog.helpers";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  bulkAdd: vi.fn(),
  upload: vi.fn(),
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
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "me" } }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    createProject: mocks.createProject,
    updateProject: mocks.updateProject,
    projectMap: mocks.projectMap,
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({ id, display_name: id === "ann" ? "Ann Lee" : "Guest Gus" }),
    project: { bulkAddMembersToProject: mocks.bulkAdd },
    workspace: {
      workspaceMemberIds: ["me", "ann", "gus"],
      getWorkspaceMemberDetails: (id: string) => ({ id, role: id === "gus" ? 5 : 20, is_active: true }),
    },
  }),
}));
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

  it("caps collaborator roles and builds attachment links", () => {
    expect(collaboratorRole(20)).toBe(15);
    expect(collaboratorRole(5)).toBe(5);
    expect(projectAttachmentUrl("https://pms.test/", "acme", "p1", "a1")).toBe(
      "https://pms.test/api/assets/v2/workspaces/acme/projects/p1/download/a1/"
    );
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
  const fillRequired = () => {
    type(input('input[placeholder="e.g. Website Redesign"]'), "Website Redesign");
    const [start, due] = host.querySelectorAll<HTMLInputElement>('input[type="date"]');
    type(start, "2026-11-03");
    type(due, "2026-11-30");
  };

  it("keeps Create Project disabled until the required fields are valid", () => {
    expect(host.textContent).toContain("Create Project");
    expect(button("Create Project").disabled).toBe(true);
    fillRequired();
    expect(button("Create Project").disabled).toBe(false);
  });

  it("creates the project with dates, collaborators and an attached file", async () => {
    fillRequired();
    type(host.querySelector("textarea")!, "Refresh the marketing site");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!.click());
    const options = [...host.querySelectorAll("li label")];
    expect(options.map((node) => node.textContent)).toEqual(["Ann Lee", "Guest Gus"]);
    act(() => options.forEach((node) => node.querySelector("input")!.click()));

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
        { member_id: "ann", role: 15 },
        { member_id: "gus", role: 5 },
      ],
    });
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
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
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
    act(() => host.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!.click());
    act(() => host.querySelector<HTMLInputElement>("li input")!.click());
    await act(async () => button("Create Project").click());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "warning", title: "Project created" }));
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/new/overview");
  });
});
