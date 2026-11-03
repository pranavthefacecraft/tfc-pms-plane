/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { CheckboxGroup } from "@/components/profile/my-tasks-filters";
import { toggleValue } from "@/components/profile/my-tasks-filters.helpers";
import {
  EMPTY_LIST_FILTERS,
  LIST_ASSIGNEE_OPTIONS,
  LIST_DUE_OPTIONS,
  LIST_PRIORITY_OPTIONS,
  LIST_STATUS_OPTIONS,
  listFilterCount,
} from "./project-list.helpers";
import type { TProjectListFilterKey, TProjectListFilters } from "./project-list.helpers";

const GROUPS = [
  { key: "statuses", title: "Status", options: LIST_STATUS_OPTIONS },
  { key: "priorities", title: "Priority", options: LIST_PRIORITY_OPTIONS },
  { key: "due", title: "Due date", options: LIST_DUE_OPTIONS },
  { key: "assignees", title: "Collaborators", options: LIST_ASSIGNEE_OPTIONS },
] as const satisfies readonly { key: TProjectListFilterKey; title: string; options: readonly unknown[] }[];

export function ProjectListFilters({
  filters,
  onApply,
}: {
  filters: TProjectListFilters;
  onApply: (filters: TProjectListFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = listFilterCount(filters);
  const toggle = (key: TProjectListFilterKey, id: string) =>
    setDraft((previous) => ({ ...previous, [key]: toggleValue(previous[key], id) }));
  const changeOpen = (next: boolean) => {
    if (next) setDraft(filters);
    setOpen(next);
  };
  const apply = () => {
    onApply(draft);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={count ? `Filter (${count} active)` : "Filter"}
            className={`flex h-8 items-center gap-2 rounded border px-3 text-12 ${count ? "border-[#135DDD] text-[#135DDD]" : "border-subtle"}`}
          />
        }
      >
        <Filter className="size-3.5" />
        Filter
        {count > 0 && (
          <span className="grid size-4 place-items-center rounded-full bg-[#135DDD] text-10 text-white">{count}</span>
        )}
      </PopoverTrigger>
      <PopoverContent variant="text" align="end" sideOffset={8} aria-label="Filter project tasks">
        <div className="flex max-h-[70vh] w-64 flex-col">
          <div className="flex flex-col gap-5 overflow-y-auto pb-3">
            {GROUPS.map((group) => (
              <CheckboxGroup
                key={group.key}
                title={group.title}
                options={group.options}
                selected={draft[group.key]}
                onToggle={(id) => toggle(group.key, id)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-subtle pt-3">
            <button
              type="button"
              className="text-13 text-secondary underline hover:text-primary"
              onClick={() => setDraft(EMPTY_LIST_FILTERS)}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded bg-[#135DDD] px-4 py-1.5 text-13 font-medium text-white hover:bg-[#0F4FC0]"
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
