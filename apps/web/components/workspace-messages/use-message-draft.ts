import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import type { IWorkspaceMember } from "@plane/types";
import { setToast } from "@plane/blocks/toast";
import { workspaceMessageService } from "@/services/workspace-message.service";
import { draftKey, emptyDraft, loadDraft } from "./draft";
import type { TMessageDraft } from "./draft";

export function useMessageDraft(
  userId: string,
  workspaceSlug: string,
  members: IWorkspaceMember[] | undefined,
  onClose: () => void
) {
  const key = draftKey(userId, workspaceSlug);
  const [initial] = useState(() => {
    try {
      return { draft: loadDraft(key), error: "" };
    } catch (error) {
      console.error("Could not restore message draft", error);
      return { draft: emptyDraft(), error: "Could not restore your saved draft. Draft storage may be unavailable." };
    }
  });
  const [draft, setDraft] = useState(initial.draft);
  const [storageError, setStorageError] = useState(initial.error);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const available =
    members?.filter(({ member, is_active }) => is_active && !member.is_bot && member.id !== userId) ?? [];
  const invalidRecipients =
    !!members && draft.recipients.some((id) => !available.some(({ member }) => member.id === id));
  const locked = sending || draft.attempted;
  const canSend =
    !sending &&
    !!draft.subject.trim() &&
    !!draft.body.trim() &&
    draft.recipients.length > 0 &&
    draft.recipients.length <= 100 &&
    (draft.attempted || (!invalidRecipients && !!members));
  const updateDraft = (next: TMessageDraft) => {
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError("");
    } catch (error) {
      console.error("Could not save message draft", error);
      setStorageError("Draft could not be saved on this browser. Keep this window open to avoid losing it.");
    }
  };
  const discard = () => {
    if (
      !window.confirm(
        draft.attempted
          ? "Discard this draft? A previous send may already have reached recipients. Discarding does not recall a sent message."
          : "Discard this message draft?"
      )
    )
      return;
    try {
      localStorage.removeItem(key);
      onClose();
    } catch (error) {
      console.error("Could not discard message draft", error);
      setStorageError("Could not remove the saved draft. Please retry.");
    }
  };
  const closeDraft = () => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      onClose();
    } catch (error) {
      console.error("Could not save message draft before closing", error);
      setStorageError("Draft could not be saved. Keep this window open or discard the draft.");
    }
  };
  const send = async () => {
    if (sendingRef.current) return;
    if (!canSend) {
      setSendError("Add a subject, message, and up to 100 active workspace recipients before sending.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    const next = { ...draft, subject: draft.subject.trim(), body: draft.body.trim(), attempted: true };
    updateDraft(next);
    try {
      await workspaceMessageService.send(workspaceSlug, {
        id: next.id,
        subject: next.subject,
        body: next.body,
        recipients: next.recipients,
      });
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error("Message sent but draft cleanup failed", error);
        setToast({
          type: "error",
          title: "Message sent, but its local draft could not be cleared",
          message: "Retrying this draft will not send a duplicate.",
        });
      }
      setToast({
        type: "success",
        title: "Message sent",
        message: "Delivered to Inbox. Email delivery has been queued.",
      });
      onClose();
    } catch (error: unknown) {
      console.error("Workspace message send failed", error);
      if (isAxiosError<{ error?: string }>(error) && error.response?.status === 400) {
        updateDraft({ ...next, attempted: false });
      }
      setSendError(
        isAxiosError<{ error?: string }>(error) && typeof error.response?.data.error === "string"
          ? error.response.data.error
          : isAxiosError(error) && error.response?.status === 400
            ? "Message was not sent. Check the subject, message, and selected recipients, then try again."
            : "Send could not be confirmed. Retry Send safely without duplicating the message."
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  return {
    draft,
    storageError,
    sendError,
    sending,
    available,
    invalidRecipients,
    locked,
    canSend,
    updateDraft,
    discard,
    closeDraft,
    send,
  };
}
