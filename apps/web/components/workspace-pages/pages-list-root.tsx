/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { format, isToday, isYesterday } from "date-fns";
import { MoreHorizontal, Plus, Search } from "lucide-react";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { DeleteOutline, GlobeOutline, LockOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
// services
import type { TWorkspacePage, TWorkspacePageUser, TWorkspaceToolType } from "@/services/page/workspace-page.service";
import { WORKSPACE_PAGE_ACCESS, WorkspacePageService } from "@/services/page/workspace-page.service";
// local imports
import {
  TOOL_TYPE_LABELS,
  WORKSPACE_PAGES_SWR_KEY,
  WORKSPACE_PAGE_DETAIL_SWR_KEY,
  getAttachmentHref,
  getAttachmentLabel,
  getToolTypeIcon,
  getWorkspacePageHref,
  getWorkspacePageName,
} from "./helpers";
import { useCreateWorkspacePage } from "./use-create-page";
import { AttachWorkspacePageModal } from "./attach-page-modal";

const workspacePageService = new WorkspacePageService();

const listStyles = {
  page: {
    root: "gap-6 p-4 md:p-7",
    search: "w-full",
    tableWrapper: "min-h-0 overflow-auto border border-subtle",
    table: "min-w-[700px]",
    header: "bg-surface-1",
  },
  whiteboard: {
    root: "gap-4 px-page-x py-5",
    search: "w-full max-w-xs",
    tableWrapper: "flex-1 overflow-auto rounded-md border border-subtle",
    table: "min-w-[860px]",
    header: "bg-layer-1",
  },
};

type Props = {
  workspaceSlug: string;
  toolType?: TWorkspaceToolType;
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

export function notepadUpdatedLabel(value: string): string {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, date.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
}

export function notepadCollaborators(page: TWorkspacePage): string {
  return [
    ...new Map(
      [page.owner, ...(page.collaborators ?? [])].filter((user) => user !== null).map((user) => [user.id, user])
    ).values(),
  ]
    .map((user) => user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" "))
    .join(", ");
}

function NotepadRow({
  page,
  workspaceSlug,
  canDelete,
  onDelete,
  canAttach,
  onAttached,
}: {
  page: TWorkspacePage;
  workspaceSlug: string;
  canDelete: boolean;
  onDelete: (page: TWorkspacePage) => Promise<void>;
  canAttach: boolean;
  onAttached: (page: TWorkspacePage) => Promise<void>;
}) {
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const attachment = page.attachment;
  const attachmentLabel = getAttachmentLabel(attachment);
  const attachmentHref = getAttachmentHref(workspaceSlug, attachment);
  const projectLabel = attachment
    ? attachment.is_accessible
      ? attachment.project_name || "Attached project"
      : "Restricted project"
    : "—";
  const projectHref = attachment?.is_accessible
    ? `/${workspaceSlug}/projects/${attachment.project_id}/overview`
    : undefined;
  const href = getWorkspacePageHref(workspaceSlug, page.id);
  return (
    <tr className="border-t border-subtle hover:bg-layer-1-hover">
      <td className="px-4 py-6">
        <Link href={href} className="block truncate font-medium text-primary hover:underline">
          {getWorkspacePageName(page)}
        </Link>
      </td>
      <td className="px-4 py-6 text-secondary">
        {projectHref ? (
          <Link href={projectHref} className="block truncate hover:underline">
            {projectLabel}
          </Link>
        ) : (
          <span className="block truncate">{projectLabel}</span>
        )}
      </td>
      <td className="px-4 py-6 text-secondary">
        <span className="block truncate" title="Owner and most recent editor">
          {notepadCollaborators(page) || "—"}
        </span>
      </td>
      <td className="px-4 py-6 text-secondary">
        <time dateTime={page.updated_at} title={page.updated_at}>
          {notepadUpdatedLabel(page.updated_at)}
        </time>
      </td>
      <td className="px-2 py-6">
        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                aria-label={`Actions for ${getWorkspacePageName(page)}`}
                className="rounded p-1 text-secondary hover:bg-layer-1"
              >
                <MoreHorizontal size={16} />
              </button>
            }
          />
          <MenuContent align="end">
            <MenuItem label="Open notepad" render={<Link href={href} />} />
            {canAttach && <MenuItem label="Link to task or project" onClick={() => setIsAttachOpen(true)} />}
            <div className="px-3 py-2 text-12 text-secondary">
              {page.access === WORKSPACE_PAGE_ACCESS.PRIVATE ? "Private · Owner only" : "Public · Workspace access"}
            </div>
            {attachmentLabel && (
              <div className="max-w-64 px-3 py-2 text-12 text-secondary">
                {attachmentHref ? (
                  <Link href={attachmentHref} className="hover:underline">
                    {attachmentLabel}
                  </Link>
                ) : (
                  attachmentLabel
                )}
              </div>
            )}
            {canDelete && <MenuItem label="Delete notepad" onClick={() => void onDelete(page)} />}
          </MenuContent>
        </Menu>
        {isAttachOpen && canAttach && (
          <AttachWorkspacePageModal
            key={`${workspaceSlug}:${page.id}`}
            isOpen={isAttachOpen}
            onClose={() => setIsAttachOpen(false)}
            workspaceSlug={workspaceSlug}
            page={page}
            onAttached={onAttached}
          />
        )}
      </td>
    </tr>
  );
}

function WhiteboardRow({
  page,
  workspaceSlug,
  canDelete,
  onDelete,
}: {
  page: TWorkspacePage;
  workspaceSlug: string;
  canDelete: boolean;
  onDelete: (page: TWorkspacePage) => Promise<void>;
}) {
  const attachmentLabel = getAttachmentLabel(page.attachment);
  const attachmentHref = getAttachmentHref(workspaceSlug, page.attachment);
  const isPrivate = page.access === WORKSPACE_PAGE_ACCESS.PRIVATE;
  const ToolIcon = getToolTypeIcon("whiteboard");
  return (
    <tr className="group border-t border-subtle hover:bg-layer-1-hover">
      <td className="px-4 py-2.5">
        <Link
          href={getWorkspacePageHref(workspaceSlug, page.id, "whiteboard")}
          className="flex min-w-0 items-center gap-2 font-medium text-primary"
        >
          <ToolIcon className="size-4 flex-shrink-0 text-tertiary" />
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
            onClick={() => void onDelete(page)}
            className="rounded p-1 text-tertiary opacity-0 group-hover:opacity-100 hover:bg-layer-1 hover:text-danger-primary focus:opacity-100"
            aria-label={`Delete ${getWorkspacePageName(page)}`}
          >
            <DeleteOutline className="size-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

function EmptyPagesRow({
  toolType,
  search,
  isCreating,
  onCreate,
}: {
  toolType: TWorkspaceToolType;
  search: string;
  isCreating: boolean;
  onCreate: () => Promise<void>;
}) {
  const isNotepad = toolType === "page";
  const plural = isNotepad ? "notepads" : "whiteboards";
  const ToolIcon = getToolTypeIcon(toolType);
  return (
    <tr>
      <td colSpan={isNotepad ? 5 : 7} className="px-4 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <ToolIcon className="size-8 text-placeholder" />
          <p className="text-14 font-medium text-primary">
            {search ? `No ${plural} match your search` : `No ${plural} yet`}
          </p>
          {!search && (
            <>
              <p className="max-w-sm text-13 text-tertiary">
                {isNotepad
                  ? "Create a notepad to write docs, specs or notes, then attach it to a task or project."
                  : "Create a whiteboard to sketch ideas, diagrams or flows, then attach it to a task or project."}
              </p>
              <Button
                variant="primary"
                size="md"
                stretch="auto"
                label={isNotepad ? "Create notepad" : "Create whiteboard"}
                loading={isCreating}
                onClick={() => void onCreate()}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export const WorkspacePagesListRoot = observer(function WorkspacePagesListRoot({
  workspaceSlug,
  toolType = "page",
}: Props) {
  const labels = TOOL_TYPE_LABELS[toolType];
  const styles = listStyles[toolType];
  const isNotepad = toolType === "page";
  const plural = isNotepad ? "Notepads" : labels.plural;
  const columnCount = isNotepad ? 5 : 7;
  // states
  const [search, setSearch] = useState("");
  // store hooks
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const canAttach = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const { createPage, isCreating } = useCreateWorkspacePage(workspaceSlug, toolType);
  // fetch
  const {
    data: pages,
    isLoading,
    error,
    mutate,
  } = useSWR(
    workspaceSlug ? WORKSPACE_PAGES_SWR_KEY(workspaceSlug, toolType) : null,
    workspaceSlug ? () => workspacePageService.list(workspaceSlug, { type: toolType }) : null,
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
      setToast({ type: "success", title: "Deleted", message: `The ${labels.singular} was deleted.` });
    } catch (error: unknown) {
      const message = (error as { error?: string } | undefined)?.error ?? `Could not delete the ${labels.singular}.`;
      setToast({ type: "error", title: "Error", message });
    }
  };

  const handleAttached = async (updatedPage: TWorkspacePage) => {
    await mutate((current) => current?.map((page) => (page.id === updatedPage.id ? updatedPage : page)), {
      revalidate: false,
    });
    await globalMutate(WORKSPACE_PAGE_DETAIL_SWR_KEY(workspaceSlug, updatedPage.id), updatedPage, {
      revalidate: false,
    });
  };

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden ${styles.root}`}>
      {isNotepad && (
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-24 font-semibold text-primary">Notepads</h1>
          <button
            type="button"
            disabled={isCreating}
            onClick={() => void createPage()}
            className="flex shrink-0 items-center gap-2 rounded-full bg-[#135DDD] px-5 py-2.5 text-12 font-medium text-white hover:bg-[#104FC0] disabled:opacity-50"
          >
            <Plus size={14} aria-hidden="true" />
            {isCreating ? "Creating..." : "Create Notepad"}
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className={styles.search}>
          <InputGroup size="lg">
            {isNotepad && <Search size={14} aria-hidden="true" className="ml-3 shrink-0 text-secondary" />}
            <Input
              size="lg"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${plural.toLowerCase()}`}
              aria-label={`Search ${plural.toLowerCase()}`}
            />
          </InputGroup>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={`w-full table-fixed border-collapse text-13 ${styles.table}`}>
          <thead className={`sticky top-0 z-[1] ${styles.header}`}>
            {isNotepad ? (
              <tr className="text-left text-11 text-secondary">
                <th className="w-[38%] px-4 py-4 font-medium">NAME</th>
                <th className="w-[24%] px-4 py-4 font-medium">PROJECT</th>
                <th className="w-[21%] px-4 py-4 font-medium">COLLABORATORS</th>
                <th className="w-[13%] px-4 py-4 font-medium">UPDATED</th>
                <th className="w-12 px-2 py-4" aria-label="Actions" />
              </tr>
            ) : (
              <tr className="text-left text-12 font-medium text-tertiary">
                <th className="w-[30%] px-4 py-2 font-medium">Name</th>
                <th className="w-[15%] px-4 py-2 font-medium">Created by</th>
                <th className="w-[20%] px-4 py-2 font-medium">Attached to</th>
                <th className="w-[13%] px-4 py-2 font-medium">Last modified</th>
                <th className="w-[10%] px-4 py-2 font-medium">Access</th>
                <th className="w-[12%] px-4 py-2 font-medium">Members</th>
                <th className="w-12 px-2 py-2" aria-label="Actions" />
              </tr>
            )}
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-placeholder">
                  Loading {plural.toLowerCase()}...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6">
                  <div role="alert" className="text-center text-13">
                    <p>Could not load {plural.toLowerCase()}. Please try again.</p>
                    <button type="button" className="mt-2 text-[#135DDD]" onClick={() => void mutate()}>
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && !error && filteredPages.length === 0 && (
              <EmptyPagesRow toolType={toolType} search={search} isCreating={isCreating} onCreate={createPage} />
            )}
            {filteredPages.map((page) => {
              const canDelete = page.owned_by === currentUser?.id;
              if (isNotepad) {
                return (
                  <NotepadRow
                    key={page.id}
                    page={page}
                    workspaceSlug={workspaceSlug}
                    canDelete={canDelete}
                    onDelete={handleDelete}
                    canAttach={canAttach}
                    onAttached={handleAttached}
                  />
                );
              }
              return (
                <WhiteboardRow
                  key={page.id}
                  page={page}
                  workspaceSlug={workspaceSlug}
                  canDelete={canDelete}
                  onDelete={handleDelete}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {isNotepad && (
        <p className="text-11 text-tertiary">
          Collaborators shows the owner and invited collaborators, not everyone with workspace access.
        </p>
      )}
    </div>
  );
});
