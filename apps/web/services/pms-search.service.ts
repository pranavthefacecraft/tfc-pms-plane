import { API_BASE_URL } from "@plane/constants";
import { APIService } from "./api.service";

export type TPMSSearchKind = "navigation" | "tasks" | "projects" | "people" | "documents" | "files";
export type TPMSSearchResult = {
  id: string;
  kind: TPMSSearchKind;
  name: string;
  detail: string;
  href: string;
  workspace_slug: string;
  workspace_name: string;
};
export type TPMSSearchResponse = {
  results: TPMSSearchResult[];
  has_more: boolean;
  next_offset: number | null;
};
class PMSSearchService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async search(search: string, category: TPMSSearchKind | "all", offset = 0): Promise<TPMSSearchResponse> {
    const response = await this.get("/api/search/pms/", { params: { search, category, offset, limit: 20 } });
    return response.data;
  }
}
export const pmsSearchService = new PMSSearchService();
