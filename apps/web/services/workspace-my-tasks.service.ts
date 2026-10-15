/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TIssuePriorities, TStateGroups } from "@plane/types";
import { APIService } from "@/services/api.service";

export type TMyTasksTab = "upcoming" | "overdue" | "completed";

export type TMyTask = {
  id: string;
  name: string;
  sequence_id: number;
  project_id: string;
  project_identifier: string;
  priority: TIssuePriorities;
  target_date: string | null;
  completed_at: string | null;
  state_id: string;
  state_group: TStateGroups;
  state_name: string;
  state_color: string;
  completed_state_id: string | null;
  default_state_id: string | null;
};

export type TMyTasksResponse = {
  tab: TMyTasksTab;
  counts: Record<TMyTasksTab, number>;
  results: TMyTask[];
};

export type TMyTasksParams = {
  tab: TMyTasksTab;
  limit: number;
  today: string;
};

export class MyTasksService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, params: TMyTasksParams): Promise<TMyTasksResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/my-tasks/`, { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
