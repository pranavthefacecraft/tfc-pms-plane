/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { create, isAxiosError } from "axios";
import type { Request } from "express";
import { WebSocket } from "ws";
import { Controller, WebSocket as WSDecorator } from "@plane/decorators";
import { logger } from "@plane/logger";
import { env } from "@/env";
import { taskEvents } from "@/task-events";

@Controller("/task-updates")
export class TaskUpdatesController {
  [key: string]: unknown;

  @WSDecorator("/")
  handleConnection(ws: WebSocket, req: Request) {
    const slug = req.query.workspace;
    const origin = req.headers.origin;
    if (
      typeof slug !== "string" ||
      !/^[\w-]{1,255}$/.test(slug) ||
      !req.headers.cookie ||
      !origin ||
      !env.CORS_ALLOWED_ORIGINS.split(",")
        .map((value) => value.trim())
        .includes(origin)
    ) {
      ws.close(1008, "Task updates credentials or origin invalid");
      return;
    }
    const client = create({ timeout: 10000, headers: { Cookie: req.headers.cookie } });
    const url = `${env.API_BASE_URL.replace(/\/$/, "")}/api/workspaces/${slug}/`;
    let closed = false;
    let alive = true;
    let pending = false;
    let dirty = false;
    let unsubscribe: (() => void) | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const send = (type: "ready" | "invalidate") => {
      if (closed || ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 64 * 1024) ws.close(1013, "Slow task updates connection");
      else ws.send(JSON.stringify({ type }));
    };
    const authorize = async () => {
      const response = await client.get<{ id: string }>(url);
      if (!response.data.id) throw new Error("Workspace authorization returned no ID");
      return response.data.id;
    };
    const failure = (error: unknown) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      logger.error("TASK_UPDATES: workspace authorization failed", { status });
      ws.close(status === 401 || status === 403 || status === 404 ? 1008 : 1013, "Task updates unavailable");
    };
    const flush = async () => {
      if (pending || closed) return;
      pending = true;
      dirty = false;
      try {
        await authorize();
        send("invalidate");
      } catch (error) {
        failure(error);
      } finally {
        pending = false;
        if (dirty && !closed) schedule();
      }
    };
    const schedule = () => {
      dirty = true;
      if (!flushTimer && !pending && !closed)
        flushTimer = setTimeout(() => {
          flushTimer = undefined;
          void flush();
        }, 100);
    };
    ws.on("pong", () => {
      alive = true;
    });
    ws.on("error", (error) => logger.error("TASK_UPDATES: socket failed", error));
    ws.on("message", () => ws.close(1008, "Task updates is a read-only stream"));
    const heartbeat = setInterval(() => {
      if (closed) return;
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
      if (!pending) {
        pending = true;
        void authorize()
          .catch(failure)
          .finally(() => {
            pending = false;
            if (dirty) schedule();
          });
      }
    }, 30000);
    ws.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(flushTimer);
      unsubscribe?.();
    });
    void authorize()
      .then((workspaceId) => {
        if (closed) return;
        unsubscribe = taskEvents.subscribe(workspaceId, {
          invalidate: schedule,
          disconnect: () => ws.close(1013, "Task updates reconnecting"),
        });
        send("ready");
      })
      .catch(failure);
  }
}
