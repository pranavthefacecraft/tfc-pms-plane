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
export type TMyTaskListItem = TMyTask & {
  project_name: string;
  assignee_ids: string[];
  section_id: string | null;
  section_name: string | null;
};

export type TMyTasksParams = {
  tab: TMyTasksTab;
  limit: number;
  today: string;
};

export type TScheduledProjectTask = Pick<
  TMyTask,
  "id" | "name" | "project_id" | "project_identifier" | "sequence_id" | "target_date" | "completed_at" | "state_group"
> & { start_date: string | null; project_name: string; assignee_ids: string[]; created_by: string | null };

export class MyTasksService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async all(workspaceSlug: string): Promise<TMyTaskListItem[]> {
    const tasks: TMyTaskListItem[] = [];
    let count: number;
    do {
      // oxlint-disable-next-line no-await-in-loop -- Each offset depends on the preceding page.
      const response = await this.get(`/api/workspaces/${workspaceSlug}/my-tasks/`, {
        params: { view: "list", limit: 100, offset: tasks.length },
      });
      const page: { count: number; results: TMyTaskListItem[] } = response.data;
      tasks.push(...page.results);
      count = page.count;
      if (!page.results.length && tasks.length < count)
        throw new Error("Task list changed while loading. Please retry.");
    } while (tasks.length < count);
    return Array.from(new Map(tasks.map((task) => [task.id, task])).values());
  }

  async schedule(workspaceSlug: string, start: string, end: string): Promise<{ results: TScheduledProjectTask[] }> {
    const response = await this.get(`/api/workspaces/${workspaceSlug}/my-tasks/`, {
      params: { view: "schedule", start, end },
    });
    return response.data;
  }

  async list(workspaceSlug: string, params: TMyTasksParams): Promise<TMyTasksResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/my-tasks/`, { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
