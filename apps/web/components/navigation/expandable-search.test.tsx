import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useExpandableSearch } from "@/hooks/use-expandable-search";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onClose = vi.fn();

function Search() {
  const { containerRef, inputRef, isOpen, openPanel, handleClose } = useExpandableSearch({ onClose });
  return (
    <>
      <div ref={containerRef}>
        <input ref={inputRef} onFocus={openPanel} aria-label="Search" />
        {isOpen && (
          <div role="listbox">
            <button type="button">Search result</button>
            <button type="button" onClick={handleClose}>
              Close search
            </button>
          </div>
        )}
      </div>
      <button type="button" data-testid="outside">
        Outside
      </button>
      <button type="button" data-testid="stopping-outside" onPointerDown={(event) => event.stopPropagation()}>
        Outside with propagation stopped
      </button>
      <div data-prevent-outside-click="false">
        <button type="button" data-testid="sidebar-outside">
          Sidebar
        </button>
      </div>
      <div data-base-ui-portal="">
        <button type="button" data-testid="portal-outside">
          Another menu
        </button>
      </div>
    </>
  );
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  onClose.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<Search />));
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function open() {
  await act(() => host.querySelector("input")?.focus());
  expect(host.querySelector('[role="listbox"]')).not.toBeNull();
}

it.each(["outside", "stopping-outside", "sidebar-outside", "portal-outside"])(
  "closes on %s presses and resets search state",
  async (testId) => {
    await open();
    await act(() =>
      host.querySelector(`[data-testid="${testId}"]`)?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    );
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).not.toBe(host.querySelector("input"));
    expect(onClose).toHaveBeenCalledTimes(1);
  }
);

it("keeps input and search-result interactions inside the open panel", async () => {
  await open();
  await act(() => {
    host.querySelector("input")?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    host.querySelector('[role="listbox"] button')?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  });
  expect(host.querySelector('[role="listbox"]')).not.toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

it("does not reset a closed search when clicking outside", async () => {
  await act(() =>
    host.querySelector('[data-testid="outside"]')?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
  );
  expect(onClose).not.toHaveBeenCalled();
});

it("can reopen after outside dismissal", async () => {
  await open();
  await act(() =>
    host.querySelector('[data-testid="outside"]')?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
  );
  await open();
  expect(onClose).toHaveBeenCalledTimes(1);
});
