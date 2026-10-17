/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { PropsWithChildren } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCustomFieldsManager } from "./manager";

const mocks = vi.hoisted(() => ({
  data: [
    {
      id: "stage",
      name: "Stage",
      description: "",
      field_type: "single_select",
      options: [],
      notify_collaborators: false,
    },
  ],
  error: null as Error | null,
  loading: false,
  mutate: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  fieldError: vi.fn(),
}));

vi.mock("./service", () => ({
  FIELD_TYPES: { single_select: "Single-select", text: "Text" },
  useCustomFields: () => ({ data: mocks.data, error: mocks.error, isLoading: mocks.loading, mutate: mocks.mutate }),
  customFields: { save: mocks.save, remove: mocks.remove },
  fieldError: mocks.fieldError,
}));
function MockDialogContainer({ children }: PropsWithChildren) {
  return <div>{children}</div>;
}

vi.mock("@makeplane/propel/components/dialog", () => {
  return {
    Dialog: ({ children, open }: PropsWithChildren<{ open: boolean }>) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogActions: MockDialogContainer,
    DialogBody: MockDialogContainer,
    DialogContent: MockDialogContainer,
    DialogHeader: MockDialogContainer,
    DialogHeading: MockDialogContainer,
    DialogMain: MockDialogContainer,
    DialogTitle: MockDialogContainer,
  };
});

describe("project custom fields settings manager", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.error = null;
    mocks.loading = false;
    mocks.save.mockResolvedValue(mocks.data[0]);
    mocks.mutate.mockResolvedValue(undefined);
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

  async function render(disabled = false) {
    await act(() =>
      root.render(<ProjectCustomFieldsManager workspaceSlug="workspace" projectId="project" disabled={disabled} />)
    );
  }

  function button(label: string) {
    const result = [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === label);
    if (!result) throw new Error(`Missing button: ${label}`);
    return result;
  }

  it("shows existing fields directly, without Customize or a drawer", async () => {
    await render();
    expect(host.textContent).toContain("Stage");
    expect(host.textContent).not.toContain("Customize");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(button("Add field").disabled).toBe(false);
  });

  it("opens creation directly and returns to the settings list on cancel", async () => {
    await render();
    await act(() => button("Add field").click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Create field");
    await act(() => button("Cancel").click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain("Stage");
  });

  it("saves an existing field through the same project API", async () => {
    await render();
    await act(() => button("Stage").click());
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Field type"]')?.disabled).toBe(true);
    const form = host.querySelector("form");
    if (!form) throw new Error("Field editor missing");
    await act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mocks.save).toHaveBeenCalledWith(
      "workspace",
      "project",
      expect.objectContaining({ name: "Stage" }),
      "stage"
    );
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it("retains the editor and reports save errors", async () => {
    const error = new Error("Unavailable");
    mocks.save.mockRejectedValue(error);
    await render();
    await act(() => button("Stage").click());
    const form = host.querySelector("form");
    if (!form) throw new Error("Field editor missing");
    await act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mocks.fieldError).toHaveBeenCalledWith(error);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("removes a field only after confirmation", async () => {
    await render();
    await act(() => button("Remove").click());
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith("workspace", "project", "stage");
    expect(mocks.mutate).toHaveBeenCalled();
  });

  it("disables adding editing and removing for archived projects", async () => {
    await render(true);
    expect(button("Add field").disabled).toBe(true);
    expect(button("Stage").disabled).toBe(true);
    expect(button("Remove").disabled).toBe(true);
  });

  it("surfaces list errors and provides retry", async () => {
    mocks.error = new Error("Unavailable");
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Fields could not be loaded");
    expect(button("Add field").disabled).toBe(true);
    await act(() => button("Retry").click());
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });
});
