/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import type { ReactNode } from "react";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspaceContentWrapper } from "@/components/workspace/content-wrapper";
import { AppRailVisibilityProvider } from "@/lib/app-rail";
import { GlobalModals } from "@/components/common/modal/global";
import { WorkspaceAuthWrapper } from "@/layouts/auth-layout/workspace-wrapper";
import type { Route } from "./+types/layout";

export default function WorkspaceLayout(props: Route.ComponentProps) {
  const { workspaceSlug } = props.params;

  return (
    <AuthenticationWrapper>
      <WorkspaceShell workspaceSlug={workspaceSlug}>
        <Outlet />
      </WorkspaceShell>
    </AuthenticationWrapper>
  );
}

export function WorkspaceShell({ workspaceSlug, children }: { workspaceSlug: string; children: ReactNode }) {
  return (
    <WorkspaceAuthWrapper>
      <AppRailVisibilityProvider>
        <WorkspaceContentWrapper>
          <GlobalModals workspaceSlug={workspaceSlug} />
          {children}
        </WorkspaceContentWrapper>
      </AppRailVisibilityProvider>
    </WorkspaceAuthWrapper>
  );
}
