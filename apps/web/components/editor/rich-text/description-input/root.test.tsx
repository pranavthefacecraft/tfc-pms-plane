/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EFileAssetType } from "@plane/types";
import { DescriptionInput } from "./root";

const mocks = vi.hoisted(() => ({
  editor: {} as { value?: string | null; onChange?: (json: object, html: string) => void },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/utils", () => ({ getDescriptionPlaceholderI18n: () => "Description" }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace" }) }),
}));
vi.mock("@/hooks/store/use-editor-asset", () => ({
  useEditorAsset: () => ({ uploadEditorAsset: vi.fn(), duplicateEditorAsset: vi.fn() }),
}));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: vi.fn(function () {
    return { searchEntity: vi.fn() };
  }),
}));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: (props: typeof mocks.editor) => {
    mocks.editor = props;
    return <div data-value={props.value} />;
  },
}));

describe("description live synchronization and drafts", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const save = vi.fn().mockResolvedValue(undefined);
  const status = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    save.mockReset().mockResolvedValue(undefined);
    status.mockClear();
    host = document.createElement("div");
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  async function render(value: string) {
    await act(() =>
      root.render(
        <DescriptionInput
          key="task"
          entityId="task"
          workspaceSlug="workspace"
          projectId="project"
          fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
          initialValue={value}
          onSubmit={save}
          setIsSubmitting={status}
        />
      )
    );
  }
  it("updates a clean editor without autosaving the other user's content", async () => {
    await render("<p>Before</p>");
    await render("<p>Other user's update</p>");
    expect(mocks.editor.value).toBe("<p>Other user's update</p>");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(save).not.toHaveBeenCalled();
  });
  it("retains and saves a local draft instead of replacing it with a remote update", async () => {
    await render("<p>Before</p>");
    await act(() => mocks.editor.onChange?.({}, "<p>My draft</p>"));
    await render("<p>Remote change during typing</p>");
    expect(mocks.editor.value).toBe("<p>Before</p>");
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(save).toHaveBeenCalledWith({ description_html: "<p>My draft</p>", description_json: {} }, false);
    expect(mocks.editor.value).toBe("<p>My draft</p>");
    expect(status).toHaveBeenLastCalledWith("submitted");
  });
  it("does not discard new typing when an earlier autosave finishes", async () => {
    let release: (() => void) | undefined;
    save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await render("<p>Before</p>");
    await act(() => mocks.editor.onChange?.({}, "<p>First draft</p>"));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await act(() => mocks.editor.onChange?.({}, "<p>Newer draft</p>"));
    await act(async () => {
      release?.();
      await Promise.resolve();
    });
    expect(status).toHaveBeenLastCalledWith("submitting");
    await render("<p>Old save echoed by server</p>");
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(save).toHaveBeenLastCalledWith({ description_html: "<p>Newer draft</p>", description_json: {} }, false);
    expect(mocks.editor.value).toBe("<p>Newer draft</p>");
  });
  it("logs a failed save and retains the dirty draft for unmount/retry", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    save.mockRejectedValueOnce(new Error("Offline"));
    await render("<p>Before</p>");
    await act(() => mocks.editor.onChange?.({}, "<p>Retained draft</p>"));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await render("<p>Remote update</p>");
    expect(mocks.editor.value).toBe("<p>Before</p>");
    expect(log).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith("submitted");
  });
});
