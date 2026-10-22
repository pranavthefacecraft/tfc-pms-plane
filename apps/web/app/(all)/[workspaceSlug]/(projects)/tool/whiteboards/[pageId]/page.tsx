/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
// components
import { PageHead } from "@/components/core/page-title";
import { WhiteboardGuestEntry } from "@/components/workspace-pages/whiteboard/guest-entry";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

export { handle } from "@/app/(all)/[workspaceSlug]/(projects)/layout";

export default function WorkspaceToolWhiteboardDetailPage() {
  const { workspaceSlug, pageId } = useParams();

  return (
    <>
      <PageHead title="Whiteboard" />
      <AuthenticationWrapper>
        <WhiteboardGuestEntry
          key={`${workspaceSlug}:${pageId}`}
          workspaceSlug={workspaceSlug?.toString() ?? ""}
          pageId={pageId?.toString() ?? ""}
        />
      </AuthenticationWrapper>
    </>
  );
}
