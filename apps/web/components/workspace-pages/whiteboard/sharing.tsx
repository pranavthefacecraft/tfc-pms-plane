/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import type { TWorkspacePageUser } from "@/services/page/workspace-page.service";

type Sharing = {
  access: number;
  members: { user: TWorkspacePageUser; role: string; explicit: boolean }[];
};
class SharingService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async list(url: string): Promise<Sharing> {
    return (await this.get(url)).data;
  }
  async change(url: string, user_id: string, role: string): Promise<Sharing> {
    return (await this.post(url, { user_id, role })).data;
  }
}
const service = new SharingService();

export function WhiteboardSharing({ workspaceSlug, boardId }: { workspaceSlug: string; boardId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const url = `/api/workspaces/${workspaceSlug}/workspace-pages/${boardId}/sharing/`;
  const { data, error, mutate } = useSWR(open ? url : null, () => service.list(url));
  return (
    <div className="relative">
      <Button size="sm" stretch="auto" variant="secondary" label="Share" onClick={() => setOpen((value) => !value)} />
      {open && (
        <div className="shadow-lg absolute top-full right-0 z-30 mt-1 w-80 rounded-lg border border-subtle bg-surface-1 p-3">
          <h3 className="text-14 font-semibold">Share with workspace members</h3>
          <p className="my-2 text-12 text-secondary">
            {data?.access === 0
              ? "Workspace-visible: members can edit unless assigned Viewer. Removing an override restores workspace access."
              : "Private: only the owner and explicitly shared members can open this board."}
          </p>
          {error && <p role="alert">Could not load sharing. Close and reopen to retry.</p>}
          {!data && !error && <p>Loading members...</p>}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {data?.members.map(({ user, role, explicit }) => (
              <label key={user.id} className="flex items-center justify-between gap-2 text-13">
                <span className="truncate">{user.display_name || user.first_name}</span>
                {role === "owner" ? (
                  <span>Owner</span>
                ) : (
                  <select
                    aria-label={`Access for ${user.display_name}`}
                    value={explicit ? role : "remove"}
                    disabled={saving}
                    className="rounded border border-subtle bg-surface-1 p-1"
                    onChange={async (event) => {
                      setSaving(true);
                      try {
                        await mutate(await service.change(url, user.id, event.target.value), false);
                      } catch (cause) {
                        console.error("Whiteboard sharing failed", cause);
                        setToast({
                          type: "error",
                          title: "Sharing failed",
                          message: "Could not change access. Please retry.",
                        });
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    <option value="remove">{data.access === 0 ? `Default (${role})` : "Not shared"}</option>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                )}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              stretch="auto"
              variant="primary"
              label="Copy board link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setToast({ type: "success", title: "Link copied" });
                } catch (cause) {
                  console.error(cause);
                  setToast({ type: "error", title: "Could not copy link" });
                }
              }}
            />
            <Button size="sm" stretch="auto" variant="secondary" label="Close" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
