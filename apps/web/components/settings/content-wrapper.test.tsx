/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, it, vi } from "vitest";
import { SettingsContentWrapper } from "./content-wrapper";
import { handle } from "@/app/(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/layout";

vi.mock("@makeplane/propel/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/core/app-header", () => ({
  AppHeader: ({ header }: { header: ReactNode }) => <header>{header}</header>,
}));

it.each(["general", "members", "cycles", "modules", "states", "labels", "estimates", "custom-fields", "automations"])(
  "removes the section bar but preserves settings content for %s",
  async (section) => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const router = createMemoryRouter([
      {
        path: "/",
        handle,
        element: (
          <SettingsContentWrapper header={<span>{section} section bar</span>}>
            <button>Existing settings action</button>
          </SettingsContentWrapper>
        ),
      },
    ]);
    try {
      await act(() => root.render(<RouterProvider router={router} />));
      expect(host.querySelector("header")).toBeNull();
      expect(host.querySelector("button")?.textContent).toBe("Existing settings action");
    } finally {
      act(() => root.unmount());
      router.dispose();
    }
  }
);

it("keeps the section bar on non-project settings pages", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const router = createMemoryRouter([
    {
      path: "/",
      element: <SettingsContentWrapper header={<span>Workspace settings</span>}>Content</SettingsContentWrapper>,
    },
  ]);
  try {
    await act(() => root.render(<RouterProvider router={router} />));
    expect(host.querySelector("header")?.textContent).toBe("Workspace settings");
    expect(host.textContent).toContain("Content");
  } finally {
    act(() => root.unmount());
    router.dispose();
  }
});
