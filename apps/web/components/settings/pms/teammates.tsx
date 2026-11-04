/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { useMember } from "@/hooks/store/use-member";
import { WorkspaceMembersList } from "@/components/workspace/settings/members-list";
import { personName } from "@/components/projects/create-project-dialog.helpers";
import { InviteTeammateDialog } from "./invite-teammate-dialog";

export const PMSTeammates = observer(function PMSTeammates({ workspaceSlug }: { workspaceSlug: string }) {
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState("");
  const { workspaceInfoBySlug, allowPermissions } = useUserPermissions();
  const { workspace: members } = useMember();
  const info = workspaceInfoBySlug(workspaceSlug);
  const canView = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const result = useSWR(canView ? `WORKSPACE_MEMBERS_AND_MEMBER_INVITATIONS_${workspaceSlug}` : null, async () => {
    await members.fetchWorkspaceMemberInvitations(workspaceSlug);
    return members.fetchWorkspaceMembers(workspaceSlug);
  });
  if (!info) return <p role="status">Loading workspace permissions...</p>;
  if (!canView) return <p role="alert">Only workspace admins and members can view teammates.</p>;
  const teammates = members.getWorkspaceMemberIds(workspaceSlug).flatMap((id) => {
    const member = members.getWorkspaceMemberDetails(id);
    return member?.is_active !== false && member ? [member] : [];
  });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
        <div>
          <h3 className="text-14 font-semibold">People with access</h3>
          <p className="mt-1 text-12 text-secondary">Manage who can work on PMS projects.</p>
        </div>
        {canView && (
          <button
            type="button"
            className="rounded-full bg-[#135DDD] px-3 py-1.5 text-12 font-medium text-white hover:bg-[#0F4FC0]"
            onClick={() => setInviting(true)}
          >
            Invite Teammates
          </button>
        )}
      </div>
      {result.error ? (
        <p role="alert" className="text-13">
          Could not load teammates.{" "}
          <button type="button" className="text-[#135DDD] underline" onClick={() => void result.mutate()}>
            Retry
          </button>
        </p>
      ) : result.isLoading ? (
        <p role="status" className="text-13">
          Loading teammates...
        </p>
      ) : (
        <ul aria-label="People with access" className="divide-y divide-subtle border-b border-subtle">
          {teammates.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-13 font-medium">{personName(member.member, "Team member")}</p>
                <p className="mt-1 truncate text-12 text-secondary">{member.member.email}</p>
              </div>
              <span className="shrink-0 text-12 text-secondary">
                {member.role === EUserPermissions.ADMIN
                  ? "Admin"
                  : member.role === EUserPermissions.MEMBER
                    ? "Editor"
                    : "Viewer"}
              </span>
            </li>
          ))}
          {teammates.length === 0 && <li className="py-4 text-13 text-secondary">No teammates yet.</li>}
        </ul>
      )}
      <div className="mt-4 rounded-md bg-[#F8F9FB] p-3 dark:bg-layer-1">
        <h4 className="text-13 font-medium">Project collaborators</h4>
        <p className="mt-1 text-12 text-secondary">Choose collaborators when creating or sharing a project.</p>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-12 text-secondary">Manage members and pending invitations</summary>
        <div className="pt-4">
          <input
            aria-label="Search teammates"
            placeholder="Search teammates"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mb-4 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13"
          />
          <WorkspaceMembersList searchQuery={search} isAdmin={isAdmin} />
        </div>
      </details>
      {inviting && canView && (
        <InviteTeammateDialog
          workspaceSlug={workspaceSlug}
          onClose={() => setInviting(false)}
          onInvited={() => result.mutate()}
        />
      )}
    </>
  );
});
