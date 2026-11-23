import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DrawerCommentToolbar } from "./lite-toolbar";

vi.mock("@plane/editor", () => ({ IMAGE_ITEM: { itemKey: "image" } }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("connects the visible mention, attachment and submit actions to the editor", async () => {
  const editorRef = {
    focus: vi.fn(),
    setEditorValueAtCursorPosition: vi.fn(),
    executeMenuItemCommand: vi.fn(),
    isEditorReadyToDiscard: () => true,
  };
  const onSubmit = vi.fn();
  await act(() =>
    root.render(
      <DrawerCommentToolbar
        editorRef={editorRef}
        isEmpty={false}
        isSubmitting={false}
        submitLabel="Comment"
        onSubmit={onSubmit}
      />
    )
  );
  const buttons = host.querySelectorAll("button");
  await act(() => buttons[0].click());
  expect(editorRef.focus).toHaveBeenCalledWith("end");
  expect(editorRef.setEditorValueAtCursorPosition).toHaveBeenCalledWith("@");
  await act(() => buttons[1].click());
  expect(editorRef.executeMenuItemCommand).toHaveBeenCalledWith({ itemKey: "attachment", savedSelection: null });
  await act(() => buttons[2].click());
  expect(onSubmit).toHaveBeenCalledOnce();
  await act(() =>
    root.render(
      <DrawerCommentToolbar
        editorRef={editorRef}
        isEmpty
        isSubmitting={false}
        submitLabel="Comment"
        onSubmit={onSubmit}
      />
    )
  );
  expect(host.querySelectorAll("button")[2].disabled).toBe(true);
});

it("disables all actions until the editor is ready", async () => {
  await act(() =>
    root.render(
      <DrawerCommentToolbar editorRef={null} isEmpty isSubmitting={false} submitLabel="Comment" onSubmit={vi.fn()} />
    )
  );
  expect([...host.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
});
