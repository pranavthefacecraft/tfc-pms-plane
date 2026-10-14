/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
// components
import { PageHead } from "@/components/core/page-title";
import { WorkspacePagesListRoot } from "@/components/workspace-pages/pages-list-root";

export default function WorkspaceToolPagesListPage() {
  const { workspaceSlug } = useParams();

  return (
    <>
      <PageHead title="Pages" />
      <WorkspacePagesListRoot workspaceSlug={workspaceSlug?.toString() ?? ""} />
    </>
  );
}
