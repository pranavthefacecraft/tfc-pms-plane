/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { DeleteOutline, GlobeOutline, LockOutline, PagesOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
// hooks
import { useUser } from "@/hooks/store/user";
// services
import type { TWorkspacePage, TWorkspacePageUser } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGE_ACCESS, WorkspacePageService } from "@/services/page/workspace-page.service";
// local imports
import {
  WORKSPACE_PAGES_SWR_KEY,
  getAttachmentHref,
  getAttachmentLabel,
  getWorkspacePageHref,
  getWorkspacePageName,
} from "./helpers";
import { useCreateWorkspacePage } from "./use-create-page";

const workspacePageService = new WorkspacePageService();

type Props = {
  workspaceSlug: string;
};

const UserCell = ({ user }: { user: TWorkspacePageUser | null }) => {
  if (!user) return <span className="text-placeholder">—</span>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar
        size="sm"
        alt={user.display_name}
        fallback={user.display_name?.[0]?.toUpperCase()}
        src={user.avatar_url ? getFileURL(user.avatar_url) : undefined}
      />
      <span className="truncate">{user.display_name}</span>
    </div>
  );
};

export const WorkspacePagesListRoot = observer(function WorkspacePagesListRoot({ workspaceSlug }: Props) {
  // states
  const [search, setSearch] = useState("");
  // store hooks
  const { data: currentUser } = useUser();
  const { createPage, isCreating } = useCreateWorkspacePage(workspaceSlug);
  // fetch
  const {
    data: pages,
    isLoading,
    mutate,
  } = useSWR(
    workspaceSlug ? WORKSPACE_PAGES_SWR_KEY(workspaceSlug) : null,
    workspaceSlug ? () => workspacePageService.list(workspaceSlug) : null,
    { revalidateOnFocus: false }
  );

  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pages ?? [];
    return (pages ?? []).filter((page) => getWorkspacePageName(page).toLowerCase().includes(query));
  }, [pages, search]);

  const handleDelete = async (page: TWorkspacePage) => {
    if (!window.confirm(`Delete "${getWorkspacePageName(page)}"? This cannot be undone.`)) return;
    try {
      await workspacePageService.destroy(workspaceSlug, page.id);
      await mutate((current) => current?.filter((item) => item.id !== page.id), { revalidate: false });
      setToast({ type: "success", title: "Page deleted", message: "The page was deleted." });
    } catch (error: unknown) {
      const message = (error as { error?: string } | undefined)?.error ?? "Could not delete the page.";
      setToast({ type: "error", title: "Error", message });
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-hidden px-page-x py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="w-full max-w-xs">
          <InputGroup size="lg">
            <Input
              size="lg"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pages"
              aria-label="Search pages"
            />
          </InputGroup>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-md border border-subtle">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-13">
          <thead className="sticky top-0 z-[1] bg-layer-1">
            <tr className="text-left text-12 font-medium text-tertiary">
              <th className="w-[30%] px-4 py-2 font-medium">Name</th>
              <th className="w-[15%] px-4 py-2 font-medium">Created by</th>
              <th className="w-[20%] px-4 py-2 font-medium">Attached to</th>
              <th className="w-[13%] px-4 py-2 font-medium">Last modified</th>
              <th className="w-[10%] px-4 py-2 font-medium">Access</th>
              <th className="w-[12%] px-4 py-2 font-medium">Members</th>
              <th className="w-12 px-2 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-placeholder">
                  Loading pages...
                </td>
              </tr>
            )}
            {!isLoading && filteredPages.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <PagesOutline className="size-8 text-placeholder" />
                    <p className="text-14 font-medium text-primary">
                      {search ? "No pages match your search" : "No pages yet"}
                    </p>
                    {!search && (
                      <>
                        <p className="max-w-sm text-13 text-tertiary">
                          Create a page to write docs, specs or notes, then attach it to a task or project.
                        </p>
                        <Button
                          variant="primary"
                          size="md"
                          stretch="auto"
                          label="Create page"
                          loading={isCreating}
                          onClick={() => void createPage()}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {filteredPages.map((page) => {
              const attachmentLabel = getAttachmentLabel(page.attachment);
              const attachmentHref = getAttachmentHref(workspaceSlug, page.attachment);
              const isPrivate = page.access === WORKSPACE_PAGE_ACCESS.PRIVATE;
              const canDelete = page.owned_by === currentUser?.id;
              return (
                <tr key={page.id} className="group border-t border-subtle hover:bg-layer-1-hover">
                  <td className="px-4 py-2.5">
                    <Link
                      href={getWorkspacePageHref(workspaceSlug, page.id)}
                      className="flex min-w-0 items-center gap-2 font-medium text-primary"
                    >
                      <PagesOutline className="size-4 flex-shrink-0 text-tertiary" />
                      <span className="truncate">{getWorkspacePageName(page)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-secondary">
                    <UserCell user={page.owner} />
                  </td>
                  <td className="px-4 py-2.5 text-secondary">
                    {!attachmentLabel ? (
                      <span className="text-placeholder">—</span>
                    ) : attachmentHref ? (
                      <Link href={attachmentHref} className="block truncate hover:underline">
                        {attachmentLabel}
                      </Link>
                    ) : (
                      <span className="block truncate text-placeholder">{attachmentLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-secondary">{calculateTimeAgo(page.updated_at)}</td>
                  <td className="px-4 py-2.5 text-secondary">
                    <span className="flex items-center gap-1.5">
                      {isPrivate ? <LockOutline className="size-3.5" /> : <GlobeOutline className="size-3.5" />}
                      {isPrivate ? "Private" : "Public"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-secondary">
                    {isPrivate ? <UserCell user={page.owner} /> : <span>Workspace</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(page)}
                        className="rounded p-1 text-tertiary opacity-0 group-hover:opacity-100 hover:bg-layer-1 hover:text-danger-primary focus:opacity-100"
                        aria-label={`Delete ${getWorkspacePageName(page)}`}
                      >
                        <DeleteOutline className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
