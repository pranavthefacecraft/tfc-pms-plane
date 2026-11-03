/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { ProjectCalendar } from "@/components/projects/project-calendar";
import { ProjectPageHeader } from "@/components/projects/project-page-header";
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectCalendarPage({ params }: Pick<Route.ComponentProps, "params">) {
  const { workspaceSlug, projectId } = params;
  const { getProjectById } = useProject();
  const name = getProjectById(projectId)?.name ?? "";
  return (
    <>
      <PageHead title={name ? `${name} - Calendar` : "Calendar"} />
      <ContentWrapper>
        <div className="min-h-full bg-surface-1">
          <ProjectPageHeader workspaceSlug={workspaceSlug} projectId={projectId} name={name} active="calendar" />
          <main className="px-6 py-6 md:px-8">
            <ProjectCalendar
              key={`${workspaceSlug}:${projectId}`}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
            />
          </main>
        </div>
      </ContentWrapper>
    </>
  );
}

export default observer(ProjectCalendarPage);
