/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/** A search icon button that expands into a search field; `noun` names what is searched (tasks by default). */
export function TaskSearch({
  query,
  setQuery,
  noun = "tasks",
  spacious = false,
}: {
  query: string;
  setQuery: (query: string) => void;
  noun?: string;
  spacious?: boolean;
}) {
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
        title={`Search ${noun}`}
        className={`grid shrink-0 place-items-center border border-subtle hover:bg-layer-1-hover ${spacious ? "size-9 rounded-md bg-white dark:bg-surface-1" : "size-8 rounded"}`}
        onClick={() => setOpen(true)}
      >
        <Search className={spacious ? "size-4" : "size-3.5"} />
      </button>
    );
  return (
    <label
      className={`flex items-center gap-2 border border-[#135DDD] px-2 ${spacious ? "h-9 rounded-md bg-white dark:bg-surface-1" : "h-8 rounded"}`}
    >
      <Search className="size-3.5" />
      <input
        ref={inputRef}
        aria-label={`Search ${noun}`}
        placeholder={`Search ${noun}...`}
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
