/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { setToast } from "@plane/blocks/toast";
import { useProjectSection } from "@/hooks/store/use-project-section";
import { sectionErrorMessage } from "./errors";
import { SectionIcon } from "./section-icon";

export const SectionSelect = observer(function SectionSelect({
  workspaceSlug,
  projectId,
  value,
  onChange,
  disabled = false,
  useProjectDefault = false,
}: {
  workspaceSlug: string;
  projectId: string;
  value?: string | null;
  onChange: (sectionId: string | null) => Promise<unknown> | void;
  disabled?: boolean;
  useProjectDefault?: boolean;
}) {
  const store = useProjectSection();
  const id = useId();
  const [saving, setSaving] = useState(false);
  const { error, isLoading, mutate } = useSWR(["project-sections", workspaceSlug, projectId], () =>
    store.fetch(workspaceSlug, projectId)
  );
  const sections = store.getSections(workspaceSlug, projectId);
  const selectedValue =
    useProjectDefault && value === undefined ? sections.find((section) => section.is_default)?.id : value;
  const assign = async (sectionId: string | null) => {
    setSaving(true);
    try {
      await onChange(sectionId);
    } catch (cause) {
      console.error("Could not assign work item section", cause);
      setToast({ type: "error", title: "Could not change section", message: sectionErrorMessage(cause) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {selectedValue && <SectionIcon section={sections.find((section) => section.id === selectedValue)} />}
      <select
        aria-label="Section"
        aria-describedby={error ? id : undefined}
        value={selectedValue ?? ""}
        onClick={(event) => event.stopPropagation()}
        disabled={disabled || saving || isLoading || Boolean(error)}
        className="max-w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-12 text-secondary"
        onChange={(event) => void assign(event.target.value || null)}
      >
        <option value="">No section</option>
        {value && !sections.some((section) => section.id === value) && <option value={value}>Current section</option>}
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name}
          </option>
        ))}
      </select>
      {error && (
        <span id={id} role="alert" className="text-12 text-danger-primary">
          Could not load sections.{" "}
          <button type="button" onClick={() => void mutate()}>
            Retry
          </button>
        </span>
      )}
    </div>
  );
});
