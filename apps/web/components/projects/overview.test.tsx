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
import { EFileAssetType } from "@plane/types";
import type { TProjectFile } from "@/services/project-files.service";
import { ProjectOverview } from "./overview";
import { safeResourceUrl } from "@/helpers/project-overview.helper";

const mocks = vi.hoisted(() => ({
  project: {} as IProject,
  admin: true,
  fetch: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
  files: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/services/project-files.service", () => ({
  ProjectFilesService: class {
    list = mocks.files;
  },
}));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    uploadProjectAsset = mocks.upload;
  },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("./project-page-header", () => ({
  ProjectPageHeader: ({ name, active }: { name: string; active: string }) => <h1 data-active-tab={active}>{name}</h1>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("./invite-collaborators-dialog", () => ({
  InviteCollaboratorsDialog: ({ project, onClose }: { project: { name: string }; onClose: () => void }) => (
    <div role="dialog">
      Invite to {project.name}
      <button onClick={onClose}>Close invitation</button>
    </div>
  ),
}));
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

function button(label: string) {
  const result = [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === label || node.getAttribute("aria-label") === label
  );
  if (!result) throw new Error(`Missing button ${label}`);
  return result;
}

describe("project overview", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin = true;
    mocks.files.mockResolvedValue([]);
    mocks.upload.mockResolvedValue({ asset_id: "new-file" });
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
  async function filterResource(label: string) {
    if (!document.querySelector('fieldset input[type="checkbox"]')) await act(() => button("Filter resources").click());
    const option = [...document.querySelectorAll("fieldset label")].find((node) => node.textContent === label);
    if (!option) throw new Error(`Missing resource type ${label}`);
    await act(() => option.querySelector<HTMLInputElement>("input")!.click());
  }
  async function sortResources(label: string) {
    await act(() => button("Sort resources").click());
    await act(() => button(label).click());
  }

  it("renders description and files together with a separate collaborator column", async () => {
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
    expect(host.textContent).toContain("Project Collaborators");
    const people = [...host.querySelectorAll("section[aria-labelledby=overview-teammates] li")];
    expect(people.map((node) => node.textContent)).toEqual([
      "POProject OwnerProject owner",
      "TMTeam MemberCollaborator",
    ]);
    expect(button("Add Collaborator")).toBeTruthy();
    expect(host.textContent).toContain("Files & Resources");
    const description = host.querySelector('section[aria-labelledby="overview-description"]')!;
    const resources = host.querySelector('section[aria-labelledby="overview-resources"]')!;
    const collaborators = host.querySelector('section[aria-labelledby="overview-teammates"]')!;
    expect(description.parentElement).toBe(resources.parentElement);
    expect(collaborators.parentElement).toBe(description.parentElement?.parentElement);
    expect(collaborators.querySelector("ul")?.nextElementSibling?.textContent).toContain("Add Collaborator");
    expect(host.textContent).toContain("Attached file");
    expect(host.querySelector('a[aria-label="Open Project brief"]')?.getAttribute("href")).toBe(
      "https://example.com/brief"
    );
    // Health, progress, dates and the owner picker are hidden in this layout.
    expect(host.querySelector("progress")).toBeNull();
    expect(host.querySelector('select[aria-label="Project owner"]')).toBeNull();
    expect(host.textContent).not.toContain("Project health");
  });
  it("opens the shared project invitation popup without leaving the overview", async () => {
    await render();
    await act(() => button("Add Collaborator").click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Invite to Launch");
    await act(() => button("Close invitation").click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it("lists the project creator as owner when no lead is set", async () => {
    mocks.project.project_lead = null;
    mocks.project.created_by = "member";
    await render();
    const people = [...host.querySelectorAll("section[aria-labelledby=overview-teammates] li")];
    expect(people.map((node) => node.textContent)).toEqual([
      "TMTeam MemberProject owner",
      "POProject OwnerCollaborator",
    ]);
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
    expect(host.textContent).not.toContain("Edit description");
    expect(host.textContent).not.toContain("Add Collaborator");
    expect(host.querySelector('button[aria-label="Add resource"]')).toBeNull();
    expect(host.querySelector('select[aria-label="Project owner"]')).toBeNull();
    expect(host.querySelector('input[type="file"]')).toBeNull();
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

  const projectFiles: TProjectFile[] = [
    {
      id: "file-1",
      kind: "attachment",
      name: "Zebra.pdf",
      url: "/api/assets/v2/workspaces/workspace/projects/project/download/file-1/",
      mime_type: "application/pdf",
      size: 100,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
      created_by_name: "Owner",
      project_id: "project",
      project_identifier: "LCH",
      issue_id: null,
      issue_name: null,
      sequence_id: null,
      state_group: null,
    },
    {
      id: "file-2",
      kind: "attachment",
      name: "Alpha.png",
      url: "/api/assets/v2/workspaces/workspace/projects/project/issues/task/attachments/file-2/",
      mime_type: "image/png",
      size: 100,
      created_at: "2026-11-02T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
      created_by_name: "Owner",
      project_id: "project",
      project_identifier: "LCH",
      issue_id: "task",
      issue_name: "Homepage",
      sequence_id: 1,
      state_group: "started",
    },
  ];
  const resourceNames = () =>
    [...host.querySelectorAll('section[aria-labelledby="overview-resources"] li')].map(
      (node) => node.querySelector("a")?.textContent
    );
  it("combines project/task files and linked resources without duplicating attached files", async () => {
    mocks.files.mockResolvedValue(projectFiles);
    mocks.project.overview_resources = [
      {
        title: "Zebra.pdf",
        url: "https://pms.example.com/api/assets/v2/workspaces/workspace/projects/project/download/file-1/",
        kind: "link",
      },
      { title: "Brief", url: "https://example.com/brief", kind: "link" },
    ];
    await render();
    expect(resourceNames()).toEqual(["Alpha.png", "Zebra.pdf", "Brief"]);
    const uploadedFile = host.querySelector('a[aria-label="Open Alpha.png"]')!;
    expect(uploadedFile.getAttribute("href")).toContain("/attachments/file-2/");
    expect(mocks.files).toHaveBeenCalledWith("workspace", "project");
    await filterResource("Images");
    expect(resourceNames()).toEqual(["Alpha.png"]);
    await filterResource("Documents");
    expect(resourceNames()).toEqual(["Alpha.png", "Zebra.pdf"]);
    await filterResource("Images");
    await filterResource("Documents");
    await act(() => button("Filter resources").click());
    await sortResources("Date Added · Oldest First");
    expect(resourceNames()).toEqual(["Zebra.pdf", "Alpha.png", "Brief"]);
    await sortResources("Name · A–Z");
    expect(resourceNames()).toEqual(["Alpha.png", "Brief", "Zebra.pdf"]);
    await change(host.querySelector('input[aria-label="Search resources"]')!, "homepage");
    expect(resourceNames()).toEqual(["Alpha.png"]);
    await change(host.querySelector('input[aria-label="Search resources"]')!, "unmatched");
    expect(host.textContent).toContain("No matching files or resources");
    expect(host.textContent).not.toContain("No Files Or Resources");
  });
  it("uses actual last-updated timestamps independently from date added and highlights the selected sort", async () => {
    mocks.files.mockResolvedValue([{ ...projectFiles[0], updated_at: "2026-11-10T00:00:00Z" }, projectFiles[1]]);
    await render();
    expect(resourceNames()).toEqual(["Zebra.pdf", "Alpha.png"]);
    await act(() => button("Sort resources").click());
    expect(button("Last Updated · Newest First").getAttribute("aria-pressed")).toBe("true");
    await act(() => button("Date Added · Newest First").click());
    expect(document.querySelector('[aria-label="Sort order"]')).toBeNull();
    expect(resourceNames()).toEqual(["Alpha.png", "Zebra.pdf"]);
    await sortResources("Name · Z–A");
    expect(resourceNames()).toEqual(["Zebra.pdf", "Alpha.png"]);
  });
  it("offers all Figma resource types and filters videos, recordings, notepads and whiteboards", async () => {
    mocks.files.mockResolvedValue([
      {
        ...projectFiles[0],
        id: "video",
        name: "Walkthrough.mp4",
        mime_type: "video/mp4",
        url: "https://example.com/video",
      },
      {
        ...projectFiles[1],
        id: "audio",
        name: "Meeting.wav",
        mime_type: "audio/wav",
        url: "https://example.com/audio",
      },
    ]);
    mocks.project.overview_resources = [
      { title: "Notes", url: "https://example.com/notes", kind: "notepad" },
      { title: "Board", url: "https://example.com/board", kind: "whiteboard" },
    ];
    await render();
    await filterResource("Videos");
    expect([...document.querySelectorAll("fieldset label")].map((node) => node.textContent)).toEqual([
      "Documents",
      "Images",
      "Links",
      "Videos",
      "Recordings",
      "Notepads",
      "Whiteboards",
    ]);
    expect(document.body.textContent).toContain("No selection shows all resources.");
    expect(resourceNames()).toEqual(["Walkthrough.mp4"]);
    await filterResource("Recordings");
    expect(resourceNames()).toEqual(["Meeting.wav", "Walkthrough.mp4"]);
    await filterResource("Videos");
    await filterResource("Recordings");
    await filterResource("Notepads");
    expect(resourceNames()).toEqual(["Notes"]);
    await filterResource("Whiteboards");
    expect(resourceNames()).toEqual(["Notes", "Board"]);
  });
  async function uploadFile(selectedFiles = [new File(["test"], "brief.pdf", { type: "application/pdf" })]) {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(() => {
      Object.defineProperty(input, "files", { configurable: true, value: selectedFiles });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return selectedFiles[0];
  }
  it("keeps the Figma upload panel above existing files and opens the multiple-file picker", async () => {
    mocks.files.mockResolvedValue(projectFiles);
    await render();
    const panel = host.querySelector('[aria-label="Upload files and resources"]')!;
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const openPicker = vi.spyOn(input, "click").mockImplementation(() => {});
    expect(panel.textContent).toContain("Upload Files & Resources");
    expect(panel.textContent).not.toContain("No Files Or Resources");
    expect(
      panel.compareDocumentPosition(host.querySelector('section[aria-labelledby="overview-resources"] ul')!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await act(() => button("Browse File").click());
    expect(openPicker).toHaveBeenCalledOnce();
    expect(input.multiple).toBe(true);
    expect(resourceNames()).toEqual(["Alpha.png", "Zebra.pdf"]);
  });
  it("uploads a file using the project asset API and refreshes the list", async () => {
    await render();
    expect(host.textContent).toContain("No Files Or Resources");
    expect(button("Browse File")).toBeDefined();
    mocks.files.mockResolvedValue(projectFiles);
    const file = await uploadFile();
    expect(mocks.upload).toHaveBeenCalledWith(
      "workspace",
      "project",
      { entity_identifier: "project", entity_type: EFileAssetType.PROJECT_ATTACHMENT },
      file
    );
    expect(resourceNames()).toEqual(["Alpha.png", "Zebra.pdf"]);
    expect(button("Browse File")).toBeDefined();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "File uploaded", type: "success" }));
  });
  it("shows upload failures and permits retry without reporting success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.upload.mockRejectedValueOnce(new Error("Offline"));
    await render();
    await uploadFile();
    expect(mocks.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Could not upload file", type: "error" })
    );
    expect(button("Browse File").disabled).toBe(false);
    await uploadFile();
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "File uploaded", type: "success" }));
  });
  it("reports a failed file load instead of showing an empty success state", async () => {
    mocks.files.mockRejectedValue(new Error("Offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load project files");
    expect(host.textContent).not.toContain("No Files Or Resources");
    expect(button("Retry")).toBeDefined();
  });
  it("distinguishes a saved upload from a failed refresh to avoid duplicate uploads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render();
    mocks.files.mockRejectedValue(new Error("Offline"));
    await uploadFile();
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "File uploaded, but the list could not refresh", type: "error" })
    );
  });
  it("uploads every selected file and refreshes once after the batch", async () => {
    await render();
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')!.multiple).toBe(true);
    const files = [new File(["a"], "first.pdf"), new File(["b"], "second.png"), new File(["c"], "third.txt")];
    mocks.files.mockClear();
    await uploadFile(files);
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    for (const [index, file] of files.entries()) {
      expect(mocks.upload).toHaveBeenNthCalledWith(
        index + 1,
        "workspace",
        "project",
        { entity_identifier: "project", entity_type: EFileAssetType.PROJECT_ATTACHMENT },
        file
      );
    }
    expect(mocks.files).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "3 files uploaded", type: "success" })
    );
  });
  it("continues after a failed file and identifies only failed files for retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render();
    const files = [new File(["a"], "first.pdf"), new File(["b"], "failed.png"), new File(["c"], "last.txt")];
    mocks.upload.mockResolvedValueOnce({ asset_id: "first" }).mockRejectedValueOnce(new Error("Offline"));
    mocks.files.mockClear();
    await uploadFile(files);
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.files).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "2 of 3 files uploaded",
        type: "error",
        message: expect.stringContaining("Failed: failed.png."),
      })
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    await uploadFile([files[1]]);
    expect(mocks.upload).toHaveBeenCalledTimes(4);
    expect(mocks.upload).toHaveBeenLastCalledWith(
      "workspace",
      "project",
      { entity_identifier: "project", entity_type: EFileAssetType.PROJECT_ATTACHMENT },
      files[1]
    );
  });
  it("does not submit an empty file selection", async () => {
    await render();
    await uploadFile([]);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(button("Browse File").disabled).toBe(false);
  });
});
