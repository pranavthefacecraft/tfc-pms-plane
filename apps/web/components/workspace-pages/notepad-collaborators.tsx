import { useState } from "react";
import useSWR from "swr";
import { Check, LockKeyhole, Plus, X } from "lucide-react";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { setToast } from "@plane/blocks/toast";
import { WorkspacePageService } from "@/services/page/workspace-page.service";
import type { TWorkspacePage, TNotepadSharing } from "@/services/page/workspace-page.service";

const service = new WorkspacePageService();

type ChangeSharing = (operation: () => Promise<TNotepadSharing>, success: string) => Promise<boolean>;

function NotepadSharingOptions({
  data,
  busy,
  change,
  workspaceSlug,
  pageId,
}: {
  data: TNotepadSharing;
  busy: boolean;
  change: ChangeSharing;
  workspaceSlug: string;
  pageId: string;
}) {
  const [email, setEmail] = useState("");
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const onlyMe = data.access === 1 && data.collaborators.length === 0 && data.pending.length === 0;
  const people = [
    ...data.collaborators.map((user) => ({ email: user.email, label: user.name || user.email })),
    ...data.pending.map((pending) => ({ email: pending, label: `${pending} (invited)` })),
  ];
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirmPrivate(true)}
        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-layer-1"
      >
        <LockKeyhole size={14} /> Only Me
        {onlyMe && <Check size={14} className="ml-auto" />}
      </button>
      {confirmPrivate && (
        <div className="rounded bg-layer-1 p-2 text-12">
          Make private and revoke all collaborators and invitations?
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              disabled={busy}
              className="text-danger-primary"
              onClick={async () => {
                if (await change(() => service.revoke(workspaceSlug, pageId, { only_me: true }), "Notepad is private"))
                  setConfirmPrivate(false);
              }}
            >
              Make private
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmPrivate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await change(() => service.invite(workspaceSlug, pageId, email.trim()), "Invitation queued"))
            setEmail("");
        }}
        className="flex gap-2"
      >
        <input
          type="email"
          required
          maxLength={254}
          aria-label="Collaborator email"
          placeholder="Enter email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          className="min-w-0 flex-1 rounded border border-subtle bg-surface-1 px-2 py-1.5 text-12 outline-none focus:border-accent-strong"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded bg-[#135DDD] px-3 py-1.5 text-12 text-white disabled:opacity-50"
        >
          {busy ? "Wait..." : "Invite"}
        </button>
      </form>
      <p className="text-11 text-tertiary">
        Invite to edit this notepad only. Links expire in 7 days. No workspace or project access is granted.
      </p>
      {people.map((person) => (
        <div key={person.email} className="flex items-center justify-between gap-2 text-12">
          <span className="truncate">{person.label}</span>
          <button
            type="button"
            aria-label={`Remove ${person.email}`}
            disabled={busy}
            onClick={() =>
              void change(() => service.revoke(workspaceSlug, pageId, { email: person.email }), "Access removed")
            }
            className="shrink-0 rounded p-1 hover:bg-layer-1"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </>
  );
}

export function NotepadCollaborators({
  workspaceSlug,
  page,
  canManage,
  onChange,
}: {
  workspaceSlug: string;
  page: TWorkspacePage;
  canManage: boolean;
  onChange: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { data, error, mutate } = useSWR(
    canManage ? ["notepad-sharing", workspaceSlug, page.id] : null,
    () => service.sharing(workspaceSlug, page.id),
    { shouldRetryOnError: false }
  );
  const collaborators =
    data?.collaborators ??
    (page.collaborators ?? []).map((user) => ({
      id: user.id,
      name: user.display_name || user.first_name,
    }));
  const change = async (operation: () => Promise<TNotepadSharing>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await mutate(await operation(), false);
      await onChange();
      setToast({ type: "success", title: success });
      return true;
    } catch (cause) {
      console.error("Could not update notepad collaborators", cause);
      setMessage("Could not update collaborators. Check the email and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-12 text-secondary">
      <span>Collaborator:</span>
      {page.owner && (
        <span className="rounded-full bg-layer-1 px-2 py-1">{page.owner.display_name || page.owner.first_name}</span>
      )}
      {collaborators.map((user) => (
        <span key={user.id} className="rounded-full bg-layer-1 px-2 py-1">
          {user.name}
        </span>
      ))}
      {canManage && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Add collaborator"
                className="flex size-6 items-center justify-center rounded-full border border-[#E2E6EF] text-[#135DDD] hover:bg-layer-1"
              />
            }
          >
            <Plus size={14} />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" sideOffset={8}>
            <PopoverBody>
              <div className="w-72 max-w-[calc(100vw-32px)] space-y-3 p-1">
                <h2 className="text-13 font-semibold text-primary">Collaborators</h2>
                {error ? (
                  <p role="alert">
                    Could not load sharing.{" "}
                    <button type="button" className="underline" onClick={() => void mutate()}>
                      Retry
                    </button>
                  </p>
                ) : !data ? (
                  <p role="status">Loading collaborators...</p>
                ) : (
                  <NotepadSharingOptions
                    data={data}
                    busy={busy}
                    change={change}
                    workspaceSlug={workspaceSlug}
                    pageId={page.id}
                  />
                )}
                {message && (
                  <p role="alert" className="text-12 text-danger-primary">
                    {message}
                  </p>
                )}
              </div>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}
      <span className="text-tertiary">{page.access === 1 ? "Private" : "Workspace access"}</span>
    </div>
  );
}
