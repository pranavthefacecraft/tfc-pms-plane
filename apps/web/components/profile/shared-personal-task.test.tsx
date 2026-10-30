import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SharedPersonalTaskPage from "@/app/shared-personal-task";

const state = vi.hoisted(() => ({ shared: vi.fn() }));
vi.mock("react-router", () => ({ useParams: () => ({ token: "public-token" }) }));
vi.mock("@/services/personal-task.service", () => ({ personalTaskService: { shared: state.shared } }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.resetAllMocks();
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
async function render() {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <SharedPersonalTaskPage />
      </SWRConfig>
    )
  );
}
it("renders shared task details read-only and escapes user content", async () => {
  state.shared.mockResolvedValue({
    name: "Buy toys",
    description: "<img src=x onerror=alert(1)>",
    priority: "low",
    start_date: null,
    target_date: "2026-10-30",
    completed_at: null,
  });
  await render();
  expect(state.shared).toHaveBeenCalledWith("public-token");
  expect(host.querySelector("h1")?.textContent).toBe("Buy toys");
  expect(host.textContent).toContain("Read only");
  expect(host.textContent).toContain("<img");
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelectorAll("button,input,textarea")).toHaveLength(0);
});
it("shows a clear unavailable state for revoked links instead of an empty task", async () => {
  state.shared.mockRejectedValue(new Error("not found"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("link may have been revoked");
  expect(host.querySelector("h1")).toBeNull();
});
