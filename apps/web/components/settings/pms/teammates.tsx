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
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-14 font-semibold">People with access</h3>
          <p className="mt-1 text-12 text-secondary">Manage who can work on PMS projects.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="rounded-full bg-[#135DDD] px-4 py-2 text-12 font-medium text-white hover:bg-[#0F4FC0]"
            onClick={() => setInviting(true)}
          >
            Invite Teammate
          </button>
        )}
      </div>
      <input
        aria-label="Search teammates"
        placeholder="Search teammates"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-4 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13"
      />
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
        <WorkspaceMembersList searchQuery={search} isAdmin={isAdmin} />
      )}
      <div className="mt-6 rounded-lg bg-layer-1 p-4">
        <h4 className="text-13 font-medium">Project collaborators</h4>
        <p className="mt-1 text-12 text-secondary">Choose collaborators when creating or sharing a project.</p>
      </div>
      {inviting && isAdmin && (
        <InviteTeammateDialog
          workspaceSlug={workspaceSlug}
          onClose={() => setInviting(false)}
          onInvited={() => result.mutate()}
        />
      )}
    </>
  );
});
