/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import { ProjectPageHeader } from "./project-page-header";

const mocks = vi.hoisted(() => ({
  filters: undefined as unknown,
  fetchFilters: vi.fn(),
  updateFilters: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issuesFilter: {
      getIssueFilters: () => mocks.filters,
      fetchFilters: mocks.fetchFilters,
      updateFilters: mocks.updateFilters,
    },
  }),
}));

describe("ProjectPageHeader", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filters = undefined;
    mocks.fetchFilters.mockResolvedValue(undefined);
    mocks.updateFilters.mockResolvedValue(undefined);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render(active: "overview" | "list" | "board" | "files" = "overview") {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/acme/projects/p1/overview"]}>
          <Routes>
            <Route
              path="/acme/projects/p1/overview"
              element={
                <ProjectPageHeader workspaceSlug="acme" projectId="p1" name="website Redesign" active={active} />
              }
            />
            <Route path="/acme/projects/p1/issues" element={<p>Work items page</p>} />
          </Routes>
        </MemoryRouter>
      );
    });
  }
  const tab = (label: string) =>
    [...host.querySelectorAll("nav a, nav button")].find((node) => node.textContent === label) as HTMLElement;

  it("shows the letter tile, project name and the Figma tabs", async () => {
    await render();
    expect(host.querySelector("h1")?.textContent).toBe("website Redesign");
    expect(host.querySelector("header span")?.textContent).toBe("W");
    expect([...host.querySelectorAll("nav a, nav button")].map((node) => node.textContent)).toEqual([
      "Overview",
      "List",
      "Board",
      "Project Calendar",
      "Timeline",
      "Files",
    ]);
    expect(tab("Overview").getAttribute("aria-current")).toBe("page");
    expect(tab("Files").getAttribute("href")).toMatch(/^\/acme\/projects\/p1\/files/);
    expect(tab("List").getAttribute("href")).toMatch(/^\/acme\/projects\/p1\/list/);
    expect(tab("Board").getAttribute("href")).toMatch(/^\/acme\/projects\/p1\/board/);
  });

  it("marks Board as the current tab on the Board page", async () => {
    await render("board");
    expect(tab("Board").getAttribute("aria-current")).toBe("page");
    expect(tab("List").getAttribute("aria-current")).toBeNull();
  });

  it("marks List as the current tab on the List page without touching work item filters", async () => {
    await render("list");
    expect(tab("List").getAttribute("aria-current")).toBe("page");
    expect(tab("Overview").getAttribute("aria-current")).toBeNull();
    expect(mocks.updateFilters).not.toHaveBeenCalled();
  });

  it("marks Files as the current tab on the Files page", async () => {
    await render("files");
    expect(tab("Files").getAttribute("aria-current")).toBe("page");
    expect(tab("Overview").getAttribute("aria-current")).toBeNull();
  });

  it.each([
    ["Project Calendar", EIssueLayoutTypes.CALENDAR],
    ["Timeline", EIssueLayoutTypes.GANTT],
  ])("opens work items in the %s layout", async (label, layout) => {
    await render();
    await act(async () => tab(label).click());
    expect(mocks.fetchFilters).toHaveBeenCalledWith("acme", "p1");
    expect(mocks.updateFilters).toHaveBeenCalledWith("acme", "p1", EIssueFilterType.DISPLAY_FILTERS, { layout });
    expect(host.textContent).toContain("Work items page");
  });

  it("skips loading filters that are already loaded and reports failures", async () => {
    mocks.filters = {};
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateFilters.mockRejectedValueOnce(new Error("Offline"));
    await render();
    await act(async () => tab("Timeline").click());
    expect(mocks.fetchFilters).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(host.textContent).not.toContain("Work items page");
  });
});
