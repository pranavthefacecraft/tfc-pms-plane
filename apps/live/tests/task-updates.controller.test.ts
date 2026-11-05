/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import expressWs from "express-ws";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerController } from "@plane/decorators";
import { TaskUpdatesController } from "@/controllers/task-updates.controller";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  rooms: new Map<string, Set<{ invalidate: () => void; disconnect: () => void }>>(),
}));
vi.mock("@/env", () => ({ env: { API_BASE_URL: "http://api.test", CORS_ALLOWED_ORIGINS: "https://pms.test" } }));
vi.mock("@plane/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("axios", () => ({
  create: ({ headers }: { headers: { Cookie: string } }) => ({ get: (url: string) => mocks.get(url, headers.Cookie) }),
  isAxiosError: (error: unknown) => Boolean(error && typeof error === "object" && "response" in error),
}));
vi.mock("@/task-events", () => ({
  taskEvents: {
    subscribe: (id: string, listener: { invalidate: () => void; disconnect: () => void }) => {
      const room = mocks.rooms.get(id) ?? new Set();
      room.add(listener);
      mocks.rooms.set(id, room);
      return () => room.delete(listener);
    },
  },
}));

describe("authenticated task update sockets", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]>;
  let base: string;
  const sockets: WebSocket[] = [];
  beforeEach(async () => {
    mocks.rooms.clear();
    mocks.get.mockReset().mockImplementation(async (url: string, cookie: string) => {
      if (cookie === "sessionid=denied") throw { response: { status: 403 } };
      return { data: { id: url.includes("/other/") ? "other-id" : "workspace-id" } };
    });
    const app = express();
    expressWs(app);
    const router = express.Router();
    registerController(router, TaskUpdatesController);
    app.use("/live", router);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/live/task-updates/`;
  });
  afterEach(async () => {
    await Promise.all(
      sockets.splice(0).map(async (socket) => {
        if (socket.readyState !== WebSocket.CLOSED) {
          const closed = once(socket, "close");
          socket.terminate();
          await closed;
        }
      })
    );
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      })
    );
  });
  function connect(workspace = "workspace", cookie = "sessionid=member", origin = "https://pms.test") {
    const socket = new WebSocket(`${base}?workspace=${workspace}`, { headers: { Cookie: cookie, Origin: origin } });
    sockets.push(socket);
    return socket;
  }
  async function ready(socket: WebSocket) {
    const [raw] = await once(socket, "message");
    expect(JSON.parse(raw.toString())).toEqual({ type: "ready" });
  }

  it("delivers one coalesced update to two independent browsers within 500ms, not another workspace", async () => {
    const first = connect("workspace", "sessionid=first-user");
    const second = connect("workspace", "sessionid=second-user");
    const other = connect("other");
    await Promise.all([ready(first), ready(second), ready(other)]);
    const otherMessage = vi.fn();
    other.on("message", otherMessage);
    const start = performance.now();
    const messages = [once(first, "message"), once(second, "message")];
    for (let i = 0; i < 20; i++) for (const listener of mocks.rooms.get("workspace-id") ?? []) listener.invalidate();
    const result = await Promise.all(messages);
    expect(result.map(([raw]) => JSON.parse(raw.toString()))).toEqual([{ type: "invalidate" }, { type: "invalidate" }]);
    expect(performance.now() - start).toBeLessThan(500);
    expect(otherMessage).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith("http://api.test/api/workspaces/workspace/", "sessionid=first-user");
    expect(mocks.get).toHaveBeenCalledWith("http://api.test/api/workspaces/workspace/", "sessionid=second-user");
  });

  it.each([
    ["denied session", "workspace", "sessionid=denied", "https://pms.test"],
    ["cross-origin connection", "workspace", "sessionid=member", "https://attacker.test"],
    ["invalid workspace", "../workspace", "sessionid=member", "https://pms.test"],
    ["missing cookie", "workspace", "", "https://pms.test"],
  ])("rejects %s without joining a room", async (_name, workspace, cookie, origin) => {
    const socket = connect(workspace, cookie, origin);
    const [code] = await once(socket, "close");
    expect(code).toBe(1008);
    expect(mocks.rooms.size).toBe(0);
  });

  it("rechecks authorization before sending events and closes revoked sessions", async () => {
    const socket = connect();
    await ready(socket);
    mocks.get.mockRejectedValue({ response: { status: 403 } });
    const messages = vi.fn();
    socket.on("message", messages);
    const closed = once(socket, "close");
    for (const listener of mocks.rooms.get("workspace-id") ?? []) listener.invalidate();
    const [code] = await closed;
    expect(code).toBe(1008);
    expect(messages).not.toHaveBeenCalled();
  });

  it("closes clients for Redis reconnect catch-up and removes listeners", async () => {
    const socket = connect();
    await ready(socket);
    const closed = once(socket, "close");
    for (const listener of mocks.rooms.get("workspace-id") ?? []) listener.disconnect();
    const [code] = await closed;
    expect(code).toBe(1013);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mocks.rooms.get("workspace-id")?.size).toBe(0);
  });

  it("rejects writes to the notification stream", async () => {
    const socket = connect();
    await ready(socket);
    const closed = once(socket, "close");
    socket.send(JSON.stringify({ description_html: "Overwrite task" }));
    expect((await closed)[0]).toBe(1008);
  });
});
