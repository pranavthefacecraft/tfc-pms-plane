/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
// components
import { PageHead } from "@/components/core/page-title";
import { WorkspacePageDetailRoot } from "@/components/workspace-pages/page-detail-root";

export default function WorkspaceToolPageDetailPage() {
  const { workspaceSlug, pageId } = useParams();

  return (
    <>
      <PageHead title="Page" />
      <WorkspacePageDetailRoot workspaceSlug={workspaceSlug?.toString() ?? ""} pageId={pageId?.toString() ?? ""} />
    </>
  );
}
