/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPageHeader } from "./project-page-header";
import type { TProjectPageTab } from "./project-page-header";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));

describe("ProjectPageHeader", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render(active: TProjectPageTab = "overview") {
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
    expect(tab("Project Calendar").getAttribute("href")).toMatch(/^\/acme\/projects\/p1\/calendar/);
    expect(tab("Timeline").getAttribute("href")).toMatch(/^\/acme\/projects\/p1\/timeline/);
  });

  it("links the gear icon to the project settings", async () => {
    await render();
    const gear = host.querySelector<HTMLAnchorElement>('a[aria-label="Project settings"]')!;
    expect(gear.getAttribute("href")).toMatch(/^\/acme\/settings\/projects\/p1/);
    expect(gear.querySelector("svg")).not.toBeNull();
  });

  it("marks Timeline as the current tab on the Timeline page", async () => {
    await render("timeline");
    expect(tab("Timeline").getAttribute("aria-current")).toBe("page");
    expect(tab("Project Calendar").getAttribute("aria-current")).toBeNull();
  });

  it("marks Project Calendar as the current tab on the Calendar page", async () => {
    await render("calendar");
    expect(tab("Project Calendar").getAttribute("aria-current")).toBe("page");
    expect(tab("Board").getAttribute("aria-current")).toBeNull();
  });

  it("marks Board as the current tab on the Board page", async () => {
    await render("board");
    expect(tab("Board").getAttribute("aria-current")).toBe("page");
    expect(tab("List").getAttribute("aria-current")).toBeNull();
  });

  it("marks List as the current tab on the List page", async () => {
    await render("list");
    expect(tab("List").getAttribute("aria-current")).toBe("page");
    expect(tab("Overview").getAttribute("aria-current")).toBeNull();
  });

  it("marks Files as the current tab on the Files page", async () => {
    await render("files");
    expect(tab("Files").getAttribute("aria-current")).toBe("page");
    expect(tab("Overview").getAttribute("aria-current")).toBeNull();
  });
});
