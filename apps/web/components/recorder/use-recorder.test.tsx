import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRecorder } from "./use-recorder";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  build: vi.fn(),
  release: vi.fn(),
}));
vi.mock("./cap/stream-manager", () => ({
  acquireStreams: mocks.acquire,
  buildCompositeStream: mocks.build,
  releaseStreams: mocks.release,
}));
let active: FakeRecorder;
function captureInstance(instance: FakeRecorder) {
  active = instance;
}
class FakeRecorder extends EventTarget {
  static isTypeSupported() {
    return true;
  }
  state: RecordingState = "inactive";
  mimeType = "video/webm";
  constructor() {
    super();
    captureInstance(this);
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.dispatchEvent(Object.assign(new Event("dataavailable"), { data: new Blob(["captured"]) }));
      this.dispatchEvent(new Event("stop"));
    });
  }
}
let value: ReturnType<typeof useRecorder> | undefined;
function Harness() {
  value = useRecorder();
  return <p>{value.phase}</p>;
}
function current() {
  if (!value) throw new Error("Recorder not rendered");
  return value;
}
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let router: ReturnType<typeof createMemoryRouter>;
let track: EventTarget;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: vi.fn() } });
  mocks.acquire.mockReset();
  mocks.build.mockReset();
  mocks.release.mockReset();
  track = new EventTarget();
  mocks.acquire.mockResolvedValue({
    display: { getAudioTracks: () => [], getVideoTracks: () => [track] },
    camera: null,
    microphone: null,
  });
  mocks.build.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  router = createMemoryRouter([
    { path: "/", element: <Harness /> },
    { path: "/away", element: <p>Away</p> },
  ]);
  await act(() => root.render(<RouterProvider router={router} />));
});
afterEach(async () => {
  await act(() => root.unmount());
  router.dispose();
  host.remove();
  value = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("uses Cap acquisition with no webcam and retains a blob after pause/resume/stop", async () => {
  await act(() => current().start("tab", true, true));
  expect(mocks.acquire.mock.calls[0][0]).toEqual({
    mode: "tab",
    microphone: { enabled: true },
    camera: { enabled: false },
    systemAudio: true,
  });
  expect(current().warning).toContain("not shared");
  await act(() => current().pause());
  expect(active.state).toBe("paused");
  await act(() => current().resume());
  expect(active.state).toBe("recording");
  await act(() => current().stop());
  expect(current().phase).toBe("recorded");
  expect(current().blob?.size).toBeGreaterThan(0);
  expect(mocks.release).toHaveBeenCalled();
});

it("stops when the browser ends screen sharing", async () => {
  await act(() => current().start("fullscreen", false, false));
  await act(() => {
    track.dispatchEvent(new Event("ended"));
  });
  expect(current().phase).toBe("recorded");
});

it("automatically stops at 60 minutes, excluding paused time", async () => {
  vi.useFakeTimers();
  await act(() => current().start("fullscreen", false, false));
  await act(() => {
    vi.advanceTimersByTime(1000);
    current().pause();
  });
  await act(() => {
    vi.advanceTimersByTime(60000);
  });
  expect(current().durationMs).toBe(1000);
  await act(() => current().resume());
  await act(() => {
    vi.advanceTimersByTime(3599000);
  });
  expect(active.state).toBe("inactive");
  expect(current().durationMs).toBe(3600000);
});

it("surfaces capture errors and permits a later retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.acquire.mockRejectedValueOnce(new Error("Microphone permission denied"));
  await act(() => current().start("fullscreen", true, false));
  expect(current().error).toContain("Microphone permission denied");
  expect(current().phase).toBe("idle");
  await act(() => current().start("fullscreen", false, false));
  expect(current().phase).toBe("recording");
  vi.restoreAllMocks();
});

it("blocks navigation until the user chooses to leave or saves/discards", async () => {
  await act(() => current().start("fullscreen", false, false));
  await act(() => router.navigate("/away"));
  expect(current().blocker.state).toBe("blocked");
  await act(() => current().blocker.reset?.());
  expect(router.state.location.pathname).toBe("/");
  await act(() => current().discard());
  await act(() => router.navigate("/away"));
  expect(router.state.location.pathname).toBe("/away");
});

it("stops and releases devices on unmount without retaining a discarded blob", async () => {
  await act(() => current().start("fullscreen", false, false));
  await act(() => current().discard());
  expect(current().blob).toBeNull();
  await act(() => current().start("fullscreen", false, false));
  await act(() => root.render(<p>Closed</p>));
  expect(active.state).toBe("inactive");
  expect(mocks.release).toHaveBeenCalledTimes(2);
});
