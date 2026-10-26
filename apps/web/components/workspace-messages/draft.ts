import type { TMessagePayload } from "@/services/workspace-message.service";

export type TMessageDraft = TMessagePayload & { attempted: boolean };

export function draftKey(userId: string, workspaceSlug: string) {
  return `clevdex:message-draft:${userId}:${workspaceSlug}`;
}

export function emptyDraft(): TMessageDraft {
  return { id: crypto.randomUUID(), subject: "", body: "", recipients: [], attempted: false };
}

export function loadDraft(key: string): TMessageDraft {
  const raw = localStorage.getItem(key);
  if (!raw) return emptyDraft();
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(value.id) ||
    !("subject" in value) ||
    typeof value.subject !== "string" ||
    !("body" in value) ||
    typeof value.body !== "string" ||
    !("recipients" in value) ||
    !Array.isArray(value.recipients) ||
    !value.recipients.every((id: unknown): id is string => typeof id === "string") ||
    !("attempted" in value) ||
    typeof value.attempted !== "boolean"
  ) {
    throw new Error("The saved message draft is invalid.");
  }
  return {
    id: value.id,
    subject: value.subject,
    body: value.body,
    recipients: value.recipients,
    attempted: value.attempted,
  };
}
