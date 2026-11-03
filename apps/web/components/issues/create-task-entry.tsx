/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { NewTaskPanel } from "@/components/profile/new-task-panel";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { taskPanelDefaults, usesTaskPanel } from "./create-task-entry.helpers";
import { CreateUpdateIssueModal } from "./issue-modal/modal";
import type { IssuesModalProps } from "./issue-modal/modal";

/** SWR lists on the custom task pages that should show a task created from anywhere. */
const TASK_LIST_KEYS = new Set(["personal-tasks", "activity-schedule", "my-tasks-list", "project-task-list"]);

/**
 * Create work item entry point: opens the New Task side form, falling back to the full popup
 * for drafts, edits and cycle, module, epic or sub-item creation.
 */
export const CreateTaskEntry = observer(function CreateTaskEntry(props: IssuesModalProps) {
  const { workspaceSlug, projectId, cycleId, moduleId } = useParams();
  const routeStoreType = useIssueStoreType();
  const storeType = props.storeType ?? routeStoreType;
  const { createIssue } = useIssuesActions(storeType);
  const { mutate } = useSWRConfig();
  const slug = workspaceSlug?.toString();

  if (!props.isOpen) return null;
  const panel =
    slug &&
    usesTaskPanel({
      data: props.data,
      storeType,
      isDraft: props.isDraft,
      inCycleOrModule: Boolean(cycleId || moduleId),
    });
  if (!panel) return <CreateUpdateIssueModal {...props} />;

  return (
    <NewTaskPanel
      workspaceSlug={slug}
      defaults={taskPanelDefaults(props.data, projectId?.toString())}
      projectLocked={props.isProjectSelectionDisabled}
      allowedProjectIds={props.allowedProjectIds}
      createIssue={createIssue}
      onClose={props.onClose}
      onSaved={(_task, issue) => {
        void mutate((key) => Array.isArray(key) && TASK_LIST_KEYS.has(String(key[0])) && key[1] === slug);
        if (issue) void props.onSubmit?.(issue);
      }}
    />
  );
});
