/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import { create, isAxiosError } from "axios";
import type { Request } from "express";
import { WebSocket } from "ws";
import { Controller, WebSocket as WSDecorator } from "@plane/decorators";
import { logger } from "@plane/logger";
import { env } from "@/env";

type Peer = { refresh: () => Promise<void> };
const rooms = new Map<string, Set<Peer>>();

@Controller("/whiteboards")
export class WhiteboardController {
  [key: string]: unknown;

  @WSDecorator("/")
  handleConnection(ws: WebSocket, req: Request) {
    const slug = req.query.workspace;
    const board = req.query.board;
    const origin = req.headers.origin;
    const allowed = env.CORS_ALLOWED_ORIGINS.split(",").map((value) => value.trim());
    if (
      typeof slug !== "string" ||
      !/^[\w-]{1,255}$/.test(slug) ||
      typeof board !== "string" ||
      !/^[a-f\d-]{36}$/i.test(board) ||
      !origin ||
      !allowed.includes(origin) ||
      !req.headers.cookie
    ) {
      ws.close(1008, "Whiteboard credentials or origin invalid");
      return;
    }
    const cookie = req.headers.cookie;
    const csrf = cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("csrftoken="))
      ?.slice(10);
    const clientId = randomUUID();
    const url = `${env.API_BASE_URL.replace(/\/$/, "")}/api/workspaces/${slug}/workspace-pages/${board}/session/`;
    const client = create({
      timeout: 15000,
      headers: { Cookie: cookie, ...(csrf ? { "X-CSRFToken": csrf } : {}) },
      maxBodyLength: 10 * 1024 * 1024,
      maxContentLength: 12 * 1024 * 1024,
    });
    let closed = false;
    let ready = false;
    let busy = false;
    let heartbeatPending = false;
    let alive = true;
    ws.on("pong", () => {
      alive = true;
    });
    const send = (payload: unknown) => {
      if (!closed && ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > 16 * 1024 * 1024) ws.close(1013, "Slow connection; reconnect");
        else ws.send(JSON.stringify(payload));
      }
    };
    const failure = (error: unknown, fatal = false) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      logger.error("WHITEBOARD: session request failed", { status });
      if (status === 401 || status === 404 || (status === 403 && fatal)) ws.close(1008, "Whiteboard access expired");
      else send({ type: "error", message: "Whiteboard operation failed. Reconnect or retry.", status });
    };
    const peer: Peer = {
      refresh: async () => {
        try {
          const response = await client.get(url);
          send({ type: "state", clientId, state: response.data });
        } catch (error) {
          failure(error, true);
        }
      },
    };
    const roomKey = `${slug}:${board}`;
    const broadcast = () => {
      for (const member of rooms.get(roomKey) ?? []) void member.refresh();
    };
    const post = (data: Record<string, unknown>) => client.post(url, { ...data, client_id: clientId });
    ws.on("message", async (raw) => {
      if (!ready || closed) return;
      if (Buffer.byteLength(raw.toString()) > 9 * 1024 * 1024) {
        ws.close(1009, "Whiteboard update too large");
        return;
      }
      if (busy) {
        send({ type: "error", message: "Wait for the previous update to finish." });
        return;
      }
      busy = true;
      try {
        const data: unknown = JSON.parse(raw.toString());
        if (
          !data ||
          typeof data !== "object" ||
          !("action" in data) ||
          !["scene", "present", "stop", "viewport"].includes(String(data.action))
        ) {
          send({ type: "error", message: "Invalid whiteboard operation." });
          return;
        }
        const response = await post(data as Record<string, unknown>);
        send({ type: "ack", clientId, state: response.data });
        broadcast();
      } catch (error) {
        failure(error);
      } finally {
        busy = false;
      }
    });
    const timer = setInterval(() => {
      if (!ready || closed || heartbeatPending) return;
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
      heartbeatPending = true;
      void post({ action: "heartbeat" })
        .then((response) => {
          send({ type: "state", clientId, state: response.data });
        })
        .catch((error: unknown) => failure(error, true))
        .finally(() => {
          heartbeatPending = false;
        });
    }, 5000);
    ws.on("close", () => {
      closed = true;
      clearInterval(timer);
      const room = rooms.get(roomKey);
      room?.delete(peer);
      if (room?.size === 0) rooms.delete(roomKey);
      if (ready)
        void post({ action: "leave" })
          .then(broadcast)
          .catch((error: unknown) => {
            logger.error("WHITEBOARD: could not end presence lease", error);
          });
    });
    ws.on("error", (error) => {
      logger.error("WHITEBOARD: socket error", error);
      ws.close(1011, "Whiteboard connection failed");
    });
    void post({ action: "heartbeat" })
      .then((response) => {
        if (closed) return;
        ready = true;
        const room = rooms.get(roomKey) ?? new Set<Peer>();
        room.add(peer);
        rooms.set(roomKey, room);
        send({ type: "state", clientId, state: response.data });
        broadcast();
      })
      .catch((error: unknown) => {
        failure(error);
        ws.close(1008, "Unable to join whiteboard");
      });
  }
}
