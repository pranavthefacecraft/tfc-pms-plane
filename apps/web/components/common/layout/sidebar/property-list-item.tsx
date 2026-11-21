/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { cn } from "@plane/utils";

export const taskDetailLabelClass =
  "font-['Inter_Variable',Inter,sans-serif] text-[14px] leading-5 font-medium tracking-normal text-[#6B7E99]";

type TSidebarPropertyListItemProps = {
  icon?: React.FC<{ className?: string }>;
  appearance?: "task-detail";
  label: string;
  children: ReactNode;
  appendElement?: ReactNode;
  childrenClassName?: string;
};

export function SidebarPropertyListItem(props: TSidebarPropertyListItemProps) {
  const { icon: Icon, appearance, label, children, appendElement, childrenClassName } = props;

  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "flex min-h-7.5 w-30 shrink-0 items-center gap-1.5",
          appearance === "task-detail" ? taskDetailLabelClass : "text-body-xs-regular text-tertiary"
        )}
      >
        {Icon && appearance !== "task-detail" && <Icon aria-hidden="true" className="size-4 shrink-0" />}
        <span>{label}</span>
        {appendElement}
      </div>
      <div className={cn("flex grow flex-wrap items-center gap-1", childrenClassName)}>{children}</div>
    </div>
  );
}
