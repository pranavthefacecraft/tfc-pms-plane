/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TCollaboratorInvite = { email: string; role: number };
export type TCollaboratorInviteResult = { added: string[]; invited: string[] };

/** Adds teammates by email: workspace members join the project now, others get a workspace invitation first. */
export class ProjectCollaboratorsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async invite(
    workspaceSlug: string,
    projectId: string,
    invites: TCollaboratorInvite[]
  ): Promise<TCollaboratorInviteResult> {
    const response = await this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/collaborator-invites/`, {
      invites,
    });
    return response.data;
  }
}
