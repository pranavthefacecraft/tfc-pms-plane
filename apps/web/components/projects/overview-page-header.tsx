/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSearchParams } from "next/navigation";
import { ProjectOverviewHeader } from "./overview-header";

/** The Figma overview has its own tabs, so this bar is hidden there and only shown on the classic layout. */
export function ProjectOverviewPageHeader(props: { workspaceSlug: string; projectId: string }) {
  const classic = useSearchParams().get("view") === "classic";
  return classic ? <ProjectOverviewHeader {...props} /> : null;
}
