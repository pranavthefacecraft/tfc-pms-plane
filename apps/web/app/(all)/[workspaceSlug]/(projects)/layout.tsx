/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Outlet, useLocation, useParams } from "react-router";
import { ProjectsAppPowerKProvider } from "@/components/power-k/projects-app-provider";
import { TopNavigationRoot } from "@/components/navigation/top-navigation-root";
import { useAppTheme } from "@/hooks/store/use-app-theme";
// plane web components
import { ProjectAppSidebar } from "./_sidebar";
import { ExtendedProjectSidebar } from "./extended-project-sidebar";

export const handle = { hasSidebarHeader: true };

function WorkspaceLayout() {
  const { sidebarCollapsed } = useAppTheme();
  const { workspaceSlug } = useParams();
  const { pathname } = useLocation();
  const isNotificationsPath = pathname.includes(`/${workspaceSlug}/notifications`);

  return (
    <>
      <ProjectsAppPowerKProvider />
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-subtle">
        <div id="full-screen-portal" className="absolute inset-0 w-full" />
        <div className="relative flex size-full overflow-hidden">
          <ProjectAppSidebar />
          <ExtendedProjectSidebar />
          <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-surface-1">
            <TopNavigationRoot showWorkspaceMenu={sidebarCollapsed || isNotificationsPath} />
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}

export default observer(WorkspaceLayout);
