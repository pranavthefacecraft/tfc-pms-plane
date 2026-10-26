import { useState } from "react";
import useSWR from "swr";
import { Maximize2, Minus, X } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import { MessageRecipients } from "./recipients";
import { useMessageDraft } from "./use-message-draft";

export function WorkspaceMessageComposer({ workspaceSlug, onClose }: { workspaceSlug: string; onClose: () => void }) {
  const { data: user } = useUser();
  return user ? (
    <MessageComposer
      key={`${user.id}:${workspaceSlug}`}
      userId={user.id}
      workspaceSlug={workspaceSlug}
      onClose={onClose}
    />
  ) : null;
}

export function MessageComposer({
  userId,
  workspaceSlug,
  onClose,
}: {
  userId: string;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const {
    workspace: { fetchWorkspaceMembers },
  } = useMember();
  const {
    data: members,
    error: membersError,
    mutate,
  } = useSWR(["workspace-message-members", workspaceSlug], () => fetchWorkspaceMembers(workspaceSlug));
  const {
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
  } = useMessageDraft(userId, workspaceSlug, membersError ? undefined : members, onClose);

  return (
    <dialog
      open
      aria-labelledby="message-composer-title"
      className={`shadow-xl fixed top-auto right-4 bottom-4 left-auto z-50 m-0 flex max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-subtle bg-surface-1 text-primary ${expanded ? "h-[85vh] w-[800px]" : minimized ? "w-[440px]" : "h-[560px] max-h-[80vh] w-[440px]"}`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-subtle px-4 py-3">
        <h2 id="message-composer-title" className="text-13 font-medium">
          Draft message
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            aria-label="Expand message"
            onClick={() => {
              setExpanded(!expanded);
              setMinimized(false);
            }}
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label={minimized ? "Restore message" : "Minimize message"}
            onClick={() => {
              setMinimized(!minimized);
              setExpanded(false);
            }}
          >
            <Minus className="size-4" />
          </button>
          <button type="button" aria-label="Save draft and close" disabled={sending} onClick={closeDraft}>
            <X className="size-4" />
          </button>
        </div>
      </header>
      {!minimized && (
        <form
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className="shrink-0">
            <InputGroup size="md">
              <Input
                size="md"
                aria-label="Subject"
                placeholder="Add subject"
                maxLength={255}
                value={draft.subject}
                disabled={locked}
                autoFocus
                onChange={(event) => updateDraft({ ...draft, subject: event.target.value })}
              />
            </InputGroup>
          </div>
          {membersError && (
            <div role="alert" className="text-13">
              Could not load workspace members.{" "}
              <button type="button" className="underline" onClick={() => void mutate()}>
                Retry
              </button>
            </div>
          )}
          {!members && !membersError && <p className="text-13 text-secondary">Loading members...</p>}
          <MessageRecipients
            members={available}
            selectedIds={draft.recipients}
            disabled={locked}
            onChange={(recipients) => updateDraft({ ...draft, recipients })}
          />
          {invalidRecipients && (
            <p role="alert" className="text-12 text-danger-primary">
              Some draft recipients are no longer workspace members.{" "}
              <button
                type="button"
                disabled={locked}
                className="underline"
                onClick={() =>
                  updateDraft({
                    ...draft,
                    recipients: draft.recipients.filter((id) => available.some(({ member }) => member.id === id)),
                  })
                }
              >
                Remove unavailable recipients
              </button>
            </p>
          )}
          <textarea
            aria-label="Message"
            placeholder="Write your message..."
            maxLength={20000}
            value={draft.body}
            disabled={locked}
            className="focus:ring-accent-primary min-h-20 flex-1 resize-none rounded border border-subtle bg-surface-1 p-3 text-13 focus:ring-1 focus:outline-none"
            onChange={(event) => updateDraft({ ...draft, body: event.target.value })}
          />
          {(storageError || sendError) && (
            <p role="alert" className="text-12 text-danger-primary">
              {storageError} {sendError}
            </p>
          )}
          <footer className="flex shrink-0 items-center justify-between gap-2">
            <button type="button" className="text-12 text-secondary underline" disabled={sending} onClick={discard}>
              Discard draft
            </button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              stretch="auto"
              label={sending ? "Sending..." : draft.attempted ? "Retry Send" : "Send"}
              disabled={!canSend}
            />
          </footer>
          <p className="text-11 text-tertiary">
            Draft saved in this browser. Messages are delivered to Inbox and by email. Replies are not supported.
          </p>
        </form>
      )}
    </dialog>
  );
}
