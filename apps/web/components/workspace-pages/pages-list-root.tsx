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
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// hooks
import { useUser, useUserPermissions } from "@/hooks/store/user";
// services
import type { TWorkspacePage, TWorkspaceToolType } from "@/services/page/workspace-page.service";
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
  root: "gap-6 p-4 md:p-7",
  search: "w-full",
  tableWrapper: "min-h-0 overflow-auto border border-subtle",
  table: "min-w-[700px]",
  header: "bg-surface-1",
};

type Props = {
  workspaceSlug: string;
  toolType?: TWorkspaceToolType;
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

type ToolPageRowProps = {
  page: TWorkspacePage;
  workspaceSlug: string;
  canDelete: boolean;
  onDelete: (page: TWorkspacePage) => Promise<void>;
  canAttach: boolean;
  onAttached: (page: TWorkspacePage) => Promise<void>;
  toolType: TWorkspaceToolType;
};

function ToolPageRow({ page, workspaceSlug, toolType, ...actions }: ToolPageRowProps) {
  const attachment = page.attachment;
  const projectLabel = attachment
    ? attachment.is_accessible
      ? attachment.project_name || "Attached project"
      : "Restricted project"
    : "—";
  const projectHref = attachment?.is_accessible
    ? `/${workspaceSlug}/projects/${attachment.project_id}/overview`
    : undefined;
  const href = getWorkspacePageHref(workspaceSlug, page.id, toolType);
  const collaborators =
    toolType === "page" ? page : { ...page, collaborators: page.updated_by ? [page.updated_by] : [] };
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
        <span
          className="block truncate"
          title={toolType === "page" ? "Owner and invited collaborators" : "Owner and most recent editor"}
        >
          {notepadCollaborators(collaborators) || "—"}
        </span>
      </td>
      <td className="px-4 py-6 text-secondary">
        <time dateTime={page.updated_at} title={page.updated_at}>
          {notepadUpdatedLabel(page.updated_at)}
        </time>
      </td>
      <td className="px-2 py-6">
        <ToolPageActions page={page} workspaceSlug={workspaceSlug} toolType={toolType} {...actions} />
      </td>
    </tr>
  );
}

function ToolPageActions({
  page,
  workspaceSlug,
  toolType,
  canAttach,
  canDelete,
  onDelete,
  onAttached,
}: ToolPageRowProps) {
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const attachmentLabel = getAttachmentLabel(page.attachment);
  const attachmentHref = getAttachmentHref(workspaceSlug, page.attachment);
  const href = getWorkspacePageHref(workspaceSlug, page.id, toolType);
  const label = toolType === "page" ? "notepad" : "whiteboard";
  return (
    <>
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
          {toolType === "page" && <MenuItem label="Open notepad" render={<Link href={href} />} />}
          {canAttach && <MenuItem label="Link to task or project" onClick={() => setIsAttachOpen(true)} />}
          {toolType === "page" && (
            <div className="px-3 py-2 text-12 text-secondary">
              {page.access === WORKSPACE_PAGE_ACCESS.PRIVATE ? "Private · Owner only" : "Public · Workspace access"}
            </div>
          )}
          {toolType === "page" && attachmentLabel && (
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
          {canDelete && <MenuItem label={`Delete ${label}`} onClick={() => void onDelete(page)} />}
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
    </>
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
      <td colSpan={5} className="px-4 py-12">
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
  const styles = listStyles;
  const isNotepad = toolType === "page";
  const plural = isNotepad ? "Notepads" : labels.plural;
  const columnCount = 5;
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-24 font-semibold text-primary">{plural}</h1>
        <button
          type="button"
          disabled={isCreating}
          onClick={() => void createPage()}
          className="flex shrink-0 items-center gap-2 rounded-full bg-[#135DDD] px-5 py-2.5 text-12 font-medium text-white hover:bg-[#104FC0] disabled:opacity-50"
        >
          <Plus size={14} aria-hidden="true" />
          {isCreating ? "Creating..." : isNotepad ? "Create Notepad" : "Create Whiteboard"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className={styles.search}>
          <InputGroup size="lg">
            <Search size={14} aria-hidden="true" className="ml-3 shrink-0 text-secondary" />
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
            <tr className="text-left text-11 text-secondary">
              <th className="w-[38%] px-4 py-4 font-medium">NAME</th>
              <th className="w-[24%] px-4 py-4 font-medium">PROJECT</th>
              <th className="w-[21%] px-4 py-4 font-medium">COLLABORATORS</th>
              <th className="w-[13%] px-4 py-4 font-medium">UPDATED</th>
              <th className="w-12 px-2 py-4" aria-label="Actions" />
            </tr>
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
              return (
                <ToolPageRow
                  key={page.id}
                  page={page}
                  workspaceSlug={workspaceSlug}
                  canDelete={canDelete}
                  onDelete={handleDelete}
                  canAttach={canAttach}
                  onAttached={handleAttached}
                  toolType={toolType}
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
      {!isNotepad && (
        <p className="text-11 text-tertiary">
          Collaborators shows the owner and most recent editor. Use Share inside the whiteboard to manage access.
        </p>
      )}
    </div>
  );
});
