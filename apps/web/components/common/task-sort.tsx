import { ListOrdered } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@makeplane/propel/components/menu";

const SORT_OPTIONS = [
  { value: "default", label: "Default order" },
  { value: "due-asc", label: "Due date (earliest first)" },
  { value: "due-desc", label: "Due date (latest first)" },
  { value: "expired", label: "Due date (expired)" },
  { value: "name", label: "Name (A–Z)" },
  { value: "updated", label: "Last updated (newest first)" },
] as const;

export type TaskSortOrder = (typeof SORT_OPTIONS)[number]["value"];

type SortableTask = { name: string; due: string | null; completed: boolean; updatedAt?: string };

export function sortTasks<T>(tasks: T[], order: TaskSortOrder, today: string, getTask: (item: T) => SortableTask): T[] {
  if (order === "default") return tasks;
  const sorted = tasks.map((item) => {
    const task = getTask(item);
    const updated = task.updatedAt ? Date.parse(task.updatedAt) : NaN;
    return {
      item,
      ...task,
      expired: Boolean(task.due && task.due < today && !task.completed),
      updated: Number.isFinite(updated) ? updated : -Infinity,
    };
  });
  // oxlint-disable-next-line unicorn/no-array-sort -- sort a fresh copy; the web target lacks toSorted.
  sorted.sort((a, b) => {
    if (order === "name") return a.name.localeCompare(b.name);
    if (order === "updated") return a.updated === b.updated ? 0 : b.updated - a.updated;
    if (order === "expired") {
      if (a.expired !== b.expired) return Number(b.expired) - Number(a.expired);
      if (!a.expired) return 0;
    }
    if (!a.due || !b.due) return Number(!a.due) - Number(!b.due);
    return order === "due-desc" ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due);
  });
  return sorted.map(({ item }) => item);
}

export function TaskSortMenu({ value, onChange }: { value: TaskSortOrder; onChange: (value: TaskSortOrder) => void }) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 min-w-[92px] cursor-pointer items-center justify-center gap-2 rounded-md border border-subtle bg-white px-3 text-14 hover:bg-layer-1-hover dark:bg-surface-1"
          >
            <ListOrdered aria-hidden="true" className="size-3.5" />
            Sort
          </button>
        }
      />
      <MenuContent align="end" sizing="auto">
        <MenuGroup>
          <MenuLabel>Sort By</MenuLabel>
          <MenuRadioGroup
            marker="radio"
            value={value}
            onValueChange={(next) => {
              const option = SORT_OPTIONS.find((item) => item.value === next);
              if (option) onChange(option.value);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuRadioItem key={option.value} value={option.value} label={option.label} closeOnClick />
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
