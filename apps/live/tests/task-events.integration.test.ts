/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { expect, it, vi } from "vitest";
import { TaskEvents } from "@/task-events";

vi.mock("@plane/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/redis", () => ({
  redisManager: {
    getClient: () => new Redis(process.env.TASK_UPDATES_TEST_REDIS_URL!, { lazyConnect: true }),
  },
}));

it.skipIf(!process.env.TASK_UPDATES_TEST_REDIS_URL)(
  "fans committed invalidations across two live replicas via real Redis",
  async () => {
    const publisher = new Redis(process.env.TASK_UPDATES_TEST_REDIS_URL!);
    const first = new TaskEvents();
    const second = new TaskEvents();
    const id = randomUUID();
    try {
      await Promise.all([first.initialize(), second.initialize()]);
      const received: string[] = [];
      let resolveBoth: (() => void) | undefined;
      const both = new Promise<void>((resolve) => {
        resolveBoth = resolve;
      });
      const notify = (name: string) => () => {
        received.push(name);
        if (received.length === 2) resolveBoth?.();
      };
      first.subscribe(id, { invalidate: notify("first"), disconnect: vi.fn() });
      second.subscribe(id, { invalidate: notify("second"), disconnect: vi.fn() });
      const other = vi.fn();
      first.subscribe(randomUUID(), { invalidate: other, disconnect: vi.fn() });
      const start = performance.now();
      await publisher.publish(`plane:task-updates:${id}`, "invalidate");
      await both;
      expect(performance.now() - start).toBeLessThan(500);
      expect(received.toSorted()).toEqual(["first", "second"]);
      expect(other).not.toHaveBeenCalled();
    } finally {
      await Promise.all([first.destroy(), second.destroy(), publisher.quit()]);
    }
  },
  5000
);
