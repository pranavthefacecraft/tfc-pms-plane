/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type CommentMember = {
  id: string;
  display_name: string;
  first_name: string;
  avatar_url: string | null;
};
export type CommentAttachment = { id: string; name: string; size: number };
export type BoardComment = {
  id: string;
  body: string;
  author: CommentMember | null;
  created_at: string;
  mentions: string[];
  attachments: CommentAttachment[];
};
export type CommentThread = { id: string; x: number; y: number; resolved: boolean; comments: BoardComment[] };
export type CommentData = { threads: CommentThread[]; members: CommentMember[]; file_size_limit: number };
export type CommentInput = {
  body: string;
  mentions: string[];
  attachments: string[];
  x?: number;
  y?: number;
};

class WhiteboardCommentsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private path(slug: string, boardId: string) {
    return `/api/workspaces/${encodeURIComponent(slug)}/workspace-pages/${boardId}`;
  }

  async list(slug: string, boardId: string): Promise<CommentData> {
    return (await this.get(`${this.path(slug, boardId)}/threads/`)).data;
  }

  async comment(slug: string, boardId: string, input: CommentInput, threadId?: string): Promise<CommentThread> {
    return (await this.post(`${this.path(slug, boardId)}/threads/${threadId ? `${threadId}/` : ""}`, input)).data;
  }

  async resolve(slug: string, boardId: string, threadId: string, resolved: boolean): Promise<CommentThread> {
    return (await this.patch(`${this.path(slug, boardId)}/threads/${threadId}/`, { resolved })).data;
  }

  async upload(slug: string, boardId: string, file: File): Promise<CommentAttachment> {
    const data = new FormData();
    data.append("file", file);
    return (await this.post(`${this.path(slug, boardId)}/comment-attachments/`, data)).data;
  }
}

export const whiteboardComments = new WhiteboardCommentsService();
