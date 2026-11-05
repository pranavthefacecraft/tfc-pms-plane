/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { InviteCollaboratorsDialog } from "@/components/projects/invite-collaborators-dialog";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  workspaceSlug: string;
};

export const SendProjectInvitationModal = observer(function SendProjectInvitationModal({
  isOpen,
  onClose,
  projectId,
  workspaceSlug,
}: Props) {
  const { getPartialProjectById } = useProject();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const project = getPartialProjectById(projectId);
  if (!isOpen) return null;
  if (!project) return <p role="alert">Could not load the project. Refresh this page and try again.</p>;
  return (
    <InviteCollaboratorsDialog
      workspaceSlug={workspaceSlug}
      project={{
        ...project,
        member_role: getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId),
      }}
      onClose={onClose}
    />
  );
});
