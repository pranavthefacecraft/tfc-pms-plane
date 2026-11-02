/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import type { TMyTaskFile } from "@/services/workspace-my-tasks.service";

/** A project file: task attachments/links carry their work item, files attached to the project itself do not. */
export type TProjectFile = Omit<TMyTaskFile, "issue_id" | "issue_name" | "sequence_id" | "state_group"> & {
  issue_id: string | null;
  issue_name: string | null;
  sequence_id: number | null;
  state_group: TMyTaskFile["state_group"] | null;
};

export class ProjectFilesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string): Promise<TProjectFile[]> {
    const response = await this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/files/`);
    return response.data;
  }
}
