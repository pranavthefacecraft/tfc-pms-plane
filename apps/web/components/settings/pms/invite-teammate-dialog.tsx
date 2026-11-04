/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { observer } from "mobx-react";
import { Dialog, DialogContent, DialogTitle } from "@makeplane/propel/components/dialog";
import { EUserPermissions } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { ProjectCollaboratorsService } from "@/services/project-collaborators.service";

const collaborators = new ProjectCollaboratorsService();
const fieldClass = "w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13";

export const InviteTeammateDialog = observer(function InviteTeammateDialog({
  workspaceSlug,
  onClose,
  onInvited,
}: {
  workspaceSlug: string;
  onClose: () => void;
  onInvited: () => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<number>(EUserPermissions.MEMBER);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const { workspace: members } = useMember();
  const { workspaceProjectIds, getPartialProjectById } = useProject();
  const projects = (workspaceProjectIds ?? []).flatMap((id) => {
    const project = getPartialProjectById(id);
    return project?.member_role === EUserPermissions.ADMIN ? [project] : [];
  });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let invitationSent = sent;
    try {
      if (!sent) {
        const invite = { email: email.trim(), role };
        if (projectId) await collaborators.invite(workspaceSlug, projectId, [invite]);
        else await members.inviteMembersToWorkspace(workspaceSlug, { emails: [invite] });
        setSent(true);
        invitationSent = true;
      }
      await onInvited();
      setToast({ type: "success", title: "Teammate access updated", message: "The teammate list is up to date." });
      onClose();
    } catch (cause) {
      console.error("PMS teammate invitation failed", cause);
      const message = invitationSent
        ? "The invitation was sent, but the list could not refresh. Retry to refresh without sending it again."
        : "Could not invite this teammate. Check the email and your permissions, then try again.";
      setError(message);
      setToast({ type: "error", title: "Could not complete invitation", message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          <DialogTitle>Invite Teammate</DialogTitle>
          <label className="flex flex-col gap-1.5 text-12">
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              disabled={busy || sent}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-12">
            Role
            <select
              value={role}
              onChange={(event) => setRole(Number(event.target.value))}
              disabled={busy || sent}
              className={fieldClass}
            >
              <option value={EUserPermissions.MEMBER}>Teammate</option>
              <option value={EUserPermissions.GUEST}>Viewer</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-12">
            Project access
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={busy || sent}
              className={fieldClass}
            >
              <option value="">Workspace only</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-12 text-secondary">
            You can change access later in Settings. Only projects you administer can be selected.
          </p>
          {error && (
            <p role="alert" className="text-12 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-subtle px-3 py-2 text-12"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[#135DDD] px-3 py-2 text-12 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Sending..." : sent ? "Refresh teammates" : "Send invite"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});
