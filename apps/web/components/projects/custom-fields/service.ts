/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isAxiosError } from "axios";
import useSWR from "swr";
import { API_BASE_URL } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import { APIService } from "@/services/api.service";

export const FIELD_TYPES = {
  single_select: "Single-select",
  multi_select: "Multi-select",
  text: "Text",
  number: "Number",
  date: "Date",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;
export type FieldOption = { id: string; name: string; color: string };
export type CustomField = {
  id: string;
  name: string;
  description: string;
  field_type: FieldType;
  options: FieldOption[];
  notify_collaborators: boolean;
};
export type FieldInput = Omit<CustomField, "id">;
export type FieldValue = string | number | string[] | null;
export type FieldValues = Record<string, FieldValue>;

export function fieldError(error: unknown) {
  console.error("Custom field request failed", error);
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
  setToast({
    type: "error",
    title: "Custom field could not be updated",
    message:
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "The request failed. Check your input and connection, then retry. Your draft has been retained.",
  });
}

class CustomFieldsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  private path(slug: string, projectId: string) {
    return `/api/workspaces/${encodeURIComponent(slug)}/projects/${projectId}`;
  }
  async list(slug: string, projectId: string): Promise<CustomField[]> {
    return (await this.get(`${this.path(slug, projectId)}/custom-fields/`)).data;
  }
  async save(slug: string, projectId: string, data: FieldInput, id?: string): Promise<CustomField> {
    const path = `${this.path(slug, projectId)}/custom-fields/`;
    return (await (id ? this.patch(`${path}${id}/`, data) : this.post(path, data))).data;
  }
  async remove(slug: string, projectId: string, id: string): Promise<void> {
    await this.delete(`${this.path(slug, projectId)}/custom-fields/${id}/`);
  }
  async values(slug: string, projectId: string, issueId: string): Promise<FieldValues> {
    return (await this.get(`${this.path(slug, projectId)}/issues/${issueId}/custom-field-values/`)).data;
  }
  async setValue(slug: string, projectId: string, issueId: string, fieldId: string, value: FieldValue) {
    await this.put(`${this.path(slug, projectId)}/issues/${issueId}/custom-field-values/`, {
      field_id: fieldId,
      value,
    });
  }
}
export const customFields = new CustomFieldsService();

export function useCustomFields(slug: string, projectId: string) {
  return useSWR(["project-custom-fields", slug, projectId], () => customFields.list(slug, projectId));
}
