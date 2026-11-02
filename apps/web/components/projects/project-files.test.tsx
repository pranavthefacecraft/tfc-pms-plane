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
import type { TProjectFile } from "@/services/project-files.service";
import { ProjectFiles } from "./project-files";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/services/project-files.service", () => ({
  ProjectFilesService: class {
    list = mocks.list;
  },
}));

const base = {
  mime_type: "",
  size: 0,
  created_at: "2026-11-01T00:00:00Z",
  created_by_name: "Ann",
  project_id: "p1",
  project_identifier: "WEB",
};
const FILES: TProjectFile[] = [
  {
    ...base,
    id: "a1",
    kind: "attachment",
    name: "hero.png",
    mime_type: "image/png",
    url: "/api/assets/v2/workspaces/acme/projects/p1/issues/i1/attachments/a1/",
    issue_id: "i1",
    issue_name: "Homepage",
    sequence_id: 3,
    state_group: "completed",
  },
  {
    ...base,
    id: "l1",
    kind: "link",
    name: "Figma",
    url: "https://figma.com/file/x",
    issue_id: "i2",
    issue_name: "Design review",
    sequence_id: 4,
    state_group: "started",
  },
  {
    ...base,
    id: "b1",
    kind: "attachment",
    name: "brief.pdf",
    mime_type: "application/pdf",
    url: "/api/assets/v2/workspaces/acme/projects/p1/download/b1/",
    issue_id: null,
    issue_name: null,
    sequence_id: null,
    state_group: null,
  },
];

describe("ProjectFiles", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(FILES);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
            <ProjectFiles workspaceSlug="acme" projectId="p1" />
          </SWRConfig>
        </MemoryRouter>
      );
    });
  }
  const cards = () => [...host.querySelectorAll("article")].map((node) => node.querySelector("a")?.textContent);
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((node) => node.textContent === label) as HTMLButtonElement;

  it("lists task files, links and project attachments", async () => {
    await render();
    expect(mocks.list).toHaveBeenCalledWith("acme", "p1");
    expect(cards()).toEqual(["hero.png", "Figma", "brief.pdf"]);
    expect(host.textContent).toContain("3 items");
    expect(host.querySelector('a[href^="/acme/projects/p1/issues/i1"]')?.textContent).toContain("Homepage");
    expect(host.textContent).toContain("Project file");
    expect(host.querySelector("img")?.getAttribute("alt")).toBe("hero.png");
  });

  it("filters by type and search text", async () => {
    await render();
    await act(async () => button("Links").click());
    expect(cards()).toEqual(["Figma"]);
    await act(async () => button("Documents").click());
    expect(cards()).toEqual(["brief.pdf"]);
    await act(async () => button("All").click());
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Search files"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "homepage");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(cards()).toEqual(["hero.png"]);
  });

  it("shows an empty state and a retryable error", async () => {
    mocks.list.mockResolvedValueOnce([]);
    await render();
    expect(host.textContent).toContain("No files or links yet");
    await act(() => root.unmount());
    root = createRoot(host);
    mocks.list.mockRejectedValueOnce(new Error("Offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load files");
  });
});
