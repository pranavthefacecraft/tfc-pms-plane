/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare } from "lucide-react";
import useSWR from "swr";
import { isAxiosError } from "axios";
import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { Button } from "@makeplane/propel/components/button";
import { Avatar } from "@makeplane/propel/components/avatar";
import { setToast } from "@plane/blocks/toast";
import { API_BASE_URL } from "@plane/constants";
import { getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { documentPath } from "./documents";
import { whiteboardComments } from "./comments.service";
import type { CommentAttachment, CommentMember, CommentThread } from "./comments.service";

function notifyError(error: unknown) {
  console.error("Whiteboard comment request failed", error);
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
  const message =
    data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : "The request failed. Your draft is still available; please retry.";
  setToast({ type: "error", title: "Comment could not be saved", message });
}

const memberName = (member: CommentMember) => member.display_name || member.first_name || "Workspace member";

export function WhiteboardComments({
  api,
  workspaceSlug,
  boardId,
  readOnly = false,
}: {
  api: ExcalidrawImperativeAPI;
  workspaceSlug: string;
  boardId: string;
  readOnly?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const placementButton = useRef<HTMLButtonElement>(null);
  const openedDeepLink = useRef(false);
  const [viewport, setViewport] = useState(() => api.getAppState());
  const [placing, setPlacing] = useState(false);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  const [draftPoint, setDraftPoint] = useState<{ x: number; y: number }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const mentions = useRef<CommentMember[]>([]);
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [showList, setShowList] = useState(false);
  const { data, error, mutate, isLoading } = useSWR(
    ["whiteboard-comments", workspaceSlug, boardId],
    () => whiteboardComments.list(workspaceSlug, boardId),
    { refreshInterval: 15000, revalidateOnFocus: true, shouldRetryOnError: false }
  );

  useEffect(() => {
    const canvas = root.current?.parentElement;
    if (!canvas) return;
    // Excalidraw has no drawing-toolbar slot; keep the portal scoped to this canvas.
    const findToolbar = () =>
      setToolbar(
        canvas.querySelector(".App-toolbar .App-toolbar__extra-tools-trigger")?.closest(".Stack_horizontal") ?? null
      );
    findToolbar();
    const observer = new MutationObserver(findToolbar);
    observer.observe(canvas, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [api]);

  useEffect(() => {
    if (!placing) return;
    return api.onChange((_elements, state) => {
      if (state.activeTool.type !== "selection") setPlacing(false);
    });
  }, [api, placing]);

  useEffect(
    () =>
      api.onChange((_elements, state) => {
        setViewport((previous) =>
          previous.scrollX === state.scrollX &&
          previous.scrollY === state.scrollY &&
          previous.zoom.value === state.zoom.value &&
          previous.offsetLeft === state.offsetLeft &&
          previous.offsetTop === state.offsetTop &&
          previous.width === state.width &&
          previous.height === state.height
            ? previous
            : state
        );
      }),
    [api]
  );

  const selected = data?.threads.find((thread) => thread.id === selectedId);
  const point = draftPoint ?? selected;
  const isOpen = !!point;
  const query = body.match(/(?:^|\s)@([^\s@]*)$/)?.[1];
  const suggestions =
    query !== undefined
      ? data?.members.filter((member) => memberName(member).toLowerCase().includes(query.toLowerCase())).slice(0, 8)
      : [];
  const visibleThreads = data?.threads.filter((thread) => showResolved || !thread.resolved) ?? [];

  useEffect(() => {
    if (placing) placementButton.current?.focus();
    else if (draftPoint) input.current?.focus();
  }, [placing, draftPoint]);

  useEffect(() => {
    if (openedDeepLink.current || !data) return;
    openedDeepLink.current = true;
    const threadId = new URLSearchParams(window.location.search).get("thread");
    const thread = data.threads.find((item) => item.id === threadId);
    if (!thread) return;
    setSelectedId(thread.id);
    setShowResolved(thread.resolved);
    const state = api.getAppState();
    api.updateScene({
      appState: {
        scrollX: state.width / (2 * state.zoom.value) - thread.x,
        scrollY: state.height / (2 * state.zoom.value) - thread.y,
      },
    });
  }, [api, data]);

  const storeThread = async (thread: CommentThread) => {
    await mutate(
      (previous) =>
        previous
          ? {
              ...previous,
              threads: previous.threads.some((item) => item.id === thread.id)
                ? previous.threads.map((item) => (item.id === thread.id ? thread : item))
                : [...previous.threads, thread],
            }
          : previous,
      { revalidate: false }
    );
  };

  const position = (location: { x: number; y: number }) => {
    const result = sceneCoordsToViewportCoords({ sceneX: location.x, sceneY: location.y }, viewport);
    const bounds = root.current?.getBoundingClientRect();
    return { x: result.x - (bounds?.left ?? viewport.offsetLeft), y: result.y - (bounds?.top ?? viewport.offsetTop) };
  };
  const panelPoint = point ? position(point) : { x: 0, y: 0 };
  const panelLeft = Math.max(8, Math.min(panelPoint.x + 38, viewport.width - 372));
  const panelTop = Math.max(100, Math.min(panelPoint.y, viewport.height - 430));

  const clearDraft = () => {
    setBody("");
    mentions.current = [];
    setAttachments([]);
  };
  const canLeave = () =>
    !(body.trim() || attachments.length) || window.confirm("Discard this unsent comment and its attachments?");
  const openThread = (thread: CommentThread) => {
    if (busy || !canLeave()) return false;
    clearDraft();
    setDraftPoint(undefined);
    setSelectedId(thread.id);
    setShowList(false);
    setPlacing(false);
    return true;
  };
  const close = () => {
    if (busy || !canLeave()) return;
    clearDraft();
    setSelectedId(null);
    setDraftPoint(undefined);
    setPlacing(false);
  };
  const submit = async () => {
    if (!point || busy || (!body.trim() && !attachments.length)) return;
    setBusy(true);
    try {
      const thread = await whiteboardComments.comment(
        workspaceSlug,
        boardId,
        {
          body,
          mentions: mentions.current
            .filter((member) => body.includes(`@${memberName(member)}`))
            .map((member) => member.id),
          attachments: attachments.map((attachment) => attachment.id),
          ...(draftPoint ? draftPoint : {}),
        },
        selected?.id
      );
      clearDraft();
      setDraftPoint(undefined);
      setSelectedId(thread.id);
      await storeThread(thread);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };
  const resolve = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const thread = await whiteboardComments.resolve(workspaceSlug, boardId, selected.id, !selected.resolved);
      await storeThread(thread);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  const commentTool = (
    <button
      type="button"
      aria-label="Add comment"
      aria-pressed={placing}
      title={placing ? "Cancel comment placement (Escape)" : "Add comment"}
      className={`pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-accent-strong disabled:opacity-40 ${
        placing ? "bg-accent-primary text-on-color" : "text-primary hover:bg-layer-1"
      }`}
      disabled={readOnly || !!error || isLoading || busy}
      onClick={() => {
        if (placing) setPlacing(false);
        else if (canLeave()) {
          api.setActiveTool({ type: "selection" });
          clearDraft();
          setSelectedId(null);
          setDraftPoint(undefined);
          setShowList(false);
          setPlacing(true);
        }
      }}
    >
      <MessageSquare size={18} aria-hidden="true" />
    </button>
  );

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {toolbar && createPortal(commentTool, toolbar)}
      <div className="pms-whiteboard__comments-toggle shadow-sm pointer-events-auto absolute top-16 right-3 z-10 flex items-center gap-2 rounded-lg border border-subtle bg-surface-1 p-2">
        {!toolbar && commentTool}
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={`Comments (${visibleThreads.length})`}
          disabled={busy}
          onClick={() => {
            if (!canLeave()) return;
            clearDraft();
            setSelectedId(null);
            setDraftPoint(undefined);
            setPlacing(false);
            setShowList(!showList);
          }}
        />
      </div>
      {error && (
        <div
          role="alert"
          className="pointer-events-auto absolute top-32 right-3 rounded border border-subtle bg-surface-1 p-3 text-13"
        >
          Comments could not be loaded.{" "}
          <button type="button" className="underline" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      )}
      {placing && !readOnly && (
        <button
          type="button"
          aria-label="Place comment pin"
          ref={placementButton}
          className="pointer-events-auto absolute inset-x-0 top-16 bottom-0 cursor-crosshair bg-accent-primary/5"
          onKeyDown={(event) => {
            if (event.key === "Escape") setPlacing(false);
          }}
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setDraftPoint(
              viewportCoordsToSceneCoords(
                event.detail === 0
                  ? { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 }
                  : { clientX: event.clientX, clientY: event.clientY },
                api.getAppState()
              )
            );
            setPlacing(false);
          }}
        >
          <span className="shadow absolute top-28 left-1/2 -translate-x-1/2 rounded bg-surface-1 px-3 py-2 text-13">
            Click to place a comment. Escape cancels.
          </span>
        </button>
      )}
      {(!placing || readOnly) &&
        visibleThreads.map((thread, index) => {
          const anchor = position(thread);
          const author = thread.comments[0]?.author;
          return (
            <button
              key={thread.id}
              type="button"
              aria-label={`Open comment thread ${index + 1}${thread.resolved ? " (resolved)" : ""}`}
              className="shadow-md pointer-events-auto absolute flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent-strong bg-surface-1"
              style={{ left: anchor.x - 18, top: anchor.y - 18, opacity: thread.resolved ? 0.6 : 1 }}
              onClick={() => openThread(thread)}
            >
              <Avatar
                alt={author ? memberName(author) : "Deleted user"}
                fallback={author ? memberName(author).slice(0, 2) : "?"}
                src={getFileURL(author?.avatar_url ?? "")}
                size="sm"
              />
              <span className="absolute -right-1 -bottom-1 rounded-full bg-accent-primary px-1 text-10 text-on-color">
                {thread.comments.length}
              </span>
            </button>
          );
        })}
      {showList && (
        <section
          aria-label="Whiteboard comments"
          className="pms-whiteboard__comments-panel shadow-lg pointer-events-auto absolute top-28 right-3 max-h-[60%] w-80 max-w-[95%] overflow-auto rounded-lg border border-subtle bg-surface-1 p-3"
        >
          <label className="mb-3 flex items-center gap-2 text-13">
            <input type="checkbox" checked={showResolved} onChange={(event) => setShowResolved(event.target.checked)} />
            Show resolved
          </label>
          {!visibleThreads.length && <p className="text-13 text-secondary">No comments yet.</p>}
          {visibleThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className="mb-2 block w-full rounded border border-subtle p-2 text-left text-13"
              onClick={() => {
                if (!openThread(thread)) return;
                api.updateScene({
                  appState: {
                    scrollX: viewport.width / (2 * viewport.zoom.value) - thread.x,
                    scrollY: viewport.height / (2 * viewport.zoom.value) - thread.y,
                  },
                });
              }}
            >
              <span className="font-medium">
                {thread.comments[0]?.author ? memberName(thread.comments[0].author) : "Deleted user"}
              </span>
              <p className="truncate">{thread.comments[0]?.body || "Attachment"}</p>
              <span className="text-11 text-secondary">
                {thread.comments.length} comments{thread.resolved ? " · Resolved" : ""}
              </span>
            </button>
          ))}
        </section>
      )}
      {isOpen && (
        <dialog
          open
          aria-label="Comment thread"
          className="shadow-lg pointer-events-auto absolute m-0 flex max-h-[calc(100%_-_110px)] w-[360px] max-w-[calc(100%_-_16px)] flex-col rounded-xl border border-subtle bg-surface-1 p-3 text-primary"
          style={{ left: panelLeft, top: panelTop }}
        >
          <header className="mb-2 flex items-center justify-between gap-2 text-13">
            <strong>{selected?.resolved ? "Resolved thread" : draftPoint ? "New comment" : "Comments"}</strong>
            <div className="flex gap-2">
              {selected && !readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  className="text-accent-primary underline"
                  onClick={() => void resolve()}
                >
                  {selected.resolved ? "Reopen" : "Resolve"}
                </button>
              )}
              <button type="button" aria-label="Close comment thread" disabled={busy} onClick={close}>
                Close
              </button>
            </div>
          </header>
          <div className="min-h-0 overflow-auto">
            {selected?.comments.map((comment) => (
              <article key={comment.id} className="mb-3 border-b border-subtle pb-2 text-13">
                <div className="flex items-center gap-2">
                  <Avatar
                    alt={comment.author ? memberName(comment.author) : "Deleted user"}
                    fallback={comment.author ? memberName(comment.author).slice(0, 2) : "?"}
                    src={getFileURL(comment.author?.avatar_url ?? "")}
                    size="sm"
                  />
                  <strong>{comment.author ? memberName(comment.author) : "Deleted user"}</strong>
                </div>
                <time className="text-11 text-secondary" dateTime={comment.created_at}>
                  {renderFormattedDate(comment.created_at)} {renderFormattedTime(comment.created_at)}
                </time>
                <p className="mt-1 break-words whitespace-pre-wrap">{comment.body}</p>
                {comment.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    className="mt-1 block break-all text-accent-primary underline"
                    href={
                      API_BASE_URL
                        ? new URL(documentPath(workspaceSlug, boardId, attachment.id), API_BASE_URL).href
                        : documentPath(workspaceSlug, boardId, attachment.id)
                    }
                    download={attachment.name}
                  >
                    {attachment.name}
                  </a>
                ))}
              </article>
            ))}
          </div>
          {!selected?.resolved && !readOnly && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="space-y-2"
            >
              <textarea
                ref={input}
                aria-label="Comment text"
                placeholder="Add comment or @mention"
                maxLength={10000}
                rows={3}
                className="w-full resize-y rounded border border-subtle bg-surface-1 p-2 text-13 text-primary"
                value={body}
                disabled={busy}
                onChange={(event) => setBody(event.target.value)}
              />
              {!!suggestions?.length && (
                <div aria-label="Mention suggestions" className="max-h-32 overflow-auto rounded border border-subtle">
                  {suggestions.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="block w-full px-2 py-1 text-left text-13 hover:bg-layer-1"
                      onClick={() => {
                        setBody(body.replace(/@([^\s@]*)$/, `@${memberName(member)} `));
                        if (!mentions.current.some((item) => item.id === member.id))
                          mentions.current = [...mentions.current, member];
                        input.current?.focus();
                      }}
                    >
                      {memberName(member)}
                    </button>
                  ))}
                </div>
              )}
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between gap-2 text-11">
                  <span className="truncate">{attachment.name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() => setAttachments(attachments.filter((item) => item.id !== attachment.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <label className="block text-11 text-secondary">
                Attach file (PDF, Word, Excel, PNG, JPG, TXT, CSV, ZIP; up to{" "}
                {Math.round((data?.file_size_limit ?? 0) / 1024 / 1024)} MB)
                <input
                  aria-label="Attach comment file"
                  className="mt-1 block w-full text-11"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv,.zip"
                  disabled={busy || attachments.length >= 10}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (data && file.size > data.file_size_limit) {
                      setToast({
                        type: "error",
                        title: "Attachment too large",
                        message: `Use a file smaller than ${Math.round(data.file_size_limit / 1024 / 1024)} MB.`,
                      });
                      return;
                    }
                    setBusy(true);
                    try {
                      const attachment = await whiteboardComments.upload(workspaceSlug, boardId, file);
                      setAttachments((previous) => [...previous, attachment]);
                    } catch (err) {
                      notifyError(err);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <Button
                variant="primary"
                size="sm"
                stretch="auto"
                type="submit"
                label={busy ? "Saving..." : selected ? "Reply" : "Comment"}
                disabled={busy || (!body.trim() && !attachments.length)}
              />
            </form>
          )}
        </dialog>
      )}
    </div>
  );
}
