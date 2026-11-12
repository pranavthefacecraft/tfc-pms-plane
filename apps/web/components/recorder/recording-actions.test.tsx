import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RecordingActions } from "./recording-actions";
import type { TRecording } from "@/services/recording.service";

const mocks = vi.hoisted(() => ({ share: vi.fn(), attach: vi.fn(), remove: vi.fn(), toast: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/services/recording.service", () => ({ recordingService: mocks }));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    fetchWorkspaceMembers = vi.fn();
  },
}));
vi.mock("swr", () => ({
  default: () => ({
    data: [
      { member: { id: "teammate", display_name: "Teammate" }, is_active: true },
      { member: { id: "owner", display_name: "Owner" }, is_active: true },
      { member: { id: "bot", is_bot: true }, is_active: true },
    ],
  }),
}));
vi.mock("@/components/workspace-pages/use-attachment-search", () => ({
  useAttachmentSearch: () => ({
    issues: [{ id: "task-id", name: "Example task", project__identifier: "PMS", sequence_id: 1 }],
    loading: false,
    error: "",
    retry: vi.fn(),
  }),
}));
const recording: TRecording = {
  id: "recording",
  name: "Demo",
  owner_id: "owner",
  owner_name: "Owner",
  size: 12,
  duration_ms: 1000,
  content_type: "video/webm",
  ready: true,
  created_at: "",
  viewer_ids: ["teammate"],
  shared: true,
};
const changed = vi.fn();
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.share.mockReset();
  mocks.attach.mockReset();
  mocks.remove.mockReset();
  mocks.toast.mockReset();
  changed.mockReset();
  mocks.share.mockResolvedValue({});
  mocks.attach.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root.render(<RecordingActions workspaceSlug="workspace" recording={recording} onChanged={changed} />)
  );
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function button(label: string) {
  const result = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label);
  if (!result) throw new Error(`Missing button ${label}`);
  return result;
}
it("revokes sharing by clearing selected human teammates", async () => {
  await act(() => button("Share").click());
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(checkbox.checked).toBe(true);
  await act(() => checkbox.click());
  await act(async () => button("Save sharing").click());
  expect(mocks.share).toHaveBeenCalledWith("workspace", "recording", []);
  expect(changed).toHaveBeenCalled();
});
it("links a task without implicitly changing sharing", async () => {
  await act(() => button("Attach to task").click());
  expect(host.textContent).toContain("does not grant access");
  await act(async () => button("PMS-1 Example task").click());
  expect(mocks.attach).toHaveBeenCalledWith("workspace", "recording", "task-id");
  expect(mocks.share).not.toHaveBeenCalled();
});
it("requires confirmation before deleting and reports errors without success", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.remove.mockRejectedValueOnce(new Error("Storage unavailable"));
  await act(() => button("Delete").click());
  expect(mocks.remove).not.toHaveBeenCalled();
  await act(async () => button("Confirm delete").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not complete");
  expect(mocks.toast).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
});
