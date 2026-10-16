/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { customFields, fieldError, useCustomFields } from "./service";
import type { CustomField, FieldValue } from "./service";
import { parseFieldDraft } from "./value.helpers";

function OptionBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-subtle px-1.5 py-0.5 text-11">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

function FieldValueEditor({
  field,
  value,
  disabled,
  onSave,
}: {
  field: CustomField;
  value: FieldValue;
  disabled: boolean;
  onSave: (value: FieldValue) => Promise<void>;
}) {
  const [draft, setDraft] = useState(typeof value === "string" || typeof value === "number" ? String(value) : "");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<string>();
  const save = async (next: FieldValue) => {
    setBusy(true);
    try {
      await onSave(next);
    } catch (error) {
      fieldError(error);
    } finally {
      setBusy(false);
    }
  };
  const selectedIds = new Set(Array.isArray(value) ? value : typeof value === "string" ? [value] : []);
  const selected = field.options.filter((option) => selectedIds.has(option.id));
  if (disabled)
    return (
      <div className="flex flex-wrap gap-1 text-13 text-secondary">
        {selected.length
          ? selected.map((option) => <OptionBadge key={option.id} {...option} />)
          : value === null || value === "" || Array.isArray(value)
            ? "None"
            : String(value)}
      </div>
    );
  if (field.field_type === "single_select")
    return (
      <div className="space-y-1">
        {selected.map((option) => (
          <OptionBadge key={option.id} {...option} />
        ))}
        <select
          aria-label={field.name}
          disabled={busy}
          value={typeof value === "string" ? value : ""}
          className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-13"
          onChange={(event) => void save(event.target.value || null)}
        >
          <option value="">None</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    );
  if (field.field_type === "multi_select")
    return (
      <details className="rounded border border-subtle px-2 py-1">
        <summary className="cursor-pointer text-13">
          {selected.length ? (
            <span className="inline-flex flex-wrap gap-1">
              {selected.map((option) => (
                <OptionBadge key={option.id} {...option} />
              ))}
            </span>
          ) : (
            "Select options"
          )}
        </summary>
        <fieldset aria-label={field.name} disabled={busy} className="max-h-48 space-y-2 overflow-auto py-2">
          {field.options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-13">
              <input
                type="checkbox"
                checked={selected.some((item) => item.id === option.id)}
                onChange={(event) => {
                  const ids = selected.map((item) => item.id);
                  void save(event.target.checked ? [...ids, option.id] : ids.filter((id) => id !== option.id));
                }}
              />
              <OptionBadge {...option} />
            </label>
          ))}
        </fieldset>
      </details>
    );
  const kind = field.field_type;
  const initial = value === null ? "" : String(value);
  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const next = parseFieldDraft(kind, draft);
          setInvalid(undefined);
          void save(next);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid value.";
          setInvalid(message);
          setToast({ type: "error", title: "Invalid custom field value", message });
        }
      }}
    >
      <input
        aria-label={field.name}
        type={kind === "number" ? "number" : kind === "date" ? "date" : "text"}
        step={kind === "number" ? "any" : undefined}
        maxLength={kind === "text" ? 10000 : undefined}
        disabled={busy}
        value={draft}
        aria-invalid={!!invalid}
        className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-13"
        onChange={(event) => setDraft(event.target.value)}
      />
      {invalid && (
        <p role="alert" className="text-11 text-danger-primary">
          {invalid}
        </p>
      )}
      {draft !== initial && (
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" stretch="auto" label="Save" loading={busy} />
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label="Cancel"
            disabled={busy}
            onClick={() => {
              setDraft(initial);
              setInvalid(undefined);
            }}
          />
        </div>
      )}
    </form>
  );
}

export function TaskCustomFields({
  workspaceSlug,
  projectId,
  issueId,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
}) {
  const fields = useCustomFields(workspaceSlug, projectId);
  const values = useSWR(["task-custom-field-values", workspaceSlug, projectId, issueId], () =>
    customFields.values(workspaceSlug, projectId, issueId)
  );
  if (fields.error || values.error)
    return (
      <div role="alert" className="py-2 text-13 text-danger-primary">
        Custom fields could not be loaded.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            void fields.mutate();
            void values.mutate();
          }}
        >
          Retry
        </button>
      </div>
    );
  if (fields.isLoading || values.isLoading)
    return (
      <p role="status" className="py-2 text-13 text-secondary">
        Loading custom fields...
      </p>
    );
  if (!fields.data?.length) return null;
  return (
    <section aria-label="Custom fields" className="divide-y divide-subtle border-y border-subtle">
      {fields.data.map((field) => {
        const value = values.data?.[field.id] ?? null;
        return (
          <div key={field.id} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 py-2">
            <div className="min-w-0 py-1 text-13 text-secondary">
              <p className="font-medium break-words">{field.name}</p>
              {field.description && <p className="mt-1 text-11 text-tertiary">{field.description}</p>}
            </div>
            <div className="min-w-0">
              <FieldValueEditor
                key={
                  field.field_type === "single_select" || field.field_type === "multi_select"
                    ? field.id
                    : `${field.id}:${JSON.stringify(value)}`
                }
                field={field}
                value={value}
                disabled={disabled}
                onSave={async (next) => {
                  await customFields.setValue(workspaceSlug, projectId, issueId, field.id, next);
                  await values.mutate((previous) => ({ ...previous, [field.id]: next }), { revalidate: false });
                }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
