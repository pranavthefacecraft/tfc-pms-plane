/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Check, FileArchive, FileText, ImageIcon, Link2, Search } from "lucide-react";
import { fileHref, fileKind, matchesFileFilter } from "@/components/profile/my-tasks-files.helpers";
import type { TFileFilter } from "@/components/profile/my-tasks-files.helpers";
import { ProjectFilesService } from "@/services/project-files.service";
import type { TProjectFile } from "@/services/project-files.service";

const filesService = new ProjectFilesService();

const FILE_FILTERS: { id: TFileFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "file", label: "Documents" },
  { id: "link", label: "Links" },
];

const KIND_ICONS = { image: ImageIcon, archive: FileArchive, document: FileText, link: Link2 };

function FileCard({ file, workspaceSlug }: { file: TProjectFile; workspaceSlug: string }) {
  const kind = fileKind(file);
  const Icon = KIND_ICONS[kind];
  const href = fileHref(file);
  return (
    <article className="hover:shadow-md mb-3 break-inside-avoid overflow-hidden rounded-lg border border-subtle bg-surface-1 transition-shadow">
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#EAF1FD] text-[#135DDD]">
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
            {file.issue_id && file.issue_name ? (
              <Link
                href={`/${workspaceSlug}/projects/${file.project_id}/issues/${file.issue_id}`}
                title={`Open ${file.project_identifier}-${file.sequence_id}`}
                className="inline-flex min-w-0 items-center gap-1 hover:text-primary hover:underline"
              >
                {file.state_group === "completed" && <Check className="size-3 shrink-0" aria-label="Completed" />}
                <span className="truncate">{file.issue_name}</span>
              </Link>
            ) : (
              <span className="shrink-0">Project file</span>
            )}
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

/** Asana-style Files tab for a project: every task attachment and link, plus files attached to the project. */
export function ProjectFiles({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const [filter, setFilter] = useState<TFileFilter>("all");
  const [query, setQuery] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["project-files", workspaceSlug, projectId], () =>
    filesService.list(workspaceSlug, projectId)
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
  const files = data.filter((file) => matchesFileFilter(file, filter, query));
  return (
    <section aria-label="Project files">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-3">
          <label className="flex h-8 items-center gap-2 rounded-md border border-subtle bg-surface-1 px-2.5 text-13">
            <Search className="size-3.5 text-tertiary" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search files"
              placeholder="Search files"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-40 bg-transparent outline-none placeholder:text-tertiary"
            />
          </label>
          <span className="text-12 text-secondary">
            {files.length} {files.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
      {files.length ? (
        <div className="columns-1 gap-3 md:columns-2 xl:columns-3">
          {files.map((file) => (
            <FileCard key={`${file.kind}-${file.id}`} file={file} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-subtle py-12 text-center text-13 text-secondary">
          {data.length
            ? "No files match your filters."
            : "No files or links yet. Attachments and links added to this project's tasks will appear here."}
        </p>
      )}
    </section>
  );
}
