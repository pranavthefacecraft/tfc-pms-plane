import { act } from "react";
import { createRoot } from "react-dom/client";
import { Command } from "cmdk";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TopNavPowerK } from "./top-nav-power-k";

const mocks = vi.hoisted(() => ({ modal: vi.fn(), inputRef: vi.fn(), selected: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "team" }) }));
vi.mock("@/hooks/store/use-power-k", () => ({
  usePowerK: () => ({ setTopNavInputRef: mocks.inputRef, togglePowerKModal: mocks.modal }),
}));
vi.mock("./workspace-search", () => ({
  WorkspaceSearch: ({ category, onClose }: { category: string; onClose: () => void }) => (
    <>
      <span data-category>{category}</span>
      {["first", "second"].map((id) => (
        <Command.Item
          key={id}
          value={id}
          ref={(node) => {
            if (node) node.scrollIntoView = vi.fn();
          }}
          onSelect={() => {
            mocks.selected(id);
            onClose();
          }}
        >
          {id}
        </Command.Item>
      ))}
    </>
  ),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  mocks.modal.mockReset();
  mocks.inputRef.mockReset();
  mocks.selected.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<TopNavPowerK />));
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function open() {
  await act(() => {
    const input = host.querySelector("input");
    input?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    input?.focus();
  });
}
function button(name: string) {
  return Array.from(host.querySelectorAll("button")).find((item) => item.textContent === name);
}
it("opens search first with entity categories, not a command list", async () => {
  expect(host.querySelector("input")?.placeholder).toBe("Search all PMS...");
  expect(host.querySelector('[aria-label="Search categories"]')).toBeNull();
  await open();
  expect(host.querySelector("[data-category]")?.textContent).toBe("all");
  for (const name of ["All", "Tasks", "Projects", "People", "Commands"]) expect(button(name)).toBeDefined();
  expect(host.querySelector("input")?.getAttribute("aria-expanded")).toBe("true");
});
it("keeps category selection and focus on the search input", async () => {
  await open();
  await act(() => button("Projects")?.click());
  expect(host.querySelector("[data-category]")?.textContent).toBe("projects");
  expect(button("Projects")?.getAttribute("aria-pressed")).toBe("true");
  expect(document.activeElement).toBe(host.querySelector("input"));
});
it("opens the existing command palette separately", async () => {
  await open();
  await act(() => button("Commands")?.click());
  expect(mocks.modal).toHaveBeenCalledWith(true);
  expect(host.querySelector('[aria-label="Search categories"]')).toBeNull();
});
it("supports arrow navigation and Enter without moving focus out of the input", async () => {
  await open();
  await act(() =>
    host.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
  );
  expect(host.querySelector('[cmdk-item][aria-selected="true"]')?.textContent).toBe("second");
  expect(document.activeElement).toBe(host.querySelector("input"));
  await act(() =>
    host.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  );
  expect(mocks.selected).toHaveBeenCalledWith("second");
  expect(host.querySelector('[aria-label="Search categories"]')).toBeNull();
});
it("dismisses with Escape and resets the category when reopened", async () => {
  await open();
  await act(() => button("People")?.click());
  await act(() =>
    host.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  );
  expect(host.querySelector('[aria-label="Search categories"]')).toBeNull();
  await open();
  expect(host.querySelector("[data-category]")?.textContent).toBe("all");
});
