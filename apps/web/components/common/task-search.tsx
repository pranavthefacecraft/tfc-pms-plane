/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/** A search icon button that expands into a task name search field. */
export function TaskSearch({ query, setQuery }: { query: string; setQuery: (query: string) => void }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  if (!open && !query)
    return (
      <button
        type="button"
        aria-label="Open search"
        title="Search tasks"
        className="grid size-8 place-items-center rounded border border-subtle hover:bg-layer-1-hover"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
      </button>
    );
  return (
    <label className="flex h-8 items-center gap-2 rounded border border-[#135DDD] px-2">
      <Search className="size-3.5" />
      <input
        ref={inputRef}
        aria-label="Search tasks"
        placeholder="Search tasks..."
        className="w-48 bg-transparent text-12 outline-none"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          setQuery("");
          setOpen(false);
        }}
      />
    </label>
  );
}
