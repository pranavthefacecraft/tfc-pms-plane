/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TIssuePriorities, TStateGroups } from "@plane/types";
import { APIService } from "@/services/api.service";

export type TProjectListTask = {
  id: string;
  name: string;
  sequence_id: number;
  priority: TIssuePriorities;
  start_date: string | null;
  target_date: string | null;
  state_id: string;
  state_group: TStateGroups;
  parent_id: string | null;
  section_id: string | null;
  comment_count: number;
  assignee_ids: string[];
};

export type TProjectTaskList = {
  project_identifier: string;
  completed_state_id: string | null;
  default_state_id: string | null;
  truncated: boolean;
  results: TProjectListTask[];
};

export const projectTaskListKey = (workspaceSlug: string, projectId: string) =>
  ["project-task-list", workspaceSlug, projectId] as const;

export class ProjectTaskListService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string): Promise<TProjectTaskList> {
    const response = await this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/task-list/`);
    return response.data;
  }
}
