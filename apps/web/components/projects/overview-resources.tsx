/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import useSWR from "swr";
import { orderBy } from "lodash-es";
import { ArrowUpRight, FileText, List, Mic, PenTool, Plus, Search, Trash2, Video } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { EFileAssetType } from "@plane/types";
import type { IProject, TProjectOverviewResource } from "@plane/types";
import { setToast } from "@plane/blocks/toast";
import { safeResourceUrl } from "@/helpers/project-overview.helper";
import { fileHref, fileKind } from "@/components/profile/my-tasks-files.helpers";
import { FileService } from "@/services/file.service";
import { ProjectFilesService } from "@/services/project-files.service";
import type { TProjectFile } from "@/services/project-files.service";
import { OverviewResourceControls } from "./overview-resource-controls";
import type { ResourceKind, ResourceSort } from "./overview-resource-controls";

const RESOURCE_KINDS = { link: "Link", notepad: "Notepad page", whiteboard: "Whiteboard" } as const;
const RESOURCE_ICONS = {
  link: List,
  notepad: FileText,
  whiteboard: PenTool,
  attachment: FileText,
  image: FileText,
  video: Video,
  recording: Mic,
};
function resourceFileKind(file: TProjectFile): ResourceKind {
  if (file.kind === "link") {
    if (/\/recordings\/[^/?#]+/.test(file.url)) return "recording";
    return "link";
  }
  if (file.mime_type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name)) return "recording";
  if (file.mime_type.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)) return "video";
  return fileKind(file) === "image" ? "image" : "attachment";
}
// Files attached in the Create Project form are stored as links to the project download endpoint.
const isAttachedFile = (url: string) => /\/api\/assets\/v2\/workspaces\/[^/]+\/projects\/[^/]+\/download\//.test(url);
const ASSET_PATH =
  /\/api\/assets\/v2\/workspaces\/[^/]+\/projects\/[^/]+\/(?:download\/[^/]+|issues\/[^/]+\/attachments\/[^/]+)\/$/;
function resourceHref(url: string): string | undefined {
  return safeResourceUrl(url) ?? (url.startsWith("/api/assets/v2/") && ASSET_PATH.test(url) ? url : undefined);
}
function resourceKey(url: string): string | undefined {
  const href = resourceHref(url);
  return href?.match(ASSET_PATH)?.[0] ?? href;
}
const filesService = new ProjectFilesService();
const fileService = new FileService();
type ResourceItem = {
  id: string;
  title: string;
  url: string;
  kind: ResourceKind;
  detail: string;
  createdAt: string;
  updatedAt: string;
  resourceIndex?: number;
};

function combinedResources(resources: TProjectOverviewResource[], files: TProjectFile[]): ResourceItem[] {
  const items: ResourceItem[] = resources.map((resource, resourceIndex) => {
    const file = files.find((file) => resourceKey(fileHref(file)) === resourceKey(resource.url));
    return {
      id: resource.url,
      title: resource.title,
      url: resource.url,
      kind: file ? resourceFileKind(file) : isAttachedFile(resource.url) ? "attachment" : resource.kind,
      detail: isAttachedFile(resource.url) ? "Attached file" : RESOURCE_KINDS[resource.kind],
      createdAt: file?.created_at ?? "",
      updatedAt: file?.updated_at ?? "",
      resourceIndex,
    };
  });
  const urls = new Set(items.map((item) => resourceKey(item.url)).filter((url) => url !== undefined));
  for (const file of files) {
    const url = fileHref(file);
    const key = resourceKey(url);
    if (key && urls.has(key)) continue;
    if (key) urls.add(key);
    items.push({
      id: `${file.kind}-${file.id}`,
      title: file.name,
      url,
      kind: resourceFileKind(file),
      detail: file.issue_name || (file.kind === "link" ? "Link" : "Attached file"),
      createdAt: file.created_at,
      updatedAt: file.updated_at ?? "",
    });
  }
  return items;
}

export function ProjectOverviewResources({
  workspaceSlug,
  projectId,
  resources,
  canEdit,
  saving,
  save,
}: {
  workspaceSlug: string;
  projectId: string;
  resources: TProjectOverviewResource[];
  canEdit: boolean;
  saving: boolean;
  save: (payload: Partial<IProject>) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [resource, setResource] = useState<TProjectOverviewResource>({ title: "", url: "", kind: "link" });
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ResourceKind[]>([]);
  const [sort, setSort] = useState<ResourceSort>("updated");
  const [uploading, setUploading] = useState(false);
  const [fileRefreshFailed, setFileRefreshFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    data: files,
    error: filesError,
    isLoading,
    mutate,
  } = useSWR(["project-files", workspaceSlug, projectId], () => filesService.list(workspaceSlug, projectId));
  const items = combinedResources(resources, files ?? []);
  const term = query.trim().toLocaleLowerCase();
  const selectedTypes = new Set(filters);
  const visibleItems = orderBy(
    items.filter(
      (item) =>
        (selectedTypes.size === 0 || selectedTypes.has(item.kind)) &&
        (!term || [item.title, item.url, item.detail].some((value) => value.toLocaleLowerCase().includes(term)))
    ),
    [
      (item) => (sort.startsWith("name") ? false : !(sort === "updated" ? item.updatedAt : item.createdAt)),
      (item) =>
        sort.startsWith("name") ? item.title.toLocaleLowerCase() : sort === "updated" ? item.updatedAt : item.createdAt,
    ],
    ["asc", sort === "oldest" || sort === "name" ? "asc" : "desc"]
  );

  async function refreshFiles() {
    try {
      const updatedFiles = await filesService.list(workspaceSlug, projectId);
      await mutate(updatedFiles, { revalidate: false });
      setFileRefreshFailed(false);
    } catch (refreshError) {
      setFileRefreshFailed(true);
      throw refreshError;
    }
  }

  async function upload(selectedFiles: File[]) {
    setUploading(true);
    try {
      const failed: string[] = [];
      const results = await Promise.allSettled(
        selectedFiles.map((file) =>
          fileService.uploadProjectAsset(
            workspaceSlug,
            projectId,
            { entity_identifier: projectId, entity_type: EFileAssetType.PROJECT_ATTACHMENT },
            file
          )
        )
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Project file upload failed: ${selectedFiles[index].name}`, result.reason);
          failed.push(selectedFiles[index].name);
        }
      });
      const uploaded = selectedFiles.length - failed.length;
      let refreshFailed = false;
      if (uploaded > 0) {
        try {
          await refreshFiles();
        } catch (refreshError) {
          console.error("Project files refresh failed after upload", refreshError);
          refreshFailed = true;
        }
      }
      if (failed.length > 0) {
        setToast({
          type: "error",
          title:
            uploaded > 0
              ? `${uploaded} of ${selectedFiles.length} files uploaded`
              : selectedFiles.length === 1
                ? "Could not upload file"
                : "Could not upload files",
          message: `Failed: ${failed.join(", ")}. Check your connection and select only these files to retry.${
            refreshFailed ? " The list could not refresh; retry loading it to see successful uploads." : ""
          }`,
        });
      } else if (refreshFailed) {
        setToast({
          type: "error",
          title:
            selectedFiles.length === 1
              ? "File uploaded, but the list could not refresh"
              : "Files uploaded, but the list could not refresh",
          message: "Retry loading files to see the uploaded files. Do not upload them again.",
        });
      } else {
        setToast({
          type: "success",
          title: selectedFiles.length === 1 ? "File uploaded" : `${selectedFiles.length} files uploaded`,
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function addResource(event: React.FormEvent) {
    event.preventDefault();
    const url = safeResourceUrl(resource.url.trim());
    if (!url || !resource.title.trim()) {
      setError("Enter a title and a valid HTTP or HTTPS URL.");
      return;
    }
    if (items.some((item) => resourceKey(item.url) === resourceKey(url))) {
      setError("This resource is already linked to the project.");
      return;
    }
    if (await save({ overview_resources: [...resources, { ...resource, title: resource.title.trim(), url }] })) {
      setAdding(false);
      setResource({ title: "", url: "", kind: "link" });
      setError("");
    }
  }

  return (
    <section className="rounded-lg border border-subtle bg-surface-1 p-5" aria-labelledby="overview-resources">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="overview-resources" className="text-15 font-semibold text-primary">
          Files &amp; Resources
        </h2>
        {canEdit && !adding && (
          <button
            type="button"
            aria-label="Add resource"
            disabled={saving || uploading || resources.length >= 50}
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-12 font-medium text-[#135DDD] hover:underline disabled:opacity-60"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Resource
          </button>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-subtle px-2">
          <Search className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
          <input
            aria-label="Search resources"
            placeholder="Search Resources"
            className="w-44 min-w-0 bg-transparent text-12 text-primary outline-none placeholder:text-placeholder"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <OverviewResourceControls filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} />
      </div>
      {filesError || fileRefreshFailed ? (
        <p role="alert" className="mb-3 text-13 text-secondary">
          Could not load project files. Linked resources are still shown.{" "}
          <button
            type="button"
            className="text-[#135DDD] underline"
            onClick={() =>
              void refreshFiles().catch((refreshError) => console.error("Project files refresh failed", refreshError))
            }
          >
            Retry
          </button>
        </p>
      ) : (
        isLoading && (
          <p role="status" className="mb-3 text-13 text-secondary">
            Loading files...
          </p>
        )
      )}
      {(canEdit || (!isLoading && !filesError && !fileRefreshFailed && items.length === 0)) && (
        <div
          role="group"
          aria-label="Upload files and resources"
          className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-[#E1E8F3] bg-[#F8FAFF] px-4 py-6 text-center dark:border-subtle dark:bg-surface-2"
        >
          <h3 className="text-20 font-semibold text-primary">
            {!isLoading && !filesError && !fileRefreshFailed && items.length === 0
              ? "No Files Or Resources"
              : "Upload Files & Resources"}
          </h3>
          <p className="mt-2 text-13 text-tertiary">Upload files or add links, recordings, notes and whiteboards.</p>
          {canEdit && (
            <button
              type="button"
              disabled={uploading || saving}
              onClick={() => fileInput.current?.click()}
              className="mt-4 rounded-full bg-[#EAF1FD] px-4 py-2 text-13 font-semibold text-[#135DDD] disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Browse File"}
            </button>
          )}
        </div>
      )}
      {!isLoading && !filesError && !fileRefreshFailed && items.length > 0 && visibleItems.length === 0 && (
        <p className="py-4 text-center text-13 text-secondary">
          No matching files or resources. Try a different search or filter.
        </p>
      )}
      <ul className="mt-3 divide-y divide-subtle">
        {visibleItems.map((item) => {
          const url = resourceHref(item.url);
          const Icon = RESOURCE_ICONS[item.kind];
          return (
            <li key={item.id} className="group flex items-center gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#EAF1FD] text-[#135DDD]">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-13 font-medium text-primary hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span className="text-13">{item.title} (invalid link)</span>
                )}
                <p className="text-12 text-tertiary">{item.detail}</p>
              </div>
              {canEdit && item.resourceIndex !== undefined && (
                <button
                  type="button"
                  disabled={saving}
                  aria-label={`Remove ${item.title}`}
                  title="Remove"
                  className="grid size-7 place-items-center rounded text-tertiary opacity-0 group-hover:opacity-100 hover:bg-layer-1 hover:text-primary focus-visible:opacity-100"
                  onClick={() => {
                    if (window.confirm(`Remove "${item.title}" from this project? This will not delete the resource.`))
                      void save({
                        overview_resources: resources.filter(
                          (_, resourceIndex) => resourceIndex !== item.resourceIndex
                        ),
                      });
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              )}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${item.title}`}
                  className="grid size-7 place-items-center rounded text-secondary hover:bg-layer-1 hover:text-primary"
                >
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            aria-label="Upload project files"
            className="hidden"
            disabled={uploading || saving}
            onChange={(event) => {
              const selectedFiles = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (selectedFiles.length > 0) void upload(selectedFiles);
            }}
          />
        </>
      )}
      {adding && canEdit && (
        <form onSubmit={addResource} className="mt-4 space-y-3">
          <label className="block text-13">
            Resource type
            <select
              className="mt-1 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13"
              value={resource.kind}
              disabled={saving}
              onChange={(event) => {
                const kind = event.target.value;
                if (kind === "link" || kind === "notepad" || kind === "whiteboard") setResource({ ...resource, kind });
              }}
            >
              {Object.entries(RESOURCE_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <InputField
            size="md"
            orientation="vertical"
            label="Title"
            id="overview-resource-title"
            value={resource.title}
            required
            maxLength={255}
            disabled={saving}
            onChange={(event) => setResource({ ...resource, title: event.target.value })}
          />
          <InputField
            size="md"
            orientation="vertical"
            label="URL"
            id="overview-resource-url"
            value={resource.url}
            required
            maxLength={2048}
            disabled={saving}
            placeholder="Paste the resource's full URL"
            onChange={(event) => {
              setResource({ ...resource, url: event.target.value });
              setError("");
            }}
          />
          {error && (
            <p role="alert" className="text-red-500 text-13">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button label="Save resource" variant="primary" size="sm" stretch="auto" type="submit" disabled={saving} />
            <Button
              label="Cancel"
              size="sm"
              stretch="auto"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setError("");
              }}
            />
          </div>
        </form>
      )}
    </section>
  );
}
