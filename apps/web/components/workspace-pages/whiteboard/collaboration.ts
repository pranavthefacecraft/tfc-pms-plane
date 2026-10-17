/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_URL } from "@plane/constants";
import type { TWorkspacePageUser } from "@/services/page/workspace-page.service";

export type TViewport = { scrollX: number; scrollY: number; zoom: number };
export type TBoardSession = {
  revision: number;
  scene: Record<string, unknown>;
  role: "owner" | "editor" | "viewer";
  user: TWorkspacePageUser;
  presenter: { client_id: string; user_id: string; viewport: TViewport } | null;
  participants: { client_id: string; user: TWorkspacePageUser }[];
};

type Pending = { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export function useWhiteboardCollaboration(workspaceSlug: string, boardId: string) {
  const [state, setState] = useState<TBoardSession | null>(null);
  const [clientId, setClientId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<Pending | null>(null);
  const revision = useRef(-1);

  useEffect(() => {
    revision.current = -1;
    const url = new URL(`${LIVE_URL.replace(/\/$/, "")}/whiteboards/`, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("workspace", workspaceSlug);
    url.searchParams.set("board", boardId);
    const ws = new WebSocket(url);
    socket.current = ws;
    let active = true;
    const failPending = (reason: string) => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.reject(new Error(reason));
        pending.current = null;
      }
    };
    ws.addEventListener("message", (event) => {
      if (!active) return;
      try {
        const message = JSON.parse(event.data) as {
          type: string;
          state?: TBoardSession;
          clientId?: string;
          message?: string;
        };
        if (message.type === "error") {
          const reason = message.message || "Whiteboard update failed.";
          setError(reason);
          failPending(reason);
          return;
        }
        if (!message.state || !message.clientId || typeof message.state.revision !== "number") {
          throw new Error("Invalid whiteboard session response.");
        }
        setClientId(message.clientId);
        setConnected(true);
        setError("");
        if (message.state.revision >= revision.current) {
          revision.current = message.state.revision;
          setState(message.state);
        }
        if (message.type === "ack" && pending.current) {
          clearTimeout(pending.current.timer);
          pending.current.resolve();
          pending.current = null;
        }
      } catch (cause) {
        console.error("Invalid whiteboard session message", cause);
        setError("Unable to read the whiteboard session. Reconnect to retry.");
        ws.close();
      }
    });
    ws.addEventListener("close", () => {
      if (!active) return;
      setConnected(false);
      setError("Live connection lost. Editing is paused. Reconnect to continue.");
      failPending("Whiteboard connection lost.");
    });
    ws.addEventListener("error", () => {
      if (active) setError("Cannot connect to the whiteboard live server.");
    });
    return () => {
      active = false;
      failPending("Whiteboard session ended.");
      ws.close();
      socket.current = null;
    };
  }, [workspaceSlug, boardId, attempt]);

  const send = useCallback(
    (data: Record<string, unknown>) =>
      new Promise<void>((resolve, reject) => {
        if (!socket.current || socket.current.readyState !== WebSocket.OPEN || pending.current) {
          reject(new Error("Whiteboard connection unavailable or an update is still being saved."));
          return;
        }
        const timer = setTimeout(() => {
          pending.current = null;
          reject(new Error("Whiteboard save timed out. Reconnect before continuing."));
          socket.current?.close();
        }, 20000);
        pending.current = { resolve, reject, timer };
        socket.current.send(JSON.stringify(data));
      }),
    []
  );

  const reconnect = () => {
    setConnected(false);
    setError("");
    setAttempt((value) => value + 1);
  };
  return { state, clientId, connected, error, send, reconnect };
}
