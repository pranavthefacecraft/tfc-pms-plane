import { isAxiosError } from "axios";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TPersonalTask = {
  id: string;
  name: string;
  description: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type TPersonalTaskData = Pick<
  TPersonalTask,
  "name" | "description" | "priority" | "start_date" | "target_date"
> & {
  is_completed?: boolean;
};
export const personalTasksKey = (slug: string, userId: string) => ["personal-tasks", slug, userId];
export type TSharedPersonalTask = Pick<
  TPersonalTask,
  "name" | "description" | "priority" | "start_date" | "target_date" | "completed_at"
>;

export function personalTaskError(
  error: unknown,
  fallback = "Could not save your personal task. Please try again."
): string {
  if (isAxiosError(error) && error.response?.data) {
    const data: unknown = error.response.data;
    if (typeof data === "object" && data !== null) {
      return Object.entries(data)
        .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
        .join("; ");
    }
  }
  return fallback;
}

class PersonalTaskService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async list(slug: string): Promise<TPersonalTask[]> {
    const response = await this.get(`/api/workspaces/${slug}/personal-tasks/`);
    return response.data;
  }
  async shareStatus(slug: string, id: string): Promise<{ token: string | null }> {
    return (await this.get(`/api/workspaces/${slug}/personal-tasks/${id}/share/`)).data;
  }
  async share(slug: string, id: string): Promise<{ token: string }> {
    return (await this.post(`/api/workspaces/${slug}/personal-tasks/${id}/share/`, {})).data;
  }
  async revokeShare(slug: string, id: string): Promise<void> {
    await this.delete(`/api/workspaces/${slug}/personal-tasks/${id}/share/`);
  }
  async shared(token: string): Promise<TSharedPersonalTask> {
    return (await this.get(`/api/shared/personal-tasks/${token}/`)).data;
  }
  async create(slug: string, data: TPersonalTaskData): Promise<TPersonalTask> {
    const response = await this.post(`/api/workspaces/${slug}/personal-tasks/`, data);
    return response.data;
  }
  async update(slug: string, id: string, data: Partial<TPersonalTaskData>): Promise<TPersonalTask> {
    const response = await this.patch(`/api/workspaces/${slug}/personal-tasks/${id}/`, data);
    return response.data;
  }
  async remove(slug: string, id: string): Promise<void> {
    await this.delete(`/api/workspaces/${slug}/personal-tasks/${id}/`);
  }
  async move(slug: string, id: string, projectId: string): Promise<{ id: string; project_id: string; name: string }> {
    const response = await this.post(`/api/workspaces/${slug}/personal-tasks/${id}/move/`, { project_id: projectId });
    return response.data;
  }
}
export const personalTaskService = new PersonalTaskService();
