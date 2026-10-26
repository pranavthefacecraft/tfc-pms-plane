import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { AddSection } from "./add-section";

const state = vi.hoisted(() => ({
  role: 20,
  archived: false,
  create: vi.fn(),
  toast: vi.fn(),
  permissions: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@plane/blocks/common", () => ({ ColorSwatchPicker: () => <div>Color picker</div> }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: state.permissions }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => ({ createState: state.create }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ archived_at: state.archived ? "2026-01-01" : null }) }),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  state.create.mockReset();
  state.role = EUserPermissions.ADMIN;
  state.archived = false;
  state.permissions.mockImplementation((roles: number[]) => roles.includes(state.role));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // eslint-disable-next-line no-extend-native -- jsdom lacks the Web Animations API used by Propel.
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function button(label: string) {
  const result = Array.from(document.querySelectorAll("button")).find((item) => item.textContent === label);
  expect(result, `button ${label}`).toBeDefined();
  return result!;
}
async function open() {
  await act(() => root.render(<AddSection workspaceSlug="workspace" projectId="project" />));
  await act(() => button("Add section").click());
}
async function name(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[name="name"]')!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it.each([EUserPermissions.MEMBER, EUserPermissions.GUEST, -1])("hides state creation for role %s", async (role) => {
  state.role = role;
  await act(() => root.render(<AddSection workspaceSlug="workspace" projectId="project" />));
  expect(host.querySelector("button")).toBeNull();
});
it("checks admin permissions in the explicit project and hides archived projects", async () => {
  state.archived = true;
  await act(() => root.render(<AddSection workspaceSlug="workspace" projectId="project" />));
  expect(state.permissions).toHaveBeenCalledWith(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    "workspace",
    "project"
  );
  expect(host.querySelector("button")).toBeNull();
});
it("creates a trimmed project state, retains the form when changing groups, and closes on success", async () => {
  await open();
  await name("  Review  ");
  const group = document.querySelector<HTMLSelectElement>("select")!;
  expect(group.value).toBe("unstarted");
  expect(group.options).toHaveLength(5);
  await act(() => {
    group.value = "started";
    group.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(document.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe("  Review  ");
  await act(() => button("Create section").click());
  expect(state.create).toHaveBeenCalledExactlyOnceWith(
    "workspace",
    "project",
    expect.objectContaining({ name: "Review", group: "started", color: "#3f76ff" })
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
});
it("does not create blank or whitespace-only sections", async () => {
  await open();
  await act(() => button("Create section").click());
  await name("   ");
  await act(() => button("Create section").click());
  expect(state.create).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("name is required");
});
it.each([
  [{ status: 400, data: { name: ["The state name is already taken"] } }, "The state name is already taken"],
  [{ status: 403, data: { error: "Permission denied" } }, "Permission denied"],
  [undefined, "Section could not be created. Please try again."],
])("retains the draft and exposes API or network errors: %s", async (error, message) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.create.mockRejectedValueOnce(error);
  await open();
  await name("Review");
  await act(() => button("Create section").click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(message);
  expect(document.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe("Review");
  expect(button("Create section").disabled).toBe(false);
  await act(() => button("Create section").click());
  expect(state.create).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("prevents duplicate submissions and dismissal while saving", async () => {
  let complete: (() => void) | undefined;
  state.create.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      })
  );
  await open();
  await name("Review");
  await act(() => {
    button("Create section").click();
    button("Create section").click();
  });
  expect(state.create).toHaveBeenCalledOnce();
  expect(button("Creating...").disabled).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  expect(document.querySelector("select")?.disabled).toBe(true);
  await act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(complete).toBeDefined();
  await act(() => complete!());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("cancels without a request and starts a fresh form on reopening", async () => {
  await open();
  await name("Unsaved");
  await act(() => button("Cancel").click());
  expect(state.create).not.toHaveBeenCalled();
  await act(() => button("Add section").click());
  expect(document.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe("");
});
