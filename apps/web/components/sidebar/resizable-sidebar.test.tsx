import { act, useCallback, useRef, useState } from "react";
import { useOutsideClickDetector } from "@plane/hooks";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResizableSidebar } from "./resizable-sidebar";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function SidebarContent({ close }: { close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClickDetector(ref, close);
  return (
    <div ref={ref}>
      <button data-testid="sidebar-content" onClick={close}>
        Close sidebar
      </button>
      <button data-testid="sidebar-link">Navigation</button>
    </div>
  );
}

function Harness() {
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const [width, setWidth] = useState(250);
  const toggleCollapsed = useCallback((value?: boolean) => setCollapsed((current) => value ?? !current), []);
  return (
    <>
      <button onClick={() => setCollapsed(false)}>Open sidebar</button>
      <button onClick={() => setPeek(true)}>Peek sidebar</button>
      <ResizableSidebar
        width={width}
        setWidth={setWidth}
        isCollapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        showPeek={peek}
        togglePeek={(value) => setPeek((current) => value ?? !current)}
      >
        <SidebarContent close={() => setCollapsed(true)} />
      </ResizableSidebar>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(400);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("opens and closes at mobile viewport widths without mounting hidden sidebar content", async () => {
  await act(() => root.render(<Harness />));
  expect(host.querySelectorAll('[data-testid="sidebar-content"]')).toHaveLength(0);
  await act(() => host.querySelector<HTMLButtonElement>("button")?.click());
  expect(host.querySelectorAll('[data-testid="sidebar-content"]')).toHaveLength(1);
  expect(host.querySelector("#main-sidebar")?.classList.contains("max-md:absolute")).toBe(true);
  expect(host.querySelector("#main-sidebar")?.getAttribute("style")).toContain("width: 250px");
  await act(() =>
    host.querySelector('[data-testid="sidebar-link"]')?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  );
  expect(host.querySelectorAll('[data-testid="sidebar-content"]')).toHaveLength(1);
  await act(() => host.querySelector<HTMLButtonElement>('[data-testid="sidebar-content"]')?.click());
  expect(host.querySelectorAll('[data-testid="sidebar-content"]')).toHaveLength(0);
});

it("closes mobile navigation on an outside press", async () => {
  await act(() => root.render(<Harness />));
  await act(() => host.querySelector<HTMLButtonElement>("button")?.click());
  await act(() => document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  expect(host.querySelectorAll('[data-testid="sidebar-content"]')).toHaveLength(0);
});

it("mounts only the peek content when collapsed", async () => {
  await act(() => root.render(<Harness />));
  await act(() => host.querySelectorAll<HTMLButtonElement>("button")[1].click());
  expect(host.querySelectorAll('[data-testid="sidebar-content"]')).toHaveLength(1);
  expect(host.querySelector("#main-sidebar [data-testid]")).toBeNull();
});
