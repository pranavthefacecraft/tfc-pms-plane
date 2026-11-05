/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { X } from "lucide-react";
import { EUserPermissions } from "@plane/constants";
import { Dialog, DialogContent, DialogTitle } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import type { TProject } from "@plane/types";
import { copyUrlToClipboard } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { ProjectCollaboratorsService } from "@/services/project-collaborators.service";
import { Avatar, SuggestionList } from "./collaborator-invite-parts";
import { EDITOR_ROLE, VIEWER_ROLE, personName, teammateSuggestions } from "./create-project-dialog.helpers";
import type { TTeammate } from "./create-project-dialog.helpers";
import { accessNote, accessRoleLabel } from "./invite-collaborators.helpers";

const collaboratorsService = new ProjectCollaboratorsService();

/**
 * "Invite Collaborators" popup from the Projects page. Teammates are added as project members
 * (the same records as Settings > Members); unknown emails get a workspace invitation first.
 */
export const InviteCollaboratorsDialog = observer(function InviteCollaboratorsDialog({
  workspaceSlug,
  project,
  onClose,
}: {
  workspaceSlug: string;
  project: Pick<TProject, "id" | "name" | "member_role" | "created_by" | "network">;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);
  const [role, setRole] = useState(EDITOR_ROLE);
  const [error, setError] = useState("");
  const { data: currentUser } = useUser();
  const { fetchProjectDetails } = useProject();
  const {
    getUserDetails,
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails, fetchWorkspaceMembers },
    project: { fetchProjectMembers, getProjectMemberIds, getProjectMemberDetails },
  } = useMember();
  const members = useSWR(["invite-collaborators-members", workspaceSlug, project.id], () =>
    Promise.all([fetchProjectMembers(workspaceSlug, project.id, true), fetchWorkspaceMembers(workspaceSlug)])
  );
  const canInvite = project.member_role === EUserPermissions.ADMIN;
  const memberIds = getProjectMemberIds(project.id, true) ?? [];
  const people = (workspaceMemberIds ?? []).map((id) => ({
    id,
    name: personName(getUserDetails(id), "Team member"),
    email: getUserDetails(id)?.email ?? "",
    isActive: getWorkspaceMemberDetails(id)?.is_active !== false,
  }));
  // Current members and pending invites are treated as already chosen so they are not suggested again.
  const withAccess: TTeammate[] = [
    ...memberIds.map((id) => ({ memberId: id, email: getUserDetails(id)?.email ?? "", role: EDITOR_ROLE })),
    ...invited.map((email) => ({ email, role: EDITOR_ROLE })),
  ];
  const { term, suggestions, canInviteEmail } = teammateSuggestions(query, people, withAccess, currentUser);

  const invite = async (email: string, role: number, label: string) => {
    if (busy || !email) return;
    setBusy(true);
    setError("");
    let saved = false;
    try {
      const result = await collaboratorsService.invite(workspaceSlug, project.id, [{ email, role }]);
      saved = true;
      setQuery("");
      if (result.invited.length) setInvited((previous) => [...previous, ...result.invited]);
      await Promise.all([members.mutate(), fetchProjectDetails(workspaceSlug, project.id)]);
      setToast({
        type: "success",
        title: result.invited.length ? "Invitation sent" : "Collaborator added",
        message: result.invited.length
          ? `${label} will join ${project.name} after accepting the invitation, which also joins the workspace.`
          : `${label} can now open ${project.name}.`,
      });
    } catch (error) {
      console.error("Collaborator invite failed", error);
      const message = saved
        ? "Access was updated, but the member list could not refresh. Close and reopen this popup to refresh."
        : "Could not add this teammate. Check the email and your permissions, then try again.";
      setError(message);
      setToast({ type: "error", title: "Could not complete invitation", message });
    } finally {
      setBusy(false);
    }
  };
  const addMember = (id: string) =>
    void invite(
      getUserDetails(id)?.email ?? "",
      Math.min(role, getWorkspaceMemberDetails(id)?.role ?? EDITOR_ROLE),
      personName(getUserDetails(id), "Teammate")
    );
  const addEmail = () => void invite(term, role, term);
  const copyLink = async () => {
    try {
      await copyUrlToClipboard(`${workspaceSlug}/projects/${project.id}/overview`);
      setToast({ type: "success", title: "Link copied", message: "The project link is on your clipboard." });
    } catch {
      setToast({ type: "error", title: "Could not copy link", message: "Copy the address from the browser instead." });
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
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <DialogTitle>Invite Collaborators</DialogTitle>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded p-1 text-secondary hover:bg-layer-1"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-12 text-secondary">
            Add teammates to <strong>{project.name}</strong>. New teammates will also join this workspace.
          </p>
          {canInvite ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-collaborators-input" className="text-13 font-medium">
                Invite teammates
              </label>
              <input
                id="invite-collaborators-input"
                value={query}
                autoComplete="off"
                disabled={busy || members.isLoading || !!members.error}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (suggestions[0]) addMember(suggestions[0].id);
                  else if (canInviteEmail) addEmail();
                }}
                placeholder="Enter email or teammate name"
                className="w-full rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-13 outline-none placeholder:text-placeholder focus:border-[#135DDD] focus:ring-1 focus:ring-[#135DDD]"
              />
              <label className="mt-2 flex items-center justify-between text-12">
                Project role
                <select
                  aria-label="Project role"
                  value={role}
                  disabled={busy}
                  onChange={(event) => setRole(Number(event.target.value))}
                  className="rounded-md border border-subtle bg-surface-1 px-2 py-1"
                >
                  <option value={EDITOR_ROLE}>Editor</option>
                  <option value={VIEWER_ROLE}>Viewer</option>
                </select>
              </label>
              <p className="text-12 text-secondary">
                Workspace admins remain admins; workspace viewers remain viewers.
              </p>
              {term && (
                <SuggestionList
                  term={term}
                  suggestions={suggestions}
                  canInviteEmail={canInviteEmail}
                  onAddMember={addMember}
                  onAddEmail={addEmail}
                />
              )}
              {error && (
                <p role="alert" className="text-12 text-danger-primary">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <p className="text-12 text-secondary">Only project admins can invite collaborators.</p>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-13 font-medium">People with access</span>
            {members.error ? (
              <p role="alert" className="text-12 text-danger-primary">
                Could not load project members.{" "}
                <button type="button" className="underline" onClick={() => void members.mutate()}>
                  Retry
                </button>
              </p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto" aria-busy={!members.data}>
                {memberIds.map((id) => {
                  const name = personName(getUserDetails(id), "Team member");
                  return (
                    <li key={id} className="flex items-center gap-3">
                      <Avatar label={name} />
                      <span className="min-w-0 flex-1 truncate text-13">{name}</span>
                      <span className="text-12 text-secondary">
                        {accessRoleLabel(id, project.created_by, getProjectMemberDetails(id, project.id)?.role)}
                      </span>
                    </li>
                  );
                })}
                {invited.map((email) => (
                  <li key={email} className="flex items-center gap-3">
                    <Avatar label={email} />
                    <span className="min-w-0 flex-1 truncate text-13">{email}</span>
                    <span className="text-12 text-secondary">Invited</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="rounded-lg border border-subtle px-3 py-2 text-12 text-secondary">
            {accessNote(project.network)}
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="self-start text-12 font-medium text-[#135DDD] underline"
          >
            Copy project link
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
