import { API_BASE_URL } from "@plane/constants";
import { APIService } from "./api.service";

export type TRecording = {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  size: number;
  duration_ms: number;
  content_type: string;
  ready: boolean;
  created_at: string;
  viewer_ids: string[];
  shared: boolean;
};
export type TRecordingList = {
  results: TRecording[];
  next_offset: number | null;
  limits: { max_size: number; max_duration_ms: number; part_size: number };
};
export type TRecordingUpload = { id: string; part_size: number; next: number };
class RecordingService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  private path(slug: string, id?: string) {
    return `/api/workspaces/${slug}/recordings/${id ? `${id}/` : ""}`;
  }
  async list(slug: string, offset = 0, query = ""): Promise<TRecordingList> {
    return (await this.get(this.path(slug), { params: { offset, query } })).data;
  }
  async detail(slug: string, id: string): Promise<TRecording> {
    return (await this.get(this.path(slug, id))).data;
  }
  async startUpload(
    slug: string,
    name: string,
    blob: Blob,
    durationMs: number
  ): Promise<{ id: string; part_size: number }> {
    return (
      await this.post(this.path(slug), {
        name,
        size: blob.size,
        content_type: blob.type.split(";")[0],
        duration_ms: Math.max(1, Math.round(durationMs)),
      })
    ).data;
  }
  async uploadPart(slug: string, id: string, part: number, blob: Blob) {
    await this.put(`${this.path(slug, id)}parts/${part}/`, blob, {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="part.bin"' },
    });
  }
  uploadRemainingParts(
    slug: string,
    upload: TRecordingUpload,
    blob: Blob,
    paused: () => boolean,
    progress: (percent: number) => void
  ): Promise<boolean> {
    const count = Math.ceil(blob.size / upload.part_size);
    const parts = Array.from({ length: Math.max(0, count - upload.next + 1) }, (_, index) => upload.next + index);
    // Chain raw uploads sequentially to bound memory and support pauses between parts.
    return parts.reduce(
      (previous, part) =>
        previous.then(async (continuing) => {
          if (!continuing || paused()) return false;
          const start = (part - 1) * upload.part_size;
          await this.uploadPart(slug, upload.id, part, blob.slice(start, start + upload.part_size));
          upload.next = part + 1;
          progress(Math.round((part / count) * 100));
          return true;
        }),
      Promise.resolve(true)
    );
  }
  async complete(slug: string, id: string): Promise<TRecording> {
    return (await this.post(`${this.path(slug, id)}complete/`)).data;
  }
  async remove(slug: string, id: string) {
    await this.delete(this.path(slug, id));
  }
  async share(slug: string, id: string, userIds: string[]): Promise<TRecording> {
    return (await this.put(`${this.path(slug, id)}share/`, { user_ids: userIds })).data;
  }
  async attach(slug: string, id: string, issueId: string) {
    await this.post(`${this.path(slug, id)}attach/`, { issue_id: issueId });
  }
  playback(slug: string, id: string) {
    return `${this.baseURL}${this.path(slug, id)}playback/`;
  }
}
export const recordingService = new RecordingService();
