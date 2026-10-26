import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceMessageDetail } from "./message-detail";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), read: vi.fn() }));
vi.mock("@/services/workspace-message.service", () => ({ workspaceMessageService: { retrieve: mocks.retrieve } }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
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
  await act(async () =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <WorkspaceMessageDetail workspaceSlug="team" messageId="message-1" onRead={mocks.read} />
      </SWRConfig>
    )
  );
}
it("shows the subject, sender, recipients and complete plain text message without interpreting HTML", async () => {
  mocks.retrieve.mockResolvedValue({
    subject: "Important update",
    body: "<script>unsafe</script>\nSecond paragraph",
    created_at: "2026-10-26T08:00:00Z",
    sender: { display_name: "Alice" },
    recipients: [{ display_name: "Bob" }, { display_name: "Charlie" }],
  });
  await render();
  expect(mocks.retrieve).toHaveBeenCalledWith("team", "message-1");
  expect(host.querySelector("h1")?.textContent).toBe("Important update");
  expect(host.textContent).toContain("From: Alice");
  expect(host.textContent).toContain("To: Bob, Charlie");
  expect(host.textContent).toContain("<script>unsafe</script>\nSecond paragraph");
  expect(host.querySelector("script")).toBeNull();
  expect(mocks.read).toHaveBeenCalledOnce();
});
it("shows an explicit error if the message is unavailable or access is denied", async () => {
  mocks.retrieve.mockRejectedValue(new Error("Not allowed"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not open this message");
  expect(mocks.read).not.toHaveBeenCalled();
});
