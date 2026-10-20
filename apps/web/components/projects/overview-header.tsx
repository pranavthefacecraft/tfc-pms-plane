/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { AppHeader } from "@/components/core/app-header";
import { HeaderFilters } from "@/components/issues/filters";
import { IssuesHeader } from "@/components/issues/header";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";

export const ProjectOverviewHeader = observer(function ProjectOverviewHeader({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const { currentProjectDetails } = useProject();
  const { allowPermissions } = useUserPermissions();
  const canUserCreateIssue = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  return (
    <AppHeader
      className="shrink-0"
      header={<IssuesHeader isOverview />}
      mobileHeader={
        <div className="flex gap-2 overflow-x-auto border-b border-subtle bg-surface-1 px-3 py-2 md:hidden">
          <HeaderFilters
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            currentProjectDetails={currentProjectDetails}
            canUserCreateIssue={canUserCreateIssue}
            navigateToIssues
            compact
          />
        </div>
      }
    />
  );
});
