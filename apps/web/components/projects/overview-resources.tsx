/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import type { IProject, TProjectOverviewResource } from "@plane/types";
import { safeResourceUrl } from "@/helpers/project-overview.helper";

const RESOURCE_KINDS = { link: "Link", notepad: "Notepad page", whiteboard: "Whiteboard" } as const;

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
    <section className="rounded-xl border border-subtle bg-surface-1 p-6" aria-labelledby="overview-resources">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="overview-resources" className="text-16 font-semibold">
          Key resources
        </h2>
        {canEdit && !adding && (
          <Button
            label="Add resource"
            stretch="auto"
            variant="secondary"
            size="sm"
            disabled={saving || resources.length >= 50}
            onClick={() => setAdding(true)}
          />
        )}
      </div>
      <p className="mb-4 text-13 text-secondary">
        Link project briefs, Notepad pages, whiteboards, or other useful resources. Existing sharing permissions still
        apply.
      </p>
      {resources.length === 0 && <p className="text-13 text-tertiary">No resources linked yet.</p>}
      <ul className="space-y-3">
        {resources.map((item, index) => {
          const url = safeResourceUrl(item.url);
          return (
            <li key={item.url} className="flex items-center justify-between gap-3 rounded-lg border border-subtle p-3">
              <div className="min-w-0">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-14 font-medium text-accent-primary"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span>{item.title} (invalid link)</span>
                )}
                <p className="text-12 text-tertiary">{RESOURCE_KINDS[item.kind]}</p>
              </div>
              {canEdit && (
                <Button
                  label="Remove"
                  stretch="auto"
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  aria-label={`Remove ${item.title}`}
                  onClick={() => {
                    if (window.confirm(`Remove "${item.title}" from this project? This will not delete the resource.`))
                      void save({
                        overview_resources: resources.filter((_, resourceIndex) => resourceIndex !== index),
                      });
                  }}
                />
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
