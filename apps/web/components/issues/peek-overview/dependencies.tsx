/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Plus } from "lucide-react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { EIssueServiceType } from "@plane/types";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { IssueRelationSelect } from "../issue-detail/relation-select";
import { RelationActionButton } from "../issue-detail-widgets/relations/quick-action-button";

const dependencyTypes = ["blocked_by", "blocking"] as const;

export const PeekOverviewDependencies = observer(function PeekOverviewDependencies(props: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const {
    relation: { getRelationByIssueIdRelationType },
  } = useIssueDetail();
  const count = getRelationByIssueIdRelationType(props.issueId, "blocked_by")?.length ?? 0;
  const hasBlocking = !!getRelationByIssueIdRelationType(props.issueId, "blocking")?.length;

  return (
    <SidebarPropertyListItem
      appearance="task-detail"
      label={t("common.dependencies")}
      childrenClassName="min-w-0 flex-col items-stretch gap-1.5 py-1"
    >
      {count > 0 && (
        <p className="text-13 text-tertiary">
          Waiting for {count} linked {count === 1 ? "task" : "tasks"}
        </p>
      )}
      {dependencyTypes.map((relationKey) => (
        <IssueRelationSelect
          key={relationKey}
          {...props}
          relationKey={relationKey}
          renderModal={false}
          presentation="dependency"
        />
      ))}
      {!props.disabled ? (
        <RelationActionButton
          issueId={props.issueId}
          issueServiceType={EIssueServiceType.ISSUES}
          relationTypes={dependencyTypes}
          customButton={
            <button
              type="button"
              className="inline-flex w-fit items-center gap-1 text-13 text-accent-primary hover:underline"
            >
              <Plus aria-hidden="true" className="size-3.5" /> Add dependency
            </button>
          }
        />
      ) : !count && !hasBlocking ? (
        <span className="text-13 text-tertiary">{t("common.none")}</span>
      ) : null}
    </SidebarPropertyListItem>
  );
});
