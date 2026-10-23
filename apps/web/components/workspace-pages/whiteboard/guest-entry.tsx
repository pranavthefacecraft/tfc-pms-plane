/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Navigate } from "react-router";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserProfile, useUserSettings } from "@/hooks/store/user";
import { WorkspaceShell } from "@/app/(all)/[workspaceSlug]/layout";
import { ProjectShell } from "@/components/workspace/project-shell";
import { WhiteboardDetailRoot } from "./detail-root";
import { GuestWhiteboard } from "./guest-whiteboard";

type GuestAccess = { is_member: boolean; joined: boolean; guest_role: "disabled" | "viewer" | "editor" };

class GuestService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async access(url: string): Promise<GuestAccess> {
    return (await this.get(url)).data;
  }
  async join(url: string): Promise<GuestAccess> {
    return (await this.post(url)).data;
  }
  async prepareWorkspace(url: string): Promise<{ workspace_slug: string }> {
    return (await this.post(url)).data;
  }
}

const service = new GuestService();

export function WhiteboardGuestEntry({
  workspaceSlug,
  pageId,
  navigationWorkspaceSlug,
}: {
  workspaceSlug: string;
  pageId: string;
  navigationWorkspaceSlug?: string;
}) {
  const [joining, setJoining] = useState(false);
  const url = `/api/workspaces/${workspaceSlug}/workspace-pages/${pageId}/guest/`;
  const { data, error, mutate } = useSWR(url, () => service.access(url), { shouldRetryOnError: false });

  if (data?.is_member && navigationWorkspaceSlug)
    return <Navigate replace to={`/${workspaceSlug}/tool/whiteboards/${pageId}`} />;

  if (data?.is_member)
    return (
      <WorkspaceShell workspaceSlug={workspaceSlug}>
        <ProjectShell>
          <WhiteboardDetailRoot workspaceSlug={workspaceSlug} pageId={pageId} />
        </ProjectShell>
      </WorkspaceShell>
    );

  if (data?.joined)
    return (
      <GuestWorkspaceEntry
        workspaceSlug={workspaceSlug}
        pageId={pageId}
        navigationWorkspaceSlug={navigationWorkspaceSlug}
      />
    );

  return (
    <GuestJoinPrompt
      role={data?.guest_role}
      error={!!error}
      joining={joining}
      onRetry={() => void mutate()}
      onJoin={async () => {
        setJoining(true);
        try {
          await mutate(await service.join(url), false);
        } catch (cause) {
          console.error("Whiteboard guest join failed", cause);
          setToast({
            type: "error",
            title: "Could not join whiteboard",
            message: "Ask the owner to check guest access, then retry.",
          });
        } finally {
          setJoining(false);
        }
      }}
    />
  );
}

function GuestWorkspaceEntry({
  workspaceSlug,
  pageId,
  navigationWorkspaceSlug,
}: {
  workspaceSlug: string;
  pageId: string;
  navigationWorkspaceSlug?: string;
}) {
  const { fetchWorkspaces } = useWorkspace();
  const { fetchUserProfile } = useUserProfile();
  const { fetchCurrentUserSettings } = useUserSettings();
  const url = `/api/workspaces/${workspaceSlug}/workspace-pages/${pageId}/guest-workspace/`;
  const { data, error, mutate } = useSWR(
    url,
    async () => {
      const result = await service.prepareWorkspace(url);
      await Promise.all([fetchWorkspaces(), fetchUserProfile(), fetchCurrentUserSettings(true)]);
      return result;
    },
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      onError: (cause) => console.error("Could not prepare whiteboard guest workspace", cause),
    }
  );
  if (error)
    return (
      <div className="m-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <p role="alert">Could not open your workspace. Please retry or contact your instance administrator.</p>
        <Button label="Retry" variant="secondary" size="sm" stretch="auto" onClick={() => void mutate()} />
      </div>
    );
  if (!data) return <p role="status">Preparing your workspace...</p>;
  if (data.workspace_slug !== navigationWorkspaceSlug)
    return <Navigate replace to={`/${data.workspace_slug}/tool/shared-whiteboards/${workspaceSlug}/${pageId}`} />;
  return (
    <WorkspaceShell workspaceSlug={data.workspace_slug}>
      <ProjectShell>
        <GuestWhiteboard workspaceSlug={workspaceSlug} pageId={pageId} />
      </ProjectShell>
    </WorkspaceShell>
  );
}

function GuestJoinPrompt({
  role,
  error,
  joining,
  onRetry,
  onJoin,
}: {
  role: GuestAccess["guest_role"] | undefined;
  error: boolean;
  joining: boolean;
  onRetry: () => void;
  onJoin: () => Promise<void>;
}) {
  return (
    <div className="flex h-screen w-full flex-col bg-surface-1">
      <div className="m-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <img src="/tfc-pms-logo.png" alt="TFC PMS" className="h-10 w-auto" />
        <h1 className="text-20 font-semibold">{error ? "Whiteboard unavailable" : "Join whiteboard as a guest"}</h1>
        {error ? (
          <>
            <p role="alert" className="text-14 text-secondary">
              This whiteboard may not exist, or guest access may be disabled. Ask the owner to check sharing.
            </p>
            <Button label="Retry" variant="secondary" size="sm" stretch="auto" onClick={onRetry} />
          </>
        ) : !role ? (
          <p role="status">Checking guest access...</p>
        ) : (
          <>
            <p className="text-14 text-secondary">
              You will join as a guest with {role === "editor" ? "Editor" : "Viewer"} access to this whiteboard only.
              You will not gain access to other workspace content.
            </p>
            <Button
              label={joining ? "Joining..." : "Join as guest"}
              size="sm"
              stretch="auto"
              variant="primary"
              disabled={joining}
              onClick={onJoin}
            />
          </>
        )}
      </div>
    </div>
  );
}
