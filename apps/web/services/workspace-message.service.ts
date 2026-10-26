import { API_BASE_URL } from "@plane/constants";
import type { IUserLite } from "@plane/types";
import { APIService } from "./api.service";

export type TMessagePayload = {
  id: string;
  subject: string;
  body: string;
  recipients: string[];
};

export type TWorkspaceMessage = {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  sender: IUserLite;
  recipients: IUserLite[];
};

class WorkspaceMessageService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async send(workspaceSlug: string, payload: TMessagePayload): Promise<TWorkspaceMessage> {
    return (await this.post(`/api/workspaces/${workspaceSlug}/messages/`, payload)).data;
  }

  async retrieve(workspaceSlug: string, id: string): Promise<TWorkspaceMessage> {
    return (await this.get(`/api/workspaces/${workspaceSlug}/messages/${id}/`)).data;
  }
}

export const workspaceMessageService = new WorkspaceMessageService();
