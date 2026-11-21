import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Mail, X } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Popover, PopoverContent } from "@makeplane/propel/components/popover";
import { checkEmailValidity } from "@plane/utils";
import { useSelectContext } from "@plane/blocks/select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { useUserPermissions } from "@/hooks/store/user";
import { useInstance } from "@/hooks/store/use-instance";
import type { TNewTaskDraft } from "./new-task.helpers";

export function TaskAssigneeSelect({
  slug,
  draft,
  disabled,
  onChange,
}: {
  slug: string;
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  const emails = draft.inviteEmails ?? [];
  return (
    <TaskAssigneePicker
      slug={slug}
      projectId={draft.projectId}
      value={draft.assignees}
      onChange={(assignees) => onChange({ assignees })}
      disabled={disabled}
      queue={{
        emails,
        onChange: (inviteEmails) => onChange({ inviteEmails }),
      }}
    />
  );
}

type PickerProps = {
  slug: string;
  projectId: string;
  value: string[];
  onChange: (assignees: string[]) => void;
  disabled: boolean;
  placeholder?: string;
  compact?: boolean;
  tooltipHeading?: string;
  testId?: string;
} & (
  | { queue: { emails: string[]; onChange: (emails: string[]) => void }; sendInvite?: never }
  | { queue?: never; sendInvite: (email: string) => Promise<void> }
);

export const TaskAssigneePicker = observer(function TaskAssigneePicker(props: PickerProps) {
  const { slug, projectId, disabled, queue } = props;
  const { getProjectRoleByWorkspaceSlugAndProjectId, getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();
  const { config } = useInstance();
  const projectRole = getProjectRoleByWorkspaceSlugAndProjectId(slug, projectId);
  const canInvite = projectRole !== undefined && (projectRole === 20 || getWorkspaceRoleByWorkspaceSlug(slug) === 20);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const assigneeAnchor = useRef<HTMLDivElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const normalized = email.trim().toLowerCase();
  const valid = checkEmailValidity(normalized);
  const closeInvite = () => {
    setEmail("");
    setError("");
    setInviting(false);
  };
  const openInvite = (address = "") => {
    setEmail(address);
    setError("");
    setInviting(true);
  };
  const submitInvite = async () => {
    if (!valid || disabled || busy || !canInvite || !config?.is_smtp_configured) return;
    if (queue) {
      queue.onChange(Array.from(new Set([...queue.emails, normalized])));
      closeInvite();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await props.sendInvite(normalized);
      closeInvite();
    } catch (cause) {
      console.error("Task assignee invitation failed", cause);
      setError("Could not send the invitation. Check the email and try again.");
    } finally {
      setBusy(false);
    }
  };
  const invitationDisabled = disabled || busy || !valid || !config?.is_smtp_configured;
  const emailField = (
    <input
      ref={inviteInput}
      aria-label="Invite email"
      type="email"
      className="min-w-0 flex-1 rounded border border-subtle-1 bg-transparent px-2 py-1.5 text-13"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
      disabled={disabled || busy}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submitInvite();
        }
      }}
    />
  );
  const sendButton = (
    <Button
      type="button"
      size="md"
      stretch="auto"
      variant="primary"
      label={queue ? "Invite on save" : "Send invitation"}
      loading={busy}
      disabled={invitationDisabled}
      onClick={() => void submitInvite()}
    />
  );
  const inviteAlerts = (
    <>
      {!config?.is_smtp_configured && (
        <p role="alert" className="text-12 text-danger-primary">
          Email invitations require SMTP to be configured by an administrator.
        </p>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </>
  );
  return (
    <div className={props.compact ? "w-fit max-w-full space-y-2" : "space-y-2"}>
      <div ref={assigneeAnchor}>
        <MemberSelect
          projectId={projectId}
          value={props.value}
          onChange={props.onChange}
          multiple
          variant="select-ghost-md"
          placeholder={props.placeholder ?? "Choose teammate"}
          testId={props.testId}
          className={props.compact ? "w-fit" : undefined}
          showLabel={props.compact ? props.value.length <= 1 : undefined}
          tooltip={props.tooltipHeading ? { heading: props.tooltipHeading } : undefined}
          disabled={disabled || busy}
          footer={
            !queue && canInvite && !disabled && !busy ? (
              <div className="border-t border-subtle-1">
                <InviteDropdownAction onInvite={openInvite} />
              </div>
            ) : undefined
          }
          emptyMessage={(query) =>
            !disabled && canInvite && checkEmailValidity(query.trim()) ? (
              <InviteDropdownAction email={query.trim()} onInvite={openInvite} />
            ) : (
              <span>No teammates found.{canInvite ? " Enter an email to invite." : ""}</span>
            )
          }
        />
      </div>
      {canInvite && queue && (
        <button
          type="button"
          disabled={disabled || busy}
          className="flex items-center gap-2 text-12 text-[#135DDD] disabled:text-placeholder"
          onClick={() => openInvite()}
        >
          <Mail className="size-3.5" />
          Invite by email
        </button>
      )}
      {queue?.emails.map((address) => (
        <div key={address} className="flex items-center gap-2 text-12">
          <span>{address} · Invite on save</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove invitation ${address}`}
            className="text-[#135DDD]"
            onClick={() => queue.onChange(queue.emails.filter((value) => value !== address))}
          >
            Remove
          </button>
        </div>
      ))}
      {queue && inviting && canInvite && (
        <div className="space-y-2 rounded border border-subtle-1 p-3">
          <label className="flex flex-col gap-1 text-12">
            Invite and assign by email
            {emailField}
          </label>
          <p className="text-12 text-secondary">
            Saving sends a workspace and project invitation with Editor access. This task will be assigned after they
            accept.
          </p>
          {inviteAlerts}
          <div className="flex gap-2">
            {sendButton}
            <Button
              type="button"
              size="md"
              stretch="auto"
              variant="secondary"
              label="Cancel invitation"
              disabled={busy}
              onClick={closeInvite}
            />
          </div>
        </div>
      )}
      {!queue && (
        <Popover
          open={inviting && canInvite && !disabled}
          onOpenChange={(open) => {
            if (!open && !busy) closeInvite();
          }}
        >
          <PopoverContent
            anchor={assigneeAnchor}
            positionMethod="fixed"
            collisionPadding={12}
            initialFocus={inviteInput}
            aria-label="Invite and assign by email"
            data-prevent-outside-click
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              if (!busy) closeInvite();
            }}
          >
            <div className="w-[22rem] max-w-[calc(100vw-3rem)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-13 font-medium">Invite</span>
                <button
                  type="button"
                  aria-label="Cancel invitation"
                  disabled={busy}
                  className="rounded p-1 text-secondary hover:bg-layer-1-hover disabled:opacity-50"
                  onClick={closeInvite}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {emailField}
                {sendButton}
              </div>
              <p className="text-12 text-secondary">Includes Editor access to this project.</p>
              {inviteAlerts}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
});

function InviteDropdownAction({ email = "", onInvite }: { email?: string; onInvite: (email: string) => void }) {
  const { close } = useSelectContext();
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-sm p-2 text-left text-13 text-[#135DDD] hover:bg-layer-1-hover focus-visible:bg-layer-1-hover"
      onClick={() => {
        close();
        onInvite(email);
      }}
    >
      <Mail className="size-4" />
      {email ? `Invite: ${email}` : "Invite by email"}
    </button>
  );
}
