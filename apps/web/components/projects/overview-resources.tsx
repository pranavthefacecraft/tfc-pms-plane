/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { ArrowUpRight, FileText, List, PenTool, Plus, Trash2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import type { IProject, TProjectOverviewResource } from "@plane/types";
import { safeResourceUrl } from "@/helpers/project-overview.helper";

const RESOURCE_KINDS = { link: "Link", notepad: "Notepad page", whiteboard: "Whiteboard" } as const;
const RESOURCE_ICONS = { link: List, notepad: FileText, whiteboard: PenTool };
// Files attached in the Create Project form are stored as links to the project download endpoint.
const isAttachedFile = (url: string) => /\/api\/assets\/v2\/workspaces\/[^/]+\/projects\/[^/]+\/download\//.test(url);

export function ProjectOverviewResources({
  resources,
  canEdit,
  saving,
  save,
}: {
  resources: TProjectOverviewResource[];
  canEdit: boolean;
  saving: boolean;
  save: (payload: Partial<IProject>) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [resource, setResource] = useState<TProjectOverviewResource>({ title: "", url: "", kind: "link" });
  const [error, setError] = useState("");

  async function addResource(event: React.FormEvent) {
    event.preventDefault();
    const url = safeResourceUrl(resource.url.trim());
    if (!url || !resource.title.trim()) {
      setError("Enter a title and a valid HTTP or HTTPS URL.");
      return;
    }
    if (resources.some((item) => safeResourceUrl(item.url) === url)) {
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="overview-resources" className="text-15 font-semibold text-primary">
          Key Resources
        </h2>
        {canEdit && !adding && (
          <button
            type="button"
            aria-label="Add resource"
            disabled={saving || resources.length >= 50}
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-12 font-medium text-[#135DDD] hover:underline disabled:opacity-60"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Resource
          </button>
        )}
      </div>
      {resources.length === 0 && !adding && (
        <p className="py-2 text-13 text-tertiary">
          No resources yet. Link project briefs, Notepad pages, whiteboards, or other useful resources.
        </p>
      )}
      <ul className="divide-y divide-subtle">
        {resources.map((item, index) => {
          const url = safeResourceUrl(item.url);
          const file = isAttachedFile(item.url);
          const Icon = file ? FileText : RESOURCE_ICONS[item.kind];
          return (
            <li key={item.url} className="group flex items-center gap-3 py-3">
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
                <p className="text-12 text-tertiary">{file ? "Attached file" : RESOURCE_KINDS[item.kind]}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={saving}
                  aria-label={`Remove ${item.title}`}
                  title="Remove"
                  className="grid size-7 place-items-center rounded text-tertiary opacity-0 group-hover:opacity-100 hover:bg-layer-1 hover:text-primary focus-visible:opacity-100"
                  onClick={() => {
                    if (window.confirm(`Remove "${item.title}" from this project? This will not delete the resource.`))
                      void save({
                        overview_resources: resources.filter((_, resourceIndex) => resourceIndex !== index),
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
