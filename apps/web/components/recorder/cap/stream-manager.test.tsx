import { afterEach, expect, it, vi } from "vitest";
import { acquireStreams } from "./stream-manager";

afterEach(() => vi.unstubAllGlobals());

it("does not silently omit a requested microphone when permission fails", async () => {
  const stop = vi.fn();
  const getDisplayMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  const getUserMedia = vi.fn().mockRejectedValue(new Error("Permission denied"));
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia, getUserMedia } });
  await expect(
    acquireStreams(
      { mode: "fullscreen", camera: { enabled: false }, microphone: { enabled: true } },
      new AbortController().signal
    )
  ).rejects.toThrow("Permission denied");
  expect(stop).toHaveBeenCalled();
  expect(getUserMedia).toHaveBeenCalledWith({ video: false, audio: true });
});

it("releases late-arriving screen tracks after capture was cancelled", async () => {
  let finish: ((stream: { getTracks: () => { stop: () => void }[] }) => void) | undefined;
  const getDisplayMedia = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  const controller = new AbortController();
  const pending = acquireStreams(
    { mode: "fullscreen", camera: { enabled: false }, microphone: { enabled: false } },
    controller.signal
  );
  controller.abort();
  const stop = vi.fn();
  finish?.({ getTracks: () => [{ stop }] });
  await expect(pending).rejects.toThrow();
  expect(stop).toHaveBeenCalled();
});
