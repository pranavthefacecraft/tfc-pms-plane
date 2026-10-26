/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { EmojiPicker } from "@plane/blocks/emoji-icon-picker";
import type { TSectionAppearance } from "@/services/project/project-section.service";
import { SectionIcon } from "./section-icon";

export function SectionAppearance({
  value,
  onChange,
  disabled,
}: {
  value: TSectionAppearance;
  onChange: (value: TSectionAppearance) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <EmojiPicker
        isOpen={open}
        handleToggle={setOpen}
        disabled={disabled}
        iconType="material"
        showEmojiTab={false}
        defaultOpen="icon"
        defaultIconColor={value.icon_color}
        label={
          <span
            aria-label="Choose section icon"
            className="flex items-center gap-2 rounded border border-subtle px-2 py-1 text-13"
          >
            <SectionIcon section={value} />
            Choose section icon
          </span>
        }
        onChange={(selection) => {
          if (selection.type === "icon") {
            onChange({ icon: selection.value.name, icon_color: selection.value.color });
            setOpen(false);
          }
        }}
      />
      <label className="flex items-center gap-2 text-13">
        Icon color
        <input
          aria-label="Section icon color"
          type="color"
          value={value.icon_color}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, icon_color: event.target.value })}
          className="h-8 w-10 cursor-pointer rounded border border-subtle"
        />
      </label>
      {value.icon && (
        <button
          type="button"
          disabled={disabled}
          className="text-13 text-secondary"
          onClick={() => onChange({ ...value, icon: "" })}
        >
          Reset icon
        </button>
      )}
    </div>
  );
}
