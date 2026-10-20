/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ProjectOverview } from "@/components/projects/overview";
import { ProjectOverviewHeader } from "@/components/projects/overview-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import type { Route } from "./+types/page";

export default function ProjectOverviewPage({ params }: Pick<Route.ComponentProps, "params">) {
  return (
    <>
      <ProjectOverviewHeader {...params} />
      <ContentWrapper>
        <ProjectOverview key={`${params.workspaceSlug}:${params.projectId}`} {...params} />
      </ContentWrapper>
    </>
  );
}
