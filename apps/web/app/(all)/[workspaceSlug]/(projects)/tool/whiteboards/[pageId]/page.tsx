/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
// components
import { PageHead } from "@/components/core/page-title";
import { WhiteboardDetailRoot } from "@/components/workspace-pages/whiteboard/detail-root";

export default function WorkspaceToolWhiteboardDetailPage() {
  const { workspaceSlug, pageId } = useParams();

  return (
    <>
      <PageHead title="Whiteboard" />
      <WhiteboardDetailRoot
        key={`${workspaceSlug}:${pageId}`}
        workspaceSlug={workspaceSlug?.toString() ?? ""}
        pageId={pageId?.toString() ?? ""}
      />
    </>
  );
}
