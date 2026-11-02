/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Check, FileArchive, FileText, ImageIcon, Link2 } from "lucide-react";
import { MyTasksService } from "@/services/workspace-my-tasks.service";
import type { TMyTaskFile } from "@/services/workspace-my-tasks.service";
import { fileHref, fileKind, matchesFileFilter } from "./my-tasks-files.helpers";
import type { TFileFilter } from "./my-tasks-files.helpers";
import type { TaskRow } from "./my-tasks-board.helpers";

const taskService = new MyTasksService();

const FILE_FILTERS: { id: TFileFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "file", label: "Documents" },
  { id: "link", label: "Links" },
];

const KIND_ICONS = { image: ImageIcon, archive: FileArchive, document: FileText, link: Link2 };

function FileCard({ file, row, onOpen }: { file: TMyTaskFile; row: TaskRow; onOpen: (row: TaskRow) => void }) {
  const kind = fileKind(file);
  const Icon = KIND_ICONS[kind];
  const href = fileHref(file);
  return (
    <article className="hover:shadow-md mb-3 break-inside-avoid overflow-hidden rounded-lg border border-subtle bg-surface-1 transition-shadow">
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-subtle text-secondary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={file.kind === "link" ? file.url : file.name}
            className="block truncate text-13 font-medium text-primary hover:underline"
          >
            {file.name}
          </a>
          <p className="flex min-w-0 items-center gap-1 text-12 text-secondary">
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-1 hover:text-primary hover:underline"
              title={`Open ${file.project_identifier}-${file.sequence_id}`}
              onClick={() => onOpen(row)}
            >
              {file.state_group === "completed" && <Check className="size-3 shrink-0" aria-label="Completed" />}
              <span className="truncate">{file.issue_name}</span>
            </button>
            {file.created_by_name && <span className="shrink-0 truncate">· {file.created_by_name}</span>}
          </p>
        </div>
      </div>
      {kind === "image" && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block border-t border-subtle">
          <img src={href} alt={file.name} loading="lazy" className="max-h-72 w-full object-cover object-top" />
        </a>
      )}
    </article>
  );
}

export function MyTasksFiles({
  workspaceSlug,
  userId,
  rows,
  query,
  onOpen,
}: {
  workspaceSlug: string;
  userId?: string;
  /** Tasks allowed by the page filters (search is applied here to file names too). */
  rows: TaskRow[];
  query: string;
  onOpen: (row: TaskRow) => void;
}) {
  const [filter, setFilter] = useState<TFileFilter>("all");
  const { data, error, isLoading, mutate } = useSWR(userId ? ["my-tasks-files", workspaceSlug, userId] : null, () =>
    taskService.files(workspaceSlug)
  );
  if (error)
    return (
      <div role="alert" className="py-8 text-13">
        Could not load files.{" "}
        <button type="button" className="text-[#135DDD] underline" onClick={() => void mutate()}>
          Retry
        </button>
      </div>
    );
  if (isLoading || !data)
    return (
      <p role="status" className="py-8 text-13 text-secondary">
        Loading files...
      </p>
    );
  const taskRows = new Map(rows.flatMap((row) => (row.project ? [[row.project.id, row] as const] : [])));
  const files = data.flatMap((file) => {
    const row = taskRows.get(file.issue_id);
    return row && matchesFileFilter(file, filter, query) ? [{ file, row }] : [];
  });
  return (
    <section aria-label="Task files">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-md bg-layer-1 p-0.5" role="group" aria-label="File type">
          {FILE_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded px-3 py-1 text-12 ${filter === id ? "shadow-sm bg-surface-1 font-medium text-primary" : "text-secondary hover:text-primary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-12 text-secondary">
          {files.length} {files.length === 1 ? "item" : "items"}
        </span>
      </div>
      {files.length ? (
        <div className="columns-1 gap-3 md:columns-2 xl:columns-3">
          {files.map(({ file, row }) => (
            <FileCard key={`${file.kind}-${file.id}`} file={file} row={row} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-subtle py-12 text-center text-13 text-secondary">
          {data.length
            ? "No files match your filters."
            : "No files or links yet. Attachments and links added to your tasks will appear here."}
        </p>
      )}
    </section>
  );
}
