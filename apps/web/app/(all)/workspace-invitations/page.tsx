/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  BoxesOutline,
  CloseOutline,
  ShareAltOutline,
  StarOutline,
  TickOutline,
  UserOutline,
} from "@makeplane/propel/icons";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { EmptySpace, EmptySpaceItem } from "@/components/ui/empty-space";
// constants
import { WORKSPACE_INVITATION } from "@plane/constants";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspaceService } from "@/services/workspace.service";
import { setToast } from "@plane/blocks/toast";
// services

// service initialization
const workspaceService = new WorkspaceService();

function WorkspaceInvitationPage() {
  // router
  const router = useAppRouter();
  // query params
  const searchParams = useSearchParams();
  const invitation_id = searchParams.get("invitation_id");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  // store hooks
  const { data: currentUser } = useUser();
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState("");

  const { data: invitationDetail, error } = useSWR(
    invitation_id && slug ? [WORKSPACE_INVITATION(invitation_id.toString()), slug, token] : null,
    invitation_id && slug
      ? () => workspaceService.getWorkspaceInvitation(slug.toString(), invitation_id.toString(), token)
      : null
  );

  const projects = invitationDetail?.projects ?? [];
  const invitationTarget = projects.length
    ? `${projects.map((project) => project.name).join(", ")} in ${invitationDetail?.workspace.name}`
    : invitationDetail?.workspace.name;

  const respond = (accepted: boolean) => {
    if (!invitationDetail || responding) return;
    if (!token) {
      setResponseError("This invitation link is missing its token. Open the full link from your invitation email.");
      return;
    }
    setResponding(true);
    setResponseError("");
    void workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted,
        token: token,
      })
      .then(() => {
        if (accepted && invitationDetail.email.toLowerCase() === currentUser?.email?.toLowerCase()) {
          const project = projects[0];
          router.push(
            project
              ? `/${invitationDetail.workspace.slug}/projects/${project.id}/overview`
              : `/${invitationDetail.workspace.slug}`
          );
        } else {
          router.push("/");
        }
      })
      .catch((err: unknown) => {
        console.error("Invitation response failed", err);
        const message = "Could not respond to the invitation. Sign in with the invited email and try again.";
        setResponseError(message);
        setToast({ type: "error", title: "Invitation not accepted", message });
      })
      .finally(() => setResponding(false));
  };

  return (
    <AuthenticationWrapper pageType={EPageTypes.PUBLIC}>
      <div className="flex h-full w-full flex-col items-center justify-center px-3">
        {responseError && (
          <p role="alert" className="mb-4 text-13 text-danger-primary">
            {responseError}
          </p>
        )}
        {responding && (
          <p role="status" className="mb-4 text-13">
            Updating invitation...
          </p>
        )}
        {invitationDetail && !invitationDetail.responded_at ? (
          error ? (
            <div className="shadow-2xl flex w-full flex-col space-y-4 rounded-sm border border-subtle bg-surface-1 px-4 py-8 text-center md:w-1/3">
              <h2 className="text-18 uppercase">INVITATION NOT FOUND</h2>
            </div>
          ) : (
            <EmptySpace
              title={`You have been invited to ${invitationTarget}`}
              description={
                projects.length
                  ? "Accepting joins this workspace and adds you to the invited project(s), where you can collaborate on tasks."
                  : "Accepting joins this workspace. Project access depends on membership, role, and project visibility."
              }
            >
              <EmptySpaceItem Icon={TickOutline} title="Accept" action={() => respond(true)} />
              <EmptySpaceItem Icon={CloseOutline} title="Ignore" action={() => respond(false)} />
            </EmptySpace>
          )
        ) : error || invitationDetail?.responded_at ? (
          invitationDetail?.accepted ? (
            <EmptySpace
              title={`You are already a member of ${invitationDetail.workspace.name}`}
              description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
            >
              <EmptySpaceItem Icon={BoxesOutline} title="Continue to home" href="/" />
            </EmptySpace>
          ) : (
            <EmptySpace
              title="This invitation link is not active anymore."
              description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
              link={{ text: "Or start from an empty project", href: "/" }}
            >
              {!currentUser ? (
                <EmptySpaceItem Icon={UserOutline} title="Sign in to continue" href="/" />
              ) : (
                <EmptySpaceItem Icon={BoxesOutline} title="Continue to home" href="/" />
              )}
              <EmptySpaceItem Icon={StarOutline} title="Star us on GitHub" href="https://github.com/makeplane" />
              <EmptySpaceItem
                Icon={ShareAltOutline}
                title="Join our community of active creators"
                href="https://forum.plane.so"
              />
            </EmptySpace>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <LogoSpinner />
          </div>
        )}
      </div>
    </AuthenticationWrapper>
  );
}

export default observer(WorkspaceInvitationPage);
