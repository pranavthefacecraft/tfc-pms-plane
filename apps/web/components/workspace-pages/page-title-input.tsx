/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { TNameDescriptionLoader } from "@plane/types";
// services
import type { TWorkspacePage } from "@/services/page/workspace-page.service";

type Props = {
  page: TWorkspacePage;
  onSave: (name: string) => Promise<unknown>;
  setSaveStatus: (status: TNameDescriptionLoader) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function WorkspaceToolPageTitleInput({
  page,
  onSave,
  setSaveStatus,
  className = "",
  placeholder = "Untitled",
  disabled = false,
}: Props) {
  const [title, setTitle] = useState(page.name);
  const lastSavedTitle = useRef(page.name);

  // Only sync the title when a different page is loaded so autosave responses don't overwrite typing.
  useEffect(() => {
    setTitle(page.name);
    lastSavedTitle.current = page.name;
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  const saveTitle = async () => {
    if (title === lastSavedTitle.current) return;
    setSaveStatus("submitting");
    try {
      await onSave(title);
      lastSavedTitle.current = title;
    } catch {
      // error toast is shown by the caller
    } finally {
      setSaveStatus("submitted");
    }
  };

  return (
    <textarea
      value={title}
      onChange={(event) => setTitle(event.target.value.replace(/\n/g, ""))}
      onBlur={() => void saveTitle()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      maxLength={255}
      aria-label="Title"
      className={`w-full resize-none bg-transparent leading-tight font-bold text-primary outline-none placeholder:text-placeholder ${className}`}
    />
  );
}
