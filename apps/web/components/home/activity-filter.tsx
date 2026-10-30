import { useState } from "react";
import { Filter } from "lucide-react";
import sortBy from "lodash-es/sortBy";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import type { TOverviewTask, TActivityFilter } from "./activity-overview.helpers";
import { defaultActivityFilter } from "./activity-overview.helpers";

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1.5 text-12">
      <input type="checkbox" className="size-3.5 accent-[#135DDD]" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function ActivityFilter({
  tasks,
  value,
  onApply,
}: {
  tasks: TOverviewTask[];
  value: TActivityFilter;
  onApply: (value: TActivityFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const excludedProjects = new Set(draft.excludedProjects);
  const projects = sortBy(
    Array.from(
      new Map(
        tasks.flatMap((task) => (task.project ? [[task.project.project_id, task.project.project_name] as const] : []))
      ).entries()
    ),
    ([, name]) => name.toLocaleLowerCase()
  );
  const active = !value.pms || !value.personal || !value.company || value.excludedProjects.length > 0;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-12 ${active ? "border-[#135DDD] bg-[#EAF2FF] text-[#135DDD]" : "border-subtle"}`}
          />
        }
      >
        <Filter className="size-3.5" aria-hidden="true" />
        {active ? "Filter (active)" : "Filter"}
      </PopoverTrigger>
      <PopoverContent
        variant="text"
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Filter Activity"
      >
        <div className="flex max-h-[min(460px,70vh)] flex-col gap-3 overflow-y-auto">
          <h3 className="text-13 font-semibold">Filter Activity</h3>
          <fieldset>
            <legend className="text-11 text-secondary uppercase">Source</legend>
            <FilterCheckbox label="PMS" checked={draft.pms} onChange={() => setDraft({ ...draft, pms: !draft.pms })} />
          </fieldset>
          <fieldset>
            <legend className="text-11 text-secondary uppercase">Project Name</legend>
            {projects.length ? (
              projects.map(([id, name]) => (
                <FilterCheckbox
                  key={id}
                  label={name}
                  checked={!excludedProjects.has(id)}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      excludedProjects: excludedProjects.has(id)
                        ? draft.excludedProjects.filter((item) => item !== id)
                        : [...draft.excludedProjects, id],
                    })
                  }
                />
              ))
            ) : (
              <p className="py-2 text-12 text-secondary">No project tasks today.</p>
            )}
          </fieldset>
          <fieldset>
            <legend className="text-11 text-secondary uppercase">Account</legend>
            <FilterCheckbox
              label="Personal"
              checked={draft.personal}
              onChange={() => setDraft({ ...draft, personal: !draft.personal })}
            />
            <FilterCheckbox
              label="Company"
              checked={draft.company}
              onChange={() => setDraft({ ...draft, company: !draft.company })}
            />
          </fieldset>
          <div className="flex items-center justify-between border-t border-subtle pt-2">
            <button type="button" className="text-12 underline" onClick={() => setDraft(defaultActivityFilter)}>
              Reset
            </button>
            <button
              type="button"
              className="rounded bg-[#135DDD] px-3 py-1 text-12 text-white"
              onClick={() => {
                onApply(draft);
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
