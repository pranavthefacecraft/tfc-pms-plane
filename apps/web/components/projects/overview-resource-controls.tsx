import { useState } from "react";
import { ArrowDownWideNarrow, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { CheckboxGroup } from "@/components/profile/my-tasks-filters";
import { toggleValue } from "@/components/profile/my-tasks-filters.helpers";

const RESOURCE_TYPES = [
  { id: "attachment", label: "Documents" },
  { id: "image", label: "Images" },
  { id: "link", label: "Links" },
  { id: "video", label: "Videos" },
  { id: "recording", label: "Recordings" },
  { id: "notepad", label: "Notepads" },
  { id: "whiteboard", label: "Whiteboards" },
] as const;
export type ResourceKind = (typeof RESOURCE_TYPES)[number]["id"];

const SORT_OPTIONS = [
  { id: "updated", label: "Last Updated · Newest First" },
  { id: "name", label: "Name · A–Z" },
  { id: "name-desc", label: "Name · Z–A" },
  { id: "newest", label: "Date Added · Newest First" },
  { id: "oldest", label: "Date Added · Oldest First" },
] as const;
export type ResourceSort = (typeof SORT_OPTIONS)[number]["id"];
const triggerClass =
  "inline-flex h-8 items-center gap-1 rounded-md border border-subtle bg-surface-1 px-3 text-12 text-secondary hover:bg-layer-1-hover";

export function OverviewResourceControls({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: {
  filters: ResourceKind[];
  onFiltersChange: (filters: ResourceKind[]) => void;
  sort: ResourceSort;
  onSortChange: (sort: ResourceSort) => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger render={<button type="button" aria-label="Filter resources" className={triggerClass} />}>
          <Filter className="size-3.5" aria-hidden="true" />
          Filter
          {filters.length > 0 && <span className="text-[#135DDD]">{filters.length}</span>}
        </PopoverTrigger>
        <PopoverContent variant="text" align="end" sideOffset={6} aria-label="Filter resources by type">
          <div className="w-44 p-1">
            <CheckboxGroup
              title="Resource Type"
              options={RESOURCE_TYPES}
              selected={filters}
              onToggle={(id) => {
                const option = RESOURCE_TYPES.find((option) => option.id === id);
                if (option) onFiltersChange(toggleValue(filters, option.id));
              }}
            />
            <p className="mt-3 text-12 text-tertiary">No selection shows all resources.</p>
          </div>
        </PopoverContent>
      </Popover>
      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger render={<button type="button" aria-label="Sort resources" className={triggerClass} />}>
          <ArrowDownWideNarrow className="size-3.5" aria-hidden="true" />
          Sort
        </PopoverTrigger>
        <PopoverContent variant="text" align="end" sideOffset={6} aria-label="Sort resources by">
          <div className="w-56">
            <h3 className="px-2 py-1.5 text-12 font-semibold text-primary">Sort By</h3>
            <div role="group" aria-label="Sort order" className="space-y-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={sort === option.id}
                  className={`w-full rounded px-2 py-2 text-left text-12 text-primary hover:bg-layer-1-hover ${
                    sort === option.id ? "bg-[#EAF1FD] dark:bg-layer-2" : ""
                  }`}
                  onClick={() => {
                    onSortChange(option.id);
                    setSortOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
