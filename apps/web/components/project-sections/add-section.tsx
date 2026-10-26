/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { EIssueFilterType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import { AddOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { useProjectSection } from "@/hooks/store/use-project-section";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useIssues } from "@/hooks/store/use-issues";
import { SectionDialog } from "./section-dialog";
import { sectionErrorMessage } from "./errors";

export const AddSection = observer(function AddSection({
  workspaceSlug,
  projectId,
  readOnly = false,
}: {
  workspaceSlug: string;
  projectId: string;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"create" | "manage" | null>(null);
  const [changingGrouping, setChangingGrouping] = useState(false);
  const sectionStore = useProjectSection();
  const storeType = useIssueStoreType();
  const { fetchIssues, updateFilters } = useIssuesActions(storeType);
  const { issues, issuesFilter } = useIssues(storeType);
  const { viewId, moduleId, cycleId } = useParams();
  const entityId = viewId?.toString() ?? moduleId?.toString() ?? cycleId?.toString() ?? projectId;
  const layout = issuesFilter?.issueFilters?.displayFilters?.layout;
  const canGroup = layout === EIssueLayoutTypes.LIST || layout === EIssueLayoutTypes.KANBAN;
  const { error, mutate } = useSWR(["project-sections", workspaceSlug, projectId], () =>
    sectionStore.fetch(workspaceSlug, projectId)
  );
  const { allowPermissions } = useUserPermissions();
  const { getProjectById } = useProject();
  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const canEdit = canCreate && !readOnly && !getProjectById(projectId)?.archived_at;
  const groupBySections = async () => {
    setChangingGrouping(true);
    try {
      await updateFilters(entityId, EIssueFilterType.DISPLAY_FILTERS, {
        group_by: "section",
        sub_group_by: null,
        show_empty_groups: true,
      });
    } catch (cause) {
      setToast({ type: "error", title: "Could not group by sections", message: sectionErrorMessage(cause) });
    } finally {
      setChangingGrouping(false);
    }
  };
  const refreshIssues = async () => {
    if (!("paginationOptions" in issues) || !issues.paginationOptions)
      throw new Error("Reload the view to refresh its work items.");
    await fetchIssues("mutation", issues.paginationOptions, entityId);
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-subtle bg-surface-1 px-4 py-2">
      {error ? (
        <p role="alert" className="text-13 text-danger-primary">
          Sections could not be loaded.{" "}
          <button type="button" onClick={() => void mutate()}>
            Retry
          </button>
        </p>
      ) : null}
      {canEdit && (
        <>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={mode === "create"}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-13 text-secondary hover:bg-layer-1-hover hover:text-primary"
            onClick={() => setMode("create")}
          >
            <AddOutline className="size-4" />
            Add section
          </button>
          <button type="button" className="text-13 text-secondary hover:text-primary" onClick={() => setMode("manage")}>
            Manage sections
          </button>
        </>
      )}
      {canGroup && (
        <button
          type="button"
          disabled={changingGrouping}
          className="text-13 text-secondary hover:text-primary"
          onClick={() => void groupBySections()}
        >
          Group by Sections
        </button>
      )}
      {canEdit && mode && (
        <SectionDialog
          key={`${workspaceSlug}:${projectId}`}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          mode={mode}
          onDeleted={refreshIssues}
          onCreated={async () => {
            if (canGroup) await groupBySections();
          }}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
});
