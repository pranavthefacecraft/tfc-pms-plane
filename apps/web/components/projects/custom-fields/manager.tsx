/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { InputField } from "@makeplane/propel/components/input-field";
import { FIELD_TYPES, customFields, fieldError, useCustomFields } from "./service";
import type { CustomField, FieldInput, FieldType } from "./service";

const controlClass = "w-full rounded border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary";
const newOption = () => ({ id: crypto.randomUUID(), name: "", color: "#135DDD" });

function FieldEditor({
  field,
  onSave,
  onCancel,
}: {
  field: CustomField | null;
  onSave: (input: FieldInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<FieldInput>(
    () =>
      field ?? {
        name: "",
        description: "",
        field_type: "single_select",
        options: [newOption(), newOption()],
        notify_collaborators: false,
      }
  );
  const [busy, setBusy] = useState(false);
  const selectable = draft.field_type === "single_select" || draft.field_type === "multi_select";
  const submit = async () => {
    setBusy(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        options: selectable ? draft.options.map((option) => ({ ...option, name: option.name.trim() })) : [],
      });
    } catch (error) {
      fieldError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{field ? "Edit field" : "Add field"}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <fieldset disabled={busy} className="space-y-4">
            <InputField
              size="md"
              orientation="vertical"
              label="Field title"
              id="custom-field-title"
              value={draft.name}
              required
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <label className="block space-y-1 text-13">
              <span>Field type</span>
              <select
                aria-label="Field type"
                className={controlClass}
                value={draft.field_type}
                disabled={!!field || busy}
                onChange={(event) => {
                  const type = event.target.value;
                  if (!(type in FIELD_TYPES)) return;
                  setDraft({ ...draft, field_type: type as FieldType });
                }}
              >
                {Object.entries(FIELD_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {field && <p className="text-11 text-tertiary">Field types cannot be changed after creation.</p>}
            </label>
            <InputField
              size="md"
              orientation="vertical"
              label="Description (optional)"
              id="custom-field-description"
              value={draft.description}
              maxLength={2000}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
            {selectable && (
              <div className="space-y-2">
                <p className="text-13 font-medium">Options</p>
                {draft.options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`Option ${index + 1} color`}
                      value={option.color}
                      className="h-8 w-9 shrink-0 cursor-pointer rounded border border-subtle"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: draft.options.map((item) =>
                            item.id === option.id ? { ...item, color: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`Option ${index + 1} name`}
                      required
                      maxLength={100}
                      className={controlClass}
                      placeholder="Type an option name"
                      value={option.name}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: draft.options.map((item) =>
                            item.id === option.id ? { ...item, name: event.target.value } : item
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      className="text-13 text-danger-primary"
                      disabled={draft.options.length <= 1}
                      onClick={() =>
                        setDraft({ ...draft, options: draft.options.filter((item) => item.id !== option.id) })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  stretch="auto"
                  label="Add option"
                  disabled={draft.options.length >= 100}
                  onClick={() => setDraft({ ...draft, options: [...draft.options, newOption()] })}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-13">
              <input
                type="checkbox"
                checked={draft.notify_collaborators}
                onChange={(event) => setDraft({ ...draft, notify_collaborators: event.target.checked })}
              />
              Notify task collaborators when this field changes
            </label>
            <p className="text-11 text-tertiary">
              In-app notifications go to the task creator, assignees and subscribers who can access the task, except the
              person making the change.
            </p>
          </fieldset>
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <Button variant="secondary" size="md" stretch="auto" label="Cancel" disabled={busy} onClick={onCancel} />
        <Button
          type="submit"
          variant="primary"
          size="md"
          stretch="auto"
          label={field ? "Save field" : "Create field"}
          loading={busy}
        />
      </DialogActions>
    </form>
  );
}

export function ProjectCustomFieldsManager({
  workspaceSlug,
  projectId,
  disabled = false,
}: {
  workspaceSlug: string;
  projectId: string;
  disabled?: boolean;
}) {
  const [screen, setScreen] = useState<"fields" | "create" | "edit">("fields");
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useCustomFields(workspaceSlug, projectId);
  const save = async (input: FieldInput) => {
    const result = await customFields.save(workspaceSlug, projectId, input, editing?.id);
    await mutate(
      (previous) =>
        editing ? previous?.map((item) => (item.id === result.id ? result : item)) : [...(previous ?? []), result],
      { revalidate: false }
    );
    setScreen("fields");
  };
  const remove = async (field: CustomField) => {
    if (!window.confirm(`Remove "${field.name}" from this project? Its saved values will no longer be shown.`)) return;
    setRemoving(field.id);
    try {
      await customFields.remove(workspaceSlug, projectId, field.id);
      await mutate((previous) => previous?.filter((item) => item.id !== field.id), { revalidate: false });
    } catch (err) {
      fieldError(err);
    } finally {
      setRemoving(null);
    }
  };
  const isEditor = screen === "create" || screen === "edit";
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-13 font-medium">Added to project</h3>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label="Add field"
            disabled={disabled || isLoading || !!error || !!removing}
            onClick={() => {
              setEditing(null);
              setScreen("create");
            }}
          />
        </div>
        {isLoading && <p role="status">Loading fields...</p>}
        {error && (
          <div role="alert" className="text-13 text-danger-primary">
            Fields could not be loaded.{" "}
            <button type="button" className="underline" onClick={() => void mutate()}>
              Retry
            </button>
          </div>
        )}
        {data?.map((field) => (
          <div key={field.id} className="rounded border border-subtle p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="min-w-0 text-left text-13 font-medium"
                disabled={disabled || !!removing}
                onClick={() => {
                  setEditing(field);
                  setScreen("edit");
                }}
              >
                {field.name}
              </button>
              <button
                type="button"
                className="text-11 text-danger-primary"
                disabled={disabled || !!removing}
                aria-label={`Remove field ${field.name}`}
                onClick={() => void remove(field)}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-11 text-secondary">{FIELD_TYPES[field.field_type]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {field.options.map((option) => (
                <span key={option.id} className="flex items-center gap-1 text-11">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} />
                  {option.name}
                </span>
              ))}
            </div>
          </div>
        ))}
        {data?.length === 0 && <p className="text-13 text-secondary">No custom fields. Add one to get started.</p>}
      </div>
      <Dialog
        open={isEditor && !disabled}
        onOpenChange={(open) => {
          if (!open) setScreen("fields");
        }}
      >
        <DialogContent size="md">
          {isEditor && !disabled && (
            <FieldEditor
              key={editing?.id ?? "new"}
              field={editing}
              onSave={save}
              onCancel={() => setScreen("fields")}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
