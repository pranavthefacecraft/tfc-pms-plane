/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PMSBilling } from "./billing";

const mocks = vi.hoisted(() => ({ canView: true, ready: true }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    workspaceInfoBySlug: () => (mocks.ready ? { role: 20 } : undefined),
    allowPermissions: () => mocks.canView,
  }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ billing_email: "billing@example.test" }) }),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  mocks.canView = true;
  mocks.ready = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("disables Manage Plan without a pricing popup and preserves billing information", async () => {
  await act(() => root.render(<PMSBilling workspaceSlug="team" />));
  const button = host.querySelector("button")!;
  expect(button.textContent?.trim()).toBe("Manage Plan");
  expect(button.disabled).toBe(true);
  expect(button.hasAttribute("aria-haspopup")).toBe(false);
  await act(() => button.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain("Community");
  expect(host.textContent).toContain("billing@example.test");
  expect(host.textContent).toContain("Payment method");
  expect(host.textContent).toContain("Plan management is temporarily unavailable.");
});

it("preserves workspace permission checks", async () => {
  mocks.canView = false;
  await act(() => root.render(<PMSBilling workspaceSlug="team" />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Only workspace admins and members");
  expect(host.querySelector("button")).toBeNull();
});

it("preserves the loading state", async () => {
  mocks.ready = false;
  await act(() => root.render(<PMSBilling workspaceSlug="team" />));
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading workspace permissions...");
});
