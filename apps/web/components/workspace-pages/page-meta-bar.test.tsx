/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WorkspaceToolPageMetaBar } from "./page-meta-bar";

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@plane/utils", () => ({ calculateTimeAgo: () => "just now" }));
vi.mock("@/services/page/workspace-page.service", () => ({ WORKSPACE_PAGE_ACCESS: { PUBLIC: 0, PRIVATE: 1 } }));

const page: TWorkspacePage = {
  id: "board",
  name: "Board",
  tool_type: "whiteboard",
  access: 1,
  logo_props: {},
  owned_by: "owner",
  owner: null,
  updated_by: null,
  workspace: "workspace",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  attachment: { entity_type: "project", project_id: "project", issue_id: null, is_accessible: false },
};

describe("workspace page metadata permissions", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const attach = vi.fn();
  const detach = vi.fn();
  const toggleAccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render(isOwner: boolean, readOnly?: boolean) {
    await act(() =>
      root.render(
        <WorkspaceToolPageMetaBar
          workspaceSlug="workspace"
          page={page}
          isOwner={isOwner}
          readOnly={readOnly}
          saveStatus="submitted"
          onAttachClick={attach}
          onDetach={detach}
          onToggleAccess={toggleAccess}
        />
      )
    );
    return [...host.querySelectorAll("button")];
  }

  it("disables every mutation for viewers and while editing is paused", async () => {
    const buttons = await render(true, true);
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    await act(() => buttons.forEach((button) => button.click()));
    expect(attach).not.toHaveBeenCalled();
    expect(detach).not.toHaveBeenCalled();
    expect(toggleAccess).not.toHaveBeenCalled();
  });

  it("allows editors to attach and detach but not change visibility", async () => {
    const buttons = await render(false, false);
    expect(buttons.map((button) => button.disabled)).toEqual([false, false, true]);
    await act(() => buttons.forEach((button) => button.click()));
    expect(attach).toHaveBeenCalledOnce();
    expect(detach).toHaveBeenCalledOnce();
    expect(toggleAccess).not.toHaveBeenCalled();
  });

  it("preserves existing owner controls when readOnly is not supplied", async () => {
    const buttons = await render(true);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    await act(() => buttons[2].click());
    expect(toggleAccess).toHaveBeenCalledOnce();
  });
});
