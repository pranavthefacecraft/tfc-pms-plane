/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { useNavigate } from "react-router";
import { BarOutline, FilterOutline, PreferencesOutline } from "@makeplane/propel/icons";
// plane imports
import { EIssueFilterType, ISSUE_STORE_TO_FILTERS_MAP } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/elements/button";
import { setToast } from "@plane/blocks/toast";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
// plane web imports
import type { TProject } from "@plane/types";
// local imports
import { WorkItemsModal } from "../analytics/work-items/modal";
import { WorkItemFiltersToggle } from "../work-item-filters/filters-toggle";
import {
  DisplayFiltersSelection,
  FiltersDropdown,
  LayoutSelection,
  MobileLayoutSelection,
} from "./issue-layouts/filters";

type Props = {
  currentProjectDetails: TProject | undefined;
  projectId: string;
  workspaceSlug: string;
  canUserCreateIssue: boolean | undefined;
  storeType?: EIssuesStoreType.PROJECT | EIssuesStoreType.EPIC;
  navigateToIssues?: boolean;
  compact?: boolean;
};
const LAYOUTS = [
  EIssueLayoutTypes.LIST,
  EIssueLayoutTypes.KANBAN,
  EIssueLayoutTypes.CALENDAR,
  EIssueLayoutTypes.SPREADSHEET,
  EIssueLayoutTypes.GANTT,
];

export const HeaderFilters = observer(function HeaderFilters(props: Props) {
  const {
    currentProjectDetails,
    projectId,
    workspaceSlug,
    canUserCreateIssue,
    storeType = EIssuesStoreType.PROJECT,
    navigateToIssues = false,
    compact = false,
  } = props;
  // i18n
  const { t } = useTranslation();
  // states
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const navigate = useNavigate();
  // store hooks
  const { issuesFilter } = useIssues(storeType);
  const { issueFilters, updateFilters, fetchFilters } = issuesFilter;
  // derived values
  const activeLayout = issueFilters?.displayFilters?.layout;
  const layoutDisplayFiltersOptions = ISSUE_STORE_TO_FILTERS_MAP[storeType]?.layoutOptions[activeLayout];

  const handleLayoutChange = useCallback(
    async (layout: EIssueLayoutTypes) => {
      if (!workspaceSlug || !projectId) return;
      if (!navigateToIssues) {
        updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout: layout });
        return;
      }
      try {
        // Direct Overview visits have not initialized the Work items filters yet.
        if (!issuesFilter.getIssueFilters(projectId)) await fetchFilters(workspaceSlug, projectId);
        await updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, { layout });
        navigate(`/${workspaceSlug}/projects/${projectId}/issues`);
      } catch (error) {
        console.error("Could not open the selected work item layout", error);
        setToast({ type: "error", title: "Could not open work items", message: "Please try again." });
      }
    },
    [workspaceSlug, projectId, updateFilters, navigateToIssues, issuesFilter, fetchFilters, navigate]
  );

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  const handleDisplayProperties = useCallback(
    (property: Partial<IIssueDisplayProperties>) => {
      if (!workspaceSlug || !projectId) return;
      updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_PROPERTIES, property);
    },
    [workspaceSlug, projectId, updateFilters]
  );

  return (
    <>
      <WorkItemsModal
        isOpen={analyticsModal}
        onClose={() => setAnalyticsModal(false)}
        projectDetails={currentProjectDetails ?? undefined}
        isEpic={storeType === EIssuesStoreType.EPIC}
      />
      <div className="hidden @4xl:flex">
        <LayoutSelection
          layouts={LAYOUTS}
          onChange={(layout) => handleLayoutChange(layout)}
          selectedLayout={activeLayout}
        />
      </div>
      <div className="flex @4xl:hidden">
        <MobileLayoutSelection
          layouts={LAYOUTS}
          onChange={(layout) => handleLayoutChange(layout)}
          activeLayout={activeLayout}
        />
      </div>
      {navigateToIssues ? (
        <>
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            aria-label={t("common.filters")}
            onClick={() => navigate(`/${workspaceSlug}/projects/${projectId}/issues`)}
          >
            <FilterOutline className="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            onClick={() => navigate(`/${workspaceSlug}/projects/${projectId}/issues`)}
          >
            <PreferencesOutline className="size-3.5" />
            {t("common.display")}
          </Button>
        </>
      ) : (
        <>
          <WorkItemFiltersToggle entityType={storeType} entityId={projectId} />
          <FiltersDropdown
            miniIcon={<PreferencesOutline className="size-3.5" />}
            title={t("common.display")}
            placement="bottom-end"
          >
            <DisplayFiltersSelection
              layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
              displayFilters={issueFilters?.displayFilters ?? {}}
              handleDisplayFiltersUpdate={handleDisplayFilters}
              displayProperties={issueFilters?.displayProperties ?? {}}
              handleDisplayPropertiesUpdate={handleDisplayProperties}
              cycleViewDisabled={!currentProjectDetails?.cycle_view}
              moduleViewDisabled={!currentProjectDetails?.module_view}
              isEpic={storeType === EIssuesStoreType.EPIC}
            />
          </FiltersDropdown>
        </>
      )}
      {canUserCreateIssue ? (
        <div className={compact ? "flex" : "hidden md:flex"}>
          <Button
            type="button"
            variant="secondary"
            size="md"
            stretch="auto"
            aria-label={t("common.analytics")}
            onClick={() => setAnalyticsModal(true)}
          >
            <span className="hidden @4xl:flex">{t("common.analytics")}</span>
            <span className="flex @4xl:hidden">
              <BarOutline className="size-3.5" />
            </span>
          </Button>
        </div>
      ) : (
        <></>
      )}
    </>
  );
});
