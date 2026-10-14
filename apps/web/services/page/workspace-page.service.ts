/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TWorkspacePageEntityType = "project" | "issue";

export type TWorkspacePageUser = {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

export type TWorkspacePageAttachment = {
  entity_type: TWorkspacePageEntityType;
  project_id: string;
  issue_id: string | null;
  is_accessible: boolean;
  project_name?: string;
  project_identifier?: string;
  issue_name?: string;
  issue_sequence_id?: number;
};

export type TWorkspacePage = {
  id: string;
  name: string;
  access: 0 | 1;
  logo_props: Record<string, unknown>;
  owned_by: string;
  owner: TWorkspacePageUser | null;
  updated_by: TWorkspacePageUser | null;
  workspace: string;
  created_at: string;
  updated_at: string;
  attachment: TWorkspacePageAttachment | null;
  description_html?: string;
};

export type TWorkspacePageListParams = {
  query?: string;
  issue_id?: string;
  project_id?: string;
};

export const WORKSPACE_PAGE_ACCESS = {
  PUBLIC: 0,
  PRIVATE: 1,
} as const;

export class WorkspacePageService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private baseUrl(workspaceSlug: string) {
    return `/api/workspaces/${workspaceSlug}/workspace-pages/`;
  }

  async list(workspaceSlug: string, params: TWorkspacePageListParams = {}): Promise<TWorkspacePage[]> {
    return this.get(this.baseUrl(workspaceSlug), { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async retrieve(workspaceSlug: string, pageId: string): Promise<TWorkspacePage> {
    return this.get(`${this.baseUrl(workspaceSlug)}${pageId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(
    workspaceSlug: string,
    data: Partial<Pick<TWorkspacePage, "name" | "access" | "description_html">>
  ): Promise<TWorkspacePage> {
    return this.post(this.baseUrl(workspaceSlug), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    pageId: string,
    data: Partial<Pick<TWorkspacePage, "name" | "access" | "description_html" | "logo_props">>
  ): Promise<TWorkspacePage> {
    return this.patch(`${this.baseUrl(workspaceSlug)}${pageId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async destroy(workspaceSlug: string, pageId: string): Promise<void> {
    return this.delete(`${this.baseUrl(workspaceSlug)}${pageId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async attach(
    workspaceSlug: string,
    pageId: string,
    data: { entity_type: TWorkspacePageEntityType; entity_id: string }
  ): Promise<TWorkspacePage> {
    return this.put(`${this.baseUrl(workspaceSlug)}${pageId}/attachment/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async detach(workspaceSlug: string, pageId: string): Promise<void> {
    return this.delete(`${this.baseUrl(workspaceSlug)}${pageId}/attachment/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
