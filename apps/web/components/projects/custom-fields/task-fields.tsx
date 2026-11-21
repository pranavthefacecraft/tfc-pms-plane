/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { renderFormattedPayloadDate } from "@plane/utils";
import { customFields, fieldError, useCustomFields } from "./service";
import type { CustomField, FieldValue } from "./service";
import { parseFieldDraft } from "./value.helpers";
import { useLiveTaskUpdates } from "@/hooks/use-live-task-updates";
import { taskDetailLabelClass } from "@/components/common/layout/sidebar/property-list-item";
import { TaskDetailChoice } from "@/components/common/task-detail-choice";
import { taskStatusColors } from "../project-list.helpers";

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
  presentation,
}: {
  field: CustomField;
  value: FieldValue;
  disabled: boolean;
  onSave: (value: FieldValue) => Promise<void>;
  presentation?: "stage" | "status";
}) {
  const { t } = useTranslation();
  const initial = value === null ? "" : String(value);
  const [draftState, setDraftState] = useState({ baseValue: initial, text: initial });
  const draft = draftState.text === draftState.baseValue ? initial : draftState.text;
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<string>();
  const [today] = useState(() => renderFormattedPayloadDate(new Date()));
  const save = async (next: FieldValue) => {
    setBusy(true);
    try {
      await onSave(next);
      const saved = next === null ? "" : String(next);
      setDraftState({ baseValue: saved, text: saved });
    } catch (error) {
      fieldError(error);
    } finally {
      setBusy(false);
    }
  };
  const selectedIds = new Set(Array.isArray(value) ? value : typeof value === "string" ? [value] : []);
  const selected = field.options.filter((option) => selectedIds.has(option.id));
  if (presentation && field.field_type === "single_select") {
    const option = selected[0];
    return (
      <TaskDetailChoice
        label={field.name}
        value={option?.id ?? ""}
        options={[{ id: "", label: t("common.none") }, ...field.options.map(({ id, name }) => ({ id, label: name }))]}
        onChange={(next) => void save(next || null)}
        disabled={disabled}
        busy={busy}
        showChevron={presentation === "status"}
        valueClassName={
          presentation === "status"
            ? `rounded-full px-2.5 py-0.5 text-13 leading-5 font-medium ${taskStatusColors(option?.name)}`
            : undefined
        }
      />
    );
  }
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
        min={kind === "date" ? today : undefined}
        step={kind === "number" ? "any" : undefined}
        maxLength={kind === "text" ? 10000 : undefined}
        disabled={busy}
        value={draft}
        aria-invalid={!!invalid}
        className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-13"
        onChange={(event) => setDraftState({ baseValue: initial, text: event.target.value })}
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
              setDraftState({ baseValue: initial, text: initial });
              setInvalid(undefined);
            }}
          />
        </div>
      )}
    </form>
  );
}

const normalizedFieldName = (field: CustomField) => field.name.trim().toLowerCase();

export function TaskCustomFields({
  workspaceSlug,
  projectId,
  issueId,
  disabled,
  primaryGroup,
}: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  primaryGroup?: { names: readonly string[]; after: ReactNode };
}) {
  const fields = useCustomFields(workspaceSlug, projectId);
  const values = useSWR(["task-custom-field-values", workspaceSlug, projectId, issueId], () =>
    customFields.values(workspaceSlug, projectId, issueId)
  );
  useLiveTaskUpdates(workspaceSlug, () => Promise.all([values.mutate(), fields.mutate()]));
  let feedback: ReactNode;
  if (fields.error || values.error) {
    feedback = (
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
  } else if (fields.isLoading || values.isLoading) {
    feedback = (
      <p role="status" className="py-2 text-13 text-secondary">
        Loading custom fields...
      </p>
    );
  }
  const configuredFields = feedback ? [] : (fields.data ?? []);
  const renderFields = (group: CustomField[], compact = false) =>
    group.length > 0 && (
      <section
        aria-label="Custom fields"
        className={compact ? "space-y-2" : "divide-y divide-subtle border-y border-subtle"}
      >
        {group.map((field) => {
          const value = values.data?.[field.id] ?? null;
          const name = normalizedFieldName(field);
          return (
            <div
              key={field.id}
              className={`grid grid-cols-[120px_minmax(0,1fr)] gap-2 ${compact ? "min-h-7.5 items-center" : "py-2"}`}
            >
              <div className="min-w-0 py-1 text-13 text-secondary">
                <p className={`${taskDetailLabelClass} break-words`}>{field.name}</p>
                {field.description && <p className="mt-1 text-11 text-tertiary">{field.description}</p>}
              </div>
              <div className={compact ? "w-fit max-w-[min(100%,12rem)] min-w-0" : "min-w-0"}>
                <FieldValueEditor
                  key={field.id}
                  field={field}
                  value={value}
                  disabled={disabled}
                  presentation={compact && (name === "stage" || name === "status") ? name : undefined}
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
  if (!primaryGroup) return feedback ?? renderFields(configuredFields);

  const primaryNames = new Set(primaryGroup.names);
  return (
    <>
      {feedback ??
        renderFields(
          primaryGroup.names.flatMap((name) => configuredFields.filter((field) => normalizedFieldName(field) === name)),
          true
        )}
      {primaryGroup.after}
      {renderFields(configuredFields.filter((field) => !primaryNames.has(normalizedFieldName(field))))}
    </>
  );
}
