/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { LIVE_URL } from "@plane/constants";

type Listener = () => void;
const connections = new Map<string, { listeners: Set<Listener>; stop: () => void }>();

export function subscribeTaskUpdates(workspaceSlug: string, listener: Listener) {
  let connection = connections.get(workspaceSlug);
  if (!connection) {
    const listeners = new Set<Listener>();
    let socket: WebSocket | undefined;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    const invalidate = () => {
      for (const callback of listeners) callback();
    };
    const connect = () => {
      if (stopped) return;
      const url = new URL(`${LIVE_URL.replace(/\/$/, "")}/task-updates/`, window.location.origin);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("workspace", workspaceSlug);
      socket = new WebSocket(url);
      socket.addEventListener("message", (event) => {
        try {
          const data: unknown = JSON.parse(String(event.data));
          if (
            data &&
            typeof data === "object" &&
            "type" in data &&
            (data.type === "ready" || data.type === "invalidate")
          ) {
            retries = 0;
            invalidate();
          } else console.error("Invalid task updates message");
        } catch (error) {
          console.error("Could not read task updates:", error);
        }
      });
      socket.addEventListener("error", (event) => console.error("Task updates connection failed:", event));
      socket.addEventListener("close", (event) => {
        if (stopped) return;
        console.error("Task updates disconnected:", event.code, event.reason);
        if (event.code === 1008) return;
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 30000));
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    window.addEventListener("focus", invalidate);
    window.addEventListener("online", invalidate);
    document.addEventListener("visibilitychange", onVisible);
    connection = {
      listeners,
      stop: () => {
        stopped = true;
        clearTimeout(retryTimer);
        socket?.close();
        window.removeEventListener("focus", invalidate);
        window.removeEventListener("online", invalidate);
        document.removeEventListener("visibilitychange", onVisible);
      },
    };
    connections.set(workspaceSlug, connection);
    connect();
  }
  connection.listeners.add(listener);
  return () => {
    if (!connection.listeners.delete(listener)) return;
    if (!connection.listeners.size) {
      connection.stop();
      connections.delete(workspaceSlug);
    }
  };
}

export function queueTaskRefresh(refresh: () => Promise<unknown>) {
  let disposed = false;
  let pending = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    timer = undefined;
    if (disposed || pending) return;
    pending = true;
    dirty = false;
    let failed = false;
    try {
      await refresh();
    } catch (error) {
      console.error("Could not refresh live task data:", error);
      failed = true;
      dirty = true;
    } finally {
      pending = false;
      if (dirty && !disposed) timer = setTimeout(() => void run(), failed ? 5000 : 100);
    }
  };
  return {
    invalidate: () => {
      dirty = true;
      if (!pending && !timer && !disposed) timer = setTimeout(() => void run(), 100);
    },
    stop: () => {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
