import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LogoSpinner } from "./logo-spinner";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("uses the Clevdex loading logo with original colors and reduced-motion-aware animation", async () => {
  await act(() => root.render(<LogoSpinner />));
  expect(host.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe("Loading Clevdex");
  const image = host.querySelector("img")!;
  expect(image.getAttribute("src")).toContain("clevdex-loading-logo.png");
  expect(image.alt).toBe("Clevdex");
  expect(image.className).not.toContain("invert");
  expect(image.className).toContain("motion-safe:animate-pulse");
  expect(image.className).toContain("h-auto");
  expect(image.className).toContain("max-w-full");
});
