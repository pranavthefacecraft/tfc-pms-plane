/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type Redis from "ioredis";
import { logger } from "@plane/logger";
import { redisManager } from "@/redis";

type Listener = { invalidate: () => void; disconnect: () => void };

export class TaskEvents {
  private subscriber: Redis | undefined;
  private listeners = new Map<string, Set<Listener>>();

  async initialize() {
    const client = redisManager.getClient();
    if (!client) throw new Error("Task updates require Redis");
    this.subscriber = client.duplicate();
    this.subscriber.on("error", (error: Error) => logger.error("TASK_UPDATES: Redis subscription failed", error));
    this.subscriber.on("close", () => {
      for (const room of this.listeners.values()) for (const listener of room) listener.disconnect();
    });
    this.subscriber.on("ready", () => {
      for (const room of this.listeners.values()) for (const listener of room) listener.invalidate();
    });
    this.subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      if (message !== "invalidate") return;
      for (const listener of this.listeners.get(channel) ?? []) listener.invalidate();
    });
    await this.subscriber.psubscribe("plane:task-updates:*");
  }

  subscribe(workspaceId: string, listener: Listener) {
    const channel = `plane:task-updates:${workspaceId}`;
    const room = this.listeners.get(channel) ?? new Set<Listener>();
    room.add(listener);
    this.listeners.set(channel, room);
    return () => {
      room.delete(listener);
      if (!room.size) this.listeners.delete(channel);
    };
  }

  async destroy() {
    for (const room of this.listeners.values()) for (const listener of room) listener.disconnect();
    this.listeners.clear();
    await this.subscriber?.quit();
    this.subscriber = undefined;
  }
}

export const taskEvents = new TaskEvents();
