/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ChevronDown } from "lucide-react";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@makeplane/propel/components/menu";

type Choice<T extends string> = { id: T; label: string };

export function TaskDetailChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  busy,
  valueClassName,
  showChevron = true,
  testId,
}: {
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  disabled: boolean;
  busy?: boolean;
  valueClassName?: string;
  showChevron?: boolean;
  testId?: string;
}) {
  const selectedLabel = options.find((option) => option.id === value)?.label;
  const display = (
    <span className={`min-w-0 truncate ${valueClassName ?? "text-body-sm-regular text-primary"}`}>{selectedLabel}</span>
  );
  if (disabled) return display;

  return (
    <Menu>
      <MenuTrigger
        disabled={busy}
        render={
          <button
            type="button"
            data-testid={testId}
            aria-label={`${label}: ${selectedLabel}`}
            className="inline-flex min-h-7.5 max-w-full items-center gap-1 rounded-md text-primary hover:bg-layer-transparent-hover disabled:cursor-wait"
          >
            {display}
            {showChevron && <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />}
          </button>
        }
      />
      <MenuContent align="start">
        <MenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const option = options.find(({ id }) => id === next);
            if (option && option.id !== value) onChange(option.id);
          }}
        >
          {options.map((option) => (
            <MenuRadioItem key={option.id} value={option.id} label={option.label} closeOnClick />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
