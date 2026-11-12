import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CapturePanel } from "./capture-panel";

const mocks = vi.hoisted(() => ({
  startUpload: vi.fn(),
  uploadPart: vi.fn(),
  complete: vi.fn(),
  remove: vi.fn(),
  discard: vi.fn(),
  blob: undefined as Blob | undefined,
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));
vi.mock("@/services/recording.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/recording.service")>();
  return { recordingService: { ...mocks, uploadRemainingParts: actual.recordingService.uploadRemainingParts } };
});
vi.mock("./use-recorder", () => ({
  useRecorder: () => ({
    phase: "recorded",
    blob: mocks.blob,
    durationMs: 1000,
    error: "",
    warning: "",
    discard: mocks.discard,
    blocker: { state: "unblocked" },
  }),
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const saved = vi.fn();
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  mocks.startUpload.mockReset();
  mocks.uploadPart.mockReset();
  mocks.complete.mockReset();
  mocks.remove.mockReset();
  mocks.discard.mockReset();
  saved.mockReset();
  mocks.blob = new Blob(["x".repeat(5 * 1024 * 1024 + 12)], { type: "video/webm;codecs=vp8" });
  mocks.startUpload.mockResolvedValue({ id: "recording-id", part_size: 5 * 1024 * 1024 });
  mocks.uploadPart.mockResolvedValue({});
  mocks.complete.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<CapturePanel workspaceSlug="test" onSaved={saved} />));
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
it("sends raw 5 MiB parts and only discards the local blob after completion succeeds", async () => {
  await act(async () => button("Save recording").click());
  expect(mocks.uploadPart.mock.calls.map((call) => [call[2], call[3].size])).toEqual([
    [1, 5 * 1024 * 1024],
    [2, 12],
  ]);
  expect(mocks.complete).toHaveBeenCalledWith("test", "recording-id");
  expect(mocks.discard).toHaveBeenCalledTimes(1);
  expect(saved).toHaveBeenCalledTimes(1);
});
it("preserves local content and resumes at the failed part on retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.uploadPart.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Network lost"));
  await act(async () => button("Save recording").click());
  expect(mocks.discard).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("preserved");
  expect(host.querySelector("a[download]")?.getAttribute("href")).toBe("blob:preview");
  await act(async () => button("Resume / retry save").click());
  expect(mocks.startUpload).toHaveBeenCalledTimes(1);
  expect(mocks.uploadPart.mock.calls.map((call) => call[2])).toEqual([1, 2, 2]);
  expect(saved).toHaveBeenCalledTimes(1);
});
it("retries completion without reuploading parts after a completion failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.complete.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({});
  await act(async () => button("Save recording").click());
  expect(mocks.discard).not.toHaveBeenCalled();
  await act(async () => button("Resume / retry save").click());
  expect(mocks.uploadPart).toHaveBeenCalledTimes(2);
  expect(mocks.complete).toHaveBeenCalledTimes(2);
});

it("pauses an upload after the in-flight part and resumes without losing its blob", async () => {
  let finish: (() => void) | undefined;
  mocks.uploadPart.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  await act(() => button("Save recording").click());
  await act(() => button("Pause upload").click());
  await act(() => finish?.());
  expect(mocks.uploadPart).toHaveBeenCalledTimes(1);
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(mocks.discard).not.toHaveBeenCalled();
  await act(async () => button("Resume / retry save").click());
  expect(mocks.uploadPart.mock.calls.map((call) => call[2])).toEqual([1, 2]);
  expect(saved).toHaveBeenCalledTimes(1);
});
