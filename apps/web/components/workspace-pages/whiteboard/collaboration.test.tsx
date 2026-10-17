/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWhiteboardCollaboration } from "./collaboration";
import type { TBoardSession } from "./collaboration";

vi.mock("@plane/constants", () => ({ LIVE_URL: "http://localhost:3100/live" }));

class TestSocket extends EventTarget {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 1;
  sent: string[] = [];
  constructor(public url: URL) {
    super();
    TestSocket.instances.push(this);
  }
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
  message(value: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) }));
  }
}

function state(revision = 1): TBoardSession {
  return {
    revision,
    role: "editor",
    scene: { elements: [] },
    participants: [],
    presenter: null,
    user: { id: "member", display_name: "Member", first_name: "Member", last_name: "", avatar_url: null },
  };
}

describe("whiteboard live session", () => {
  let root: ReturnType<typeof createRoot>;
  let host: HTMLDivElement;
  let session: ReturnType<typeof useWhiteboardCollaboration>;
  function Harness() {
    session = useWhiteboardCollaboration("workspace", "board");
    return null;
  }
  beforeEach(async () => {
    vi.stubGlobal("WebSocket", TestSocket);
    TestSocket.instances = [];
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(() => root.render(<Harness />));
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("opens a workspace-scoped websocket and ignores out-of-order state", async () => {
    const ws = TestSocket.instances[0];
    expect(ws.url.toString()).toBe("ws://localhost:3100/live/whiteboards/?workspace=workspace&board=board");
    expect(session.connected).toBe(false);
    await act(() => ws.message({ type: "state", state: state(5), clientId: "tab" }));
    await act(() => ws.message({ type: "state", state: state(2), clientId: "tab" }));
    expect(session.connected).toBe(true);
    expect(session.state?.revision).toBe(5);
  });

  it("waits for server acknowledgement and surfaces rejected updates", async () => {
    const ws = TestSocket.instances[0];
    await act(() => ws.message({ type: "state", state: state(), clientId: "tab" }));
    const saved = session.send({ action: "scene", scene: { elements: [] } });
    await act(() => ws.message({ type: "ack", state: state(2), clientId: "tab" }));
    await expect(saved).resolves.toBeUndefined();
    const failed = session.send({ action: "scene" });
    const rejected = expect(failed).rejects.toThrow("Viewer access");
    await act(() => ws.message({ type: "error", message: "Viewer access" }));
    await rejected;
    expect(session.error).toBe("Viewer access");
  });

  it("rejects pending writes on disconnect and creates a fresh session on reconnect", async () => {
    const ws = TestSocket.instances[0];
    await act(() => ws.message({ type: "state", state: state(), clientId: "tab" }));
    const failed = session.send({ action: "scene" });
    const rejected = expect(failed).rejects.toThrow("connection lost");
    await act(() => ws.close());
    await rejected;
    expect(session.connected).toBe(false);
    await act(() => session.reconnect());
    expect(TestSocket.instances).toHaveLength(2);
    await act(() =>
      TestSocket.instances[1].message({ type: "state", state: { ...state(10), role: "viewer" }, clientId: "new-tab" })
    );
    expect(session.clientId).toBe("new-tab");
    expect(session.state?.role).toBe("viewer");
  });
});
