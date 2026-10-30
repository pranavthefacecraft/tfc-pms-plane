import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Dialog, DialogTitle } from "@makeplane/propel/components/dialog";
import { TaskFormContent } from "./task-form-content";
import type { TTaskFormPresentation } from "./task-form-content";

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

function Form({ presentation }: { presentation: TTaskFormPresentation }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} modal={presentation === "dialog"} onOpenChange={setOpen}>
      <TaskFormContent size="md" presentation={presentation}>
        <DialogTitle>Add task</DialogTitle>
        <label>
          Task name
          <input />
        </label>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </TaskFormContent>
    </Dialog>
  );
}

it("renders an accessible, responsive right-side panel without a backdrop", async () => {
  await act(() => root.render(<Form presentation="side-panel" />));
  const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(panel).not.toBeNull();
  expect(panel.classList.contains("right-0")).toBe(true);
  expect(panel.classList.contains("inset-y-0")).toBe(true);
  expect(panel.classList.contains("md:w-1/2")).toBe(true);
  expect(panel.classList.contains("w-full")).toBe(true);
  expect(panel.classList.contains("overflow-y-auto")).toBe(true);
  expect(panel.getAttribute("aria-modal")).not.toBe("true");
  expect(document.getElementById(panel.getAttribute("aria-labelledby")!)?.textContent).toBe("Add task");
  expect(document.querySelector('[data-slot="dialog-backdrop"]')).toBeNull();
  await act(() => panel.querySelector("button")?.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("dismisses the side panel with Escape", async () => {
  await act(() => root.render(<Form presentation="side-panel" />));
  await act(() => {
    document.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("retains the existing modal content for other callers", async () => {
  await act(() => root.render(<Form presentation="dialog" />));
  const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(panel).not.toBeNull();
  expect(panel.classList.contains("right-0")).toBe(false);
  expect(panel.textContent).toContain("Add task");
});
