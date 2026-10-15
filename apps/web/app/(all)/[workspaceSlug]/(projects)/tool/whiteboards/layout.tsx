/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { WorkspaceToolHeader } from "@/components/workspace-pages/tool-header";

export default function WorkspaceToolWhiteboardsLayout() {
  return (
    <>
      <AppHeader header={<WorkspaceToolHeader toolType="whiteboard" />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
