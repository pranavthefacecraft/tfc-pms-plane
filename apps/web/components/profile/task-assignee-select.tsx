import { useState } from "react";
import { observer } from "mobx-react";
import { Mail } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { checkEmailValidity } from "@plane/utils";
import { useSelectContext } from "@plane/blocks/select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { useUserPermissions } from "@/hooks/store/user";
import { useInstance } from "@/hooks/store/use-instance";
import type { TNewTaskDraft } from "./new-task.helpers";

export const TaskAssigneeSelect = observer(function TaskAssigneeSelect({
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
  const { getProjectRoleByWorkspaceSlugAndProjectId, getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();
  const { config } = useInstance();
  const projectRole = getProjectRoleByWorkspaceSlugAndProjectId(slug, draft.projectId);
  const canInvite = projectRole !== undefined && (projectRole === 20 || getWorkspaceRoleByWorkspaceSlug(slug) === 20);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const emails = draft.inviteEmails ?? [];
  const normalized = email.trim().toLowerCase();
  const valid = checkEmailValidity(normalized);
  const queueInvite = () => {
    if (!valid || disabled || !canInvite || !config?.is_smtp_configured) return;
    onChange({ inviteEmails: Array.from(new Set([...emails, normalized])) });
    setEmail("");
    setInviting(false);
  };
  return (
    <div className="space-y-2">
      <MemberSelect
        projectId={draft.projectId}
        value={draft.assignees}
        onChange={(assignees) => onChange({ assignees })}
        multiple
        variant="select-ghost-md"
        placeholder="Choose teammate"
        disabled={disabled}
        emptyMessage={(query) =>
          canInvite && checkEmailValidity(query.trim()) ? (
            <InviteSearchAction
              email={query.trim()}
              onInvite={(value) => {
                setEmail(value);
                setInviting(true);
              }}
            />
          ) : (
            <span>No teammates found.{canInvite ? " Enter an email to invite." : ""}</span>
          )
        }
      />
      {canInvite && (
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-2 text-12 text-[#135DDD] disabled:text-placeholder"
          onClick={() => setInviting(true)}
        >
          <Mail className="size-3.5" />
          Invite by email
        </button>
      )}
      {emails.map((address) => (
        <div key={address} className="flex items-center gap-2 text-12">
          <span>{address} · Invite on save</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove invitation ${address}`}
            className="text-[#135DDD]"
            onClick={() => onChange({ inviteEmails: emails.filter((value) => value !== address) })}
          >
            Remove
          </button>
        </div>
      ))}
      {inviting && (
        <div className="space-y-2 rounded border border-subtle-1 p-3">
          <label className="flex flex-col gap-1 text-12">
            Invite and assign by email
            <input
              aria-label="Invite email"
              type="email"
              className="rounded border border-subtle-1 bg-transparent p-2 text-13"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={disabled}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  queueInvite();
                }
              }}
            />
          </label>
          <p className="text-12 text-secondary">
            Saving sends a workspace and project invitation with Editor access. This task will be assigned after they
            accept.
          </p>
          {!config?.is_smtp_configured && (
            <p role="alert" className="text-12 text-danger-primary">
              Email invitations require SMTP to be configured by an administrator.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="md"
              stretch="auto"
              variant="primary"
              label="Invite on save"
              disabled={disabled || !valid || !config?.is_smtp_configured}
              onClick={queueInvite}
            />
            <Button
              type="button"
              size="md"
              stretch="auto"
              variant="secondary"
              label="Cancel invitation"
              onClick={() => setInviting(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
});

function InviteSearchAction({ email, onInvite }: { email: string; onInvite: (email: string) => void }) {
  const { close } = useSelectContext();
  return (
    <button
      type="button"
      className="flex items-center gap-2 p-2 text-13 text-[#135DDD]"
      onClick={() => {
        close();
        onInvite(email);
      }}
    >
      <Mail className="size-4" />
      Invite: {email}
    </button>
  );
}
