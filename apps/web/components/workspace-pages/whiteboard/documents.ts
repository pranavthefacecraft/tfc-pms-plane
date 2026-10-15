/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

import type { WhiteboardDocument } from "./documents.helpers";
import { isWhiteboardDocument } from "./documents.helpers";
export { isWhiteboardDocument, safeTextLink } from "./documents.helpers";
export type { WhiteboardDocument } from "./documents.helpers";

export function documentPath(workspaceSlug: string, boardId: string, assetId?: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/workspace-pages/${boardId}/documents/${assetId ? `${assetId}/` : ""}`;
}

class WhiteboardDocumentService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async upload(workspaceSlug: string, boardId: string, file: File): Promise<WhiteboardDocument> {
    const data = new FormData();
    data.append("file", file);
    const response = await this.post(documentPath(workspaceSlug, boardId), data);
    if (!isWhiteboardDocument(response.data)) throw new Error("Invalid document upload response");
    return response.data;
  }

  async load(workspaceSlug: string, boardId: string, document: WhiteboardDocument): Promise<Blob> {
    const response = await this.get(documentPath(workspaceSlug, boardId, document.id), { responseType: "blob" });
    return response.data;
  }
}

export const documentService = new WhiteboardDocumentService();
