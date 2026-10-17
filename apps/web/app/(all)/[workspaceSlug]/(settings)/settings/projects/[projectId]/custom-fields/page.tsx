/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { ProjectCustomFieldsManager } from "@/components/projects/custom-fields/manager";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import type { Route } from "./+types/page";

function CustomFieldsSettingsPage({ params }: Pick<Route.ComponentProps, "params">) {
  const { workspaceSlug, projectId } = params;
  const { t } = useTranslation();
  const title = t("project_settings.custom_fields", { defaultValue: "Custom fields" });
  const { currentProjectDetails } = useProject();
  const { allowPermissions } = useUserPermissions();
  const canManageFields = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  if (!canManageFields) return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;

  return (
    <SettingsContentWrapper header={<SettingsPageHeader leftItem={<span>{title}</span>} />}>
      <PageHead title={currentProjectDetails?.name ? `${currentProjectDetails.name} - ${title}` : title} />
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-20 font-semibold">{title}</h1>
          <p className="mt-1 text-13 text-secondary">
            Manage the fields available on this project's work items, including Stage and Status.
          </p>
        </div>
        {currentProjectDetails?.archived_at && (
          <p role="status" className="text-13 text-secondary">
            Archived projects are read-only.
          </p>
        )}
        <ProjectCustomFieldsManager
          key={projectId}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          disabled={!!currentProjectDetails?.archived_at}
        />
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(CustomFieldsSettingsPage);
