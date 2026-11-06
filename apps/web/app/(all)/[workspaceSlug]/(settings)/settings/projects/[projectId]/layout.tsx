/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { Outlet } from "react-router";
// components
import { getProjectActivePath } from "@/components/settings/helper";
import { SettingsMobileNav } from "@/components/settings/mobile/nav";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// types
import type { Route } from "./+types/layout";
import { ProjectSettingsSidebarRoot } from "@/components/settings/project/sidebar";
import { TopNavigationRoot } from "@/components/navigation/top-navigation-root";

export const handle = { hasSidebarHeader: true, hideSettingsSectionHeader: true };

function ProjectDetailSettingsLayout({ params }: Pick<Route.ComponentProps, "params">) {
  const { workspaceSlug, projectId } = params;
  // router
  const pathname = usePathname();

  return (
    <div className="relative flex size-full overflow-hidden bg-surface-1">
      <div className="hidden h-full shrink-0 md:block">
        <ProjectSettingsSidebarRoot projectId={projectId} />
      </div>
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center border-b border-[#E2E6EF] dark:border-subtle [&>div:last-child]:border-b-0">
          <img
            src="/clevdex-pms-lockup.svg"
            alt="PMS by Clevdex"
            width={184}
            height={40}
            className="ml-3 h-auto w-28 shrink-0 rounded-md bg-white md:hidden"
          />
          <TopNavigationRoot showWorkspaceMenu={false} />
        </div>
        <SettingsMobileNav
          hamburgerContent={(props) => <ProjectSettingsSidebarRoot {...props} projectId={projectId} />}
          activePath={getProjectActivePath(pathname) || ""}
        />
        <div className="relative flex min-h-0 flex-1">
          <ProjectAuthWrapper workspaceSlug={workspaceSlug} projectId={projectId}>
            <Outlet />
          </ProjectAuthWrapper>
        </div>
      </main>
    </div>
  );
}

export default observer(ProjectDetailSettingsLayout);
