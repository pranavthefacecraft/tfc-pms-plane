/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import {
  ACCOUNT_OPTIONS,
  DUE_OPTIONS,
  EMPTY_FILTERS,
  STATUS_OPTIONS,
  filterCount,
  toggleValue,
} from "./my-tasks-filters.helpers";
import type { TTaskFilters } from "./my-tasks-filters.helpers";

type TOption = { readonly id: string; readonly label: string };

export function CheckboxGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly TOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  const checked = new Set(selected);
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2 text-14 font-semibold text-primary">{title}</legend>
      {options.map(({ id, label }) => (
        <label key={id} className="flex cursor-pointer items-center gap-3 text-13 text-primary">
          <input
            type="checkbox"
            className="size-4 cursor-pointer rounded border-subtle accent-[#135DDD]"
            checked={checked.has(id)}
            onChange={() => onToggle(id)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export function TaskFilters({
  filters,
  onApply,
  projects,
}: {
  filters: TTaskFilters;
  onApply: (filters: TTaskFilters) => void;
  projects: [string, string][];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = filterCount(filters);
  const toggle = (key: "due" | "accounts" | "projects" | "statuses", id: string) =>
    setDraft((previous) => ({ ...previous, [key]: toggleValue<string>(previous[key], id) }));
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(filters);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={count ? `Filter (${count} active)` : "Filter"}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 text-12 ${count ? "border-[#135DDD] text-[#135DDD]" : "border-subtle"}`}
          />
        }
      >
        <Filter className="size-3.5" />
        Filter
        {count > 0 && (
          <span className="grid size-4 place-items-center rounded-full bg-[#135DDD] text-10 text-white">{count}</span>
        )}
      </PopoverTrigger>
      <PopoverContent variant="text" align="end" sideOffset={8} aria-label="Filter My Tasks">
        <div className="flex max-h-[70vh] w-64 flex-col">
          <div className="flex flex-col gap-5 overflow-y-auto pb-3">
            <CheckboxGroup
              title="Due date"
              options={DUE_OPTIONS}
              selected={draft.due}
              onToggle={(id) => toggle("due", id)}
            />
            {draft.due.includes("custom") && (
              <div className="-mt-2 grid grid-cols-2 gap-2 pl-7 text-12">
                <label className="flex flex-col gap-1 text-secondary">
                  From
                  <input
                    type="date"
                    aria-label="Custom date from"
                    className="rounded border border-subtle bg-surface-1 px-1.5 py-1 text-primary"
                    value={draft.from}
                    max={draft.to || undefined}
                    onChange={(event) => setDraft((previous) => ({ ...previous, from: event.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-secondary">
                  To
                  <input
                    type="date"
                    aria-label="Custom date to"
                    className="rounded border border-subtle bg-surface-1 px-1.5 py-1 text-primary"
                    value={draft.to}
                    min={draft.from || undefined}
                    onChange={(event) => setDraft((previous) => ({ ...previous, to: event.target.value }))}
                  />
                </label>
              </div>
            )}
            <CheckboxGroup
              title="Account"
              options={ACCOUNT_OPTIONS}
              selected={draft.accounts}
              onToggle={(id) => toggle("accounts", id)}
            />
            {projects.length > 0 && (
              <CheckboxGroup
                title="Project"
                options={projects.map(([id, label]) => ({ id, label }))}
                selected={draft.projects}
                onToggle={(id) => toggle("projects", id)}
              />
            )}
            <CheckboxGroup
              title="Status"
              options={STATUS_OPTIONS}
              selected={draft.statuses}
              onToggle={(id) => toggle("statuses", id)}
            />
          </div>
          <div className="flex items-center justify-between border-t border-subtle pt-3">
            <button
              type="button"
              className="text-13 text-secondary underline hover:text-primary"
              onClick={() => setDraft(EMPTY_FILTERS)}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded bg-[#135DDD] px-4 py-1.5 text-13 font-medium text-white hover:bg-[#0F4FC0]"
              onClick={() => {
                onApply(draft.due.includes("custom") ? draft : { ...draft, from: "", to: "" });
                setOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
