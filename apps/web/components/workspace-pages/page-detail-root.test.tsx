import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EditorRefApi } from "@plane/editor";
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WorkspacePageDetailRoot } from "./page-detail-root";
import { NotepadToolbar } from "./notepad-toolbar";

const state = vi.hoisted(() => ({
  canEdit: true,
  loading: false,
  error: undefined as Error | undefined,
  update: vi.fn(),
  apply: vi.fn(),
  detach: vi.fn(),
  access: vi.fn(),
  status: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "owner" } }),
  useUserPermissions: () => ({ allowPermissions: () => state.canEdit }),
}));
const page: TWorkspacePage = {
  id: "note",
  name: "",
  tool_type: "page",
  access: 0,
  logo_props: {},
  owned_by: "owner",
  owner: { id: "owner", display_name: "Ima", first_name: "Ima", last_name: "", avatar_url: null },
  updated_by: null,
  workspace: "team",
  created_at: "2026-11-05T01:00:00Z",
  updated_at: "2026-11-05T01:00:00Z",
  attachment: null,
  description_html: "<p>Existing content</p>",
};
vi.mock("./use-workspace-tool-page", () => ({
  useWorkspaceToolPage: () => ({
    page,
    error: state.error,
    isLoading: state.loading,
    saveStatus: "saved",
    setSaveStatus: state.status,
    applyUpdate: state.apply,
    updatePage: state.update,
    detach: state.detach,
    toggleAccess: state.access,
  }),
}));
vi.mock("@/components/editor/rich-text/description-input/root", () => ({
  DescriptionInput: ({
    initialValue,
    placeholder,
    disabled,
    onSubmit,
    onEditorReady,
  }: {
    initialValue: string;
    placeholder: string;
    disabled: boolean;
    onSubmit: (data: { description_html: string }) => Promise<void>;
    onEditorReady: (ready: boolean) => void;
  }) => {
    useEffect(() => onEditorReady(true), [onEditorReady]);
    return (
      <div data-content={initialValue}>
        <p>{placeholder}</p>
        <button
          disabled={disabled}
          onClick={() => void onSubmit({ description_html: "<p>Updated</p>" }).catch(() => {})}
        >
          Save content
        </button>
      </div>
    );
  },
}));
vi.mock("./attach-page-modal", () => ({
  AttachWorkspacePageModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog">
        <p>Attach page</p>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.canEdit = true;
  state.loading = false;
  state.error = undefined;
  state.update.mockResolvedValue(page);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(() =>
    root.render(
      <MemoryRouter>
        <WorkspacePageDetailRoot workspaceSlug="team" pageId="note" />
      </MemoryRouter>
    )
  );
}
async function click(text: string) {
  await act(() => [...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === text)!.click());
}
it("renders the bordered Notepad panel, breadcrumb, real collaborators and slash placeholder", async () => {
  await render();
  expect(host.querySelector("h1")?.textContent).toBe("Notepad");
  expect(host.querySelector('a[href="/team/tool/pages/"]')?.textContent).toBe("All pages");
  expect(host.querySelector('section[aria-label="Notepad editor"]')).not.toBeNull();
  expect(host.querySelector('textarea[placeholder="Untitled Page"]')).not.toBeNull();
  expect(host.querySelector("[data-content]")?.getAttribute("data-content")).toBe("<p>Existing content</p>");
  expect(host.textContent).toContain("Ima");
  expect(host.textContent).toContain("Start writing or type / for options");
  expect(host.textContent).not.toContain("Saved as draft");
});
it("opens and closes the same attachment popup from the persistent toolbar", async () => {
  await render();
  await click("Link Task / Project");
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Attach page");
  await click("Cancel");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it("preserves title and content saves and displays explicit save failure until success", async () => {
  await render();
  const title = host.querySelector<HTMLTextAreaElement>("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(() => {
    setter.call(title, "Project brief");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(() => title.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(state.update).toHaveBeenCalledWith({ name: "Project brief" });
  state.update.mockRejectedValueOnce(new Error("offline"));
  await click("Save content");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Not saved");
  await click("Save content");
  expect(state.update).toHaveBeenCalledWith({ description_html: "<p>Updated</p>" });
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("keeps Viewer content and title read-only and disables link/access controls", async () => {
  state.canEdit = false;
  await render();
  expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true);
  expect([...host.querySelectorAll<HTMLButtonElement>("button")].every((button) => button.disabled)).toBe(true);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it("retains loading and unavailable-page states", async () => {
  state.loading = true;
  await render();
  expect(host.textContent).toContain("Loading page...");
  state.loading = false;
  state.error = new Error("not found");
  await render();
  expect(host.textContent).toContain("Page not found");
  expect(host.querySelector('[role="toolbar"]')).toBeNull();
});
it.each([
  ["Bold", "bold"],
  ["Italic", "italic"],
  ["Bulleted list", "bulleted-list"],
])("runs %s editor command API, tracks formatting and cleans up listeners", async (label, key) => {
  let listener: (() => void) | undefined;
  let active = "text";
  const cleanup = vi.fn();
  const command = vi.fn(({ itemKey }: { itemKey: string }) => {
    active = itemKey;
    listener?.();
  });
  const editor: Pick<EditorRefApi, "isMenuItemActive" | "onStateChange" | "executeMenuItemCommand"> = {
    executeMenuItemCommand: command,
    isMenuItemActive: ({ itemKey }) => itemKey === active,
    onStateChange: (callback) => {
      listener = callback;
      return cleanup;
    },
  };
  await act(() =>
    root.render(<NotepadToolbar editorRef={{ current: editor }} ready disabled={false} onAttach={vi.fn()} />)
  );
  await act(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
  expect(command).toHaveBeenLastCalledWith({ itemKey: key });
  expect(host.querySelector(`button[aria-label="${label}"]`)?.getAttribute("aria-pressed")).toBe("true");
  const select = host.querySelector<HTMLSelectElement>("select")!;
  await act(() => {
    select.value = "h2";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(command).toHaveBeenLastCalledWith({ itemKey: "h2" });
  await act(() => root.render(<div />));
  expect(cleanup).toHaveBeenCalled();
});
