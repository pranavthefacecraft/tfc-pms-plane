/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TProjectSection = {
  id: string;
  name: string;
  sort_order: number;
  icon?: string;
  icon_color?: string;
  is_default?: boolean;
};

export type TSectionAppearance = { icon: string; icon_color: string };

export class ProjectSectionService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private path(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/sections/`;
  }

  async list(workspaceSlug: string, projectId: string): Promise<TProjectSection[]> {
    const response = await this.get(this.path(workspaceSlug, projectId));
    return response.data;
  }

  async create(
    workspaceSlug: string,
    projectId: string,
    name: string,
    appearance?: TSectionAppearance
  ): Promise<TProjectSection> {
    const response = await this.post(this.path(workspaceSlug, projectId), { name, ...appearance });
    return response.data;
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    id: string,
    data: Partial<Pick<TProjectSection, "name" | "sort_order" | "icon" | "icon_color">>
  ): Promise<TProjectSection> {
    const response = await this.patch(`${this.path(workspaceSlug, projectId)}${id}/`, data);
    return response.data;
  }

  async remove(workspaceSlug: string, projectId: string, id: string): Promise<void> {
    await this.delete(`${this.path(workspaceSlug, projectId)}${id}/`);
  }
}
