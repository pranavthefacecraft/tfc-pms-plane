/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArrowNarrowLeftOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
// plane imports
import { ROLE_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";

type Props = {
  projectId: string;
};

export const ProjectSettingsSidebarHeader = observer(function ProjectSettingsSidebarHeader(props: Props) {
  const { projectId } = props;
  // router
  const router = useAppRouter();
  // store hooks
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  const { getPartialProjectById } = useProject();
  // derived values
  const projectDetails = getPartialProjectById(projectId);
  const currentProjectRole = currentWorkspace?.slug
    ? getProjectRoleByWorkspaceSlugAndProjectId(currentWorkspace.slug, projectId)
    : undefined;
  // translation
  const { t } = useTranslation();

  if (!currentProjectRole) return null;

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-1 px-3 py-3 text-14 font-semibold text-[#3A4D66] dark:text-primary">
        <IconButton
          variant="ghost"
          size="sm"
          icon={<Icon icon={ArrowNarrowLeftOutline} />}
          aria-label="Back to project"
          onClick={() => router.push(`/${currentWorkspace?.slug}/projects/${projectId}/issues/`)}
        />
        <p>Project settings</p>
      </div>
      <div className="mx-3 mt-1 flex items-center gap-3 rounded-lg border border-[#E2E6EF] px-3 py-3 dark:border-subtle">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[#EAF2FF] dark:bg-layer-2">
          <Logo logo={projectDetails?.logo_props} size={20} />
        </div>
        <div className="truncate">
          <p className="truncate text-13 font-medium text-[#3A4D66] dark:text-primary">{projectDetails?.name}</p>
          <p className="mt-0.5 truncate text-12 text-secondary">{t(ROLE_DETAILS[currentProjectRole].i18n_title)}</p>
        </div>
      </div>
    </div>
  );
});
