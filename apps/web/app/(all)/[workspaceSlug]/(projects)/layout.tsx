/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { ProjectShell } from "@/components/workspace/project-shell";

export const handle = { hasSidebarHeader: true };

export default function WorkspaceLayout() {
  return (
    <ProjectShell>
      <Outlet />
    </ProjectShell>
  );
}
