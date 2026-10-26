/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Mail } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { AddOutline, AddWorkItemOutline, PagesOutline, ProjectsOutline, UserOutline } from "@makeplane/propel/icons";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IWorkspaceBulkInviteFormData } from "@plane/types";
import { setToast } from "@plane/blocks/toast";
import { SendWorkspaceInvitationModal } from "@/components/workspace/members";
import { useCreateWorkspacePage } from "@/components/workspace-pages/use-create-page";
import { getToolTypeIcon } from "@/components/workspace-pages/helpers";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { WorkspaceMessageComposer } from "@/components/workspace-messages/composer";

export const TopNavCreateMenu = observer(function TopNavCreateMenu({ workspaceSlug }: { workspaceSlug: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const { t } = useTranslation();
  const { toggleCreateIssueModal, toggleCreateProjectModal } = useCommandPalette();
  const { joinedProjectIds } = useProject();
  const { allowPermissions } = useUserPermissions();
  const {
    workspace: { inviteMembersToWorkspace },
  } = useMember();
  const page = useCreateWorkspacePage(workspaceSlug, "page");
  const whiteboard = useCreateWorkspacePage(workspaceSlug, "whiteboard");
  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const canInvite = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const WhiteboardIcon = getToolTypeIcon("whiteboard");

  const handleInvite = async (data: IWorkspaceBulkInviteFormData) => {
    try {
      await inviteMembersToWorkspace(workspaceSlug, data);
      setInviteOpen(false);
      setToast({
        type: "success",
        title: t("success"),
        message: t("workspace_settings.settings.members.invitations_sent_successfully"),
      });
    } catch (error: unknown) {
      setToast({
        type: "error",
        title: t("error"),
        message:
          typeof error === "object" && error !== null && "error" in error && typeof error.error === "string"
            ? error.error
            : t("something_went_wrong_please_try_again"),
      });
      throw error;
    }
  };

  if (!canCreate) return null;

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-subtle-1 bg-surface-1 px-2.5 text-13 font-medium text-primary hover:bg-layer-1-hover"
            >
              <AddOutline className="size-4" />
              {t("common.create")}
            </button>
          }
        />
        <MenuContent side="bottom" align="start">
          <MenuItem
            icon={<AddWorkItemOutline className="size-4" />}
            label={t("common.work_item")}
            disabled={joinedProjectIds.length === 0}
            onClick={() => toggleCreateIssueModal(true)}
          />
          <MenuItem
            icon={<ProjectsOutline className="size-4" />}
            label={t("common.project")}
            onClick={() => toggleCreateProjectModal(true)}
          />
          <MenuItem
            icon={<PagesOutline className="size-4" />}
            label={t("common.page")}
            disabled={page.isCreating}
            onClick={() => void page.createPage()}
          />
          <MenuItem icon={<Mail className="size-4" />} label="Message" onClick={() => setMessageOpen(true)} />
          <MenuItem
            icon={<WhiteboardIcon className="size-4" />}
            label="Whiteboard"
            disabled={whiteboard.isCreating}
            onClick={() => void whiteboard.createPage()}
          />
          {canInvite && (
            <MenuItem
              icon={<UserOutline className="size-4" />}
              label={t("common.invite")}
              onClick={() => setInviteOpen(true)}
            />
          )}
        </MenuContent>
      </Menu>
      {messageOpen && <WorkspaceMessageComposer workspaceSlug={workspaceSlug} onClose={() => setMessageOpen(false)} />}
      {canInvite && inviteOpen && (
        <SendWorkspaceInvitationModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          onSubmit={handleInvite}
        />
      )}
    </>
  );
});
