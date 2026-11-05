/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveTaskUpdates } from "@/hooks/use-live-task-updates";
import { queueTaskRefresh, subscribeTaskUpdates } from "@/services/task-updates";

vi.mock("@plane/constants", () => ({ LIVE_URL: "https://pms.test/live" }));

class MockSocket extends EventTarget {
  static sockets: MockSocket[] = [];
  close = vi.fn();
  constructor(public url: URL) {
    super();
    MockSocket.sockets.push(this);
  }
  message(type: string) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type }) }));
  }
  disconnect(code: number, reason: string) {
    this.dispatchEvent(new CloseEvent("close", { code, reason }));
  }
}

describe("live task updates", () => {
  const cleanups: (() => void)[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    MockSocket.sockets = [];
    vi.stubGlobal("WebSocket", MockSocket);
  });
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shares one authenticated workspace socket and cleans it up after the last view", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeTaskUpdates("workspace", first);
    const stopSecond = subscribeTaskUpdates("workspace", second);
    cleanups.push(stopSecond);
    expect(MockSocket.sockets).toHaveLength(1);
    expect(MockSocket.sockets[0].url.toString()).toBe("wss://pms.test/live/task-updates/?workspace=workspace");
    MockSocket.sockets[0].message("invalidate");
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    stopFirst();
    expect(MockSocket.sockets[0].close).not.toHaveBeenCalled();
    stopSecond();
    expect(MockSocket.sockets[0].close).toHaveBeenCalledTimes(1);
  });

  it("isolates workspaces and catches up after reconnect, focus and visibility", async () => {
    const first = vi.fn();
    const second = vi.fn();
    cleanups.push(subscribeTaskUpdates("first", first), subscribeTaskUpdates("second", second));
    first.mockClear();
    second.mockClear();
    MockSocket.sockets[0].message("invalidate");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    MockSocket.sockets[0].disconnect(1013, "Redis reconnect");
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockSocket.sockets).toHaveLength(3);
    MockSocket.sockets[2].message("ready");
    expect(first).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(first).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalled();
  });

  it("does not repeatedly reconnect denied sessions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    cleanups.push(subscribeTaskUpdates("workspace", vi.fn()));
    MockSocket.sockets[0].disconnect(1008, "Access revoked");
    await vi.advanceTimersByTimeAsync(60000);
    expect(MockSocket.sockets).toHaveLength(1);
  });

  it("coalesces bursts within 100ms and drains events received during a fetch", async () => {
    let release: (() => void) | undefined;
    const refresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const queue = queueTaskRefresh(refresh);
    cleanups.push(queue.stop);
    for (let i = 0; i < 30; i++) queue.invalidate();
    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledTimes(1);
    queue.invalidate();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    release?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("retries failed refetches and cancels retries on unmount", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const refresh = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    const queue = queueTaskRefresh(refresh);
    queue.invalidate();
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(2);
    queue.stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes both mounted task views without a page reload and uses the latest callback", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const next = vi.fn().mockResolvedValue(undefined);
    function View({ refresh }: { refresh: () => Promise<void> }) {
      useLiveTaskUpdates("workspace", refresh);
      return null;
    }
    await act(() =>
      root.render(
        <>
          <View refresh={first} />
          <View refresh={second} />
        </>
      )
    );
    await act(async () => {
      MockSocket.sockets[0].message("ready");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    await act(() =>
      root.render(
        <>
          <View refresh={next} />
          <View refresh={second} />
        </>
      )
    );
    await act(async () => {
      MockSocket.sockets[0].message("invalidate");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(MockSocket.sockets).toHaveLength(1);
    await act(() => root.unmount());
  });
});
