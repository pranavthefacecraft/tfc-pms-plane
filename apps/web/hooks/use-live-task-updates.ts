/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { queueTaskRefresh, subscribeTaskUpdates } from "@/services/task-updates";

export function useLiveTaskUpdates(workspaceSlug: string | undefined, refresh: () => Promise<unknown>) {
  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
  }, [refresh]);
  useEffect(() => {
    if (!workspaceSlug) return;
    const queue = queueTaskRefresh(() => latestRefresh.current());
    const unsubscribe = subscribeTaskUpdates(workspaceSlug, queue.invalidate);
    return () => {
      queue.stop();
      unsubscribe();
    };
  }, [workspaceSlug]);
}
