/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useSearchParams } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectsListMobileHeader } from "@/components/projects/mobile-header";
import { ProjectsBaseHeader } from "@/components/project/header";

export default function ProjectListLayout() {
  const [searchParams] = useSearchParams();
  // The Figma projects page renders its own title; the legacy card grid keeps the app header.
  if (searchParams.get("view") !== "cards") return <Outlet />;
  return (
    <>
      <AppHeader header={<ProjectsBaseHeader />} mobileHeader={<ProjectsListMobileHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
