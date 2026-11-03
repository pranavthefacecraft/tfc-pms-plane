/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { setToast } from "@plane/blocks/toast";
import { sectionErrorMessage } from "@/components/project-sections/errors";

/** Inline "+ Add Stage" control shared by the project List and Board tabs; a stage is a project section. */
export function AddStage({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const close = () => {
    setEditing(false);
    setName("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate(name.trim());
      setToast({ type: "success", title: "Stage added" });
      close();
    } catch (error) {
      setToast({ type: "error", title: "Could not add stage", message: sectionErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-5 inline-flex items-center gap-1.5 px-5 text-12 text-[#135DDD] hover:underline"
      >
        <Plus className="size-3.5" />
        Add Stage
      </button>
    );
  return (
    <form onSubmit={(event) => void submit(event)} className="mt-5 flex items-center gap-2">
      <input
        ref={inputRef}
        aria-label="Stage name"
        placeholder="Stage name"
        maxLength={255}
        value={name}
        disabled={saving}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className="h-8 w-56 rounded border border-[#135DDD] bg-surface-1 px-2 text-13 outline-none"
      />
      <button
        type="submit"
        disabled={!name.trim() || saving}
        className="h-8 rounded bg-[#135DDD] px-3 text-12 font-medium text-white disabled:opacity-50"
      >
        Add
      </button>
      <button type="button" onClick={close} className="h-8 px-2 text-12 text-secondary hover:text-primary">
        Cancel
      </button>
    </form>
  );
}
