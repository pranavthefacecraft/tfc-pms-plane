/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { PageHead } from "@/components/core/page-title";
import { WhiteboardGuestEntry } from "@/components/workspace-pages/whiteboard/guest-entry";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

export { handle } from "@/app/(all)/[workspaceSlug]/(projects)/layout";

export default function SharedWhiteboardPage() {
  const { workspaceSlug, sharedWorkspaceSlug, pageId } = useParams();
  return (
    <>
      <PageHead title="Shared whiteboard" />
      <AuthenticationWrapper>
        <WhiteboardGuestEntry
          key={`${workspaceSlug}:${sharedWorkspaceSlug}:${pageId}`}
          workspaceSlug={sharedWorkspaceSlug?.toString() ?? ""}
          pageId={pageId?.toString() ?? ""}
          navigationWorkspaceSlug={workspaceSlug?.toString()}
        />
      </AuthenticationWrapper>
    </>
  );
}
