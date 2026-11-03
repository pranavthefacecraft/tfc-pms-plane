/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";

export const SIDEBAR_NAV_ITEM_INTERACTION_CLASSNAME =
  "border border-transparent hover:border-[#CBDCF8] hover:bg-[#EAF2FF] dark:hover:border-transparent dark:hover:bg-layer-transparent-hover";
export const SIDEBAR_NAV_ITEM_ACTIVE_CLASSNAME =
  "border-[#CBDCF8] bg-[#EAF2FF] dark:border-transparent dark:bg-layer-transparent-active";

type TSidebarNavItem = {
  className?: string;
  isActive?: boolean;
  children?: React.ReactNode;
};

export function SidebarNavItem(props: TSidebarNavItem) {
  const { className, isActive, children } = props;
  return (
    <div
      className={cn(
        "group relative flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1 outline-none",
        SIDEBAR_NAV_ITEM_INTERACTION_CLASSNAME,
        {
          [SIDEBAR_NAV_ITEM_ACTIVE_CLASSNAME]: isActive,
          "text-primary": isActive,
          "text-[#344867] dark:text-secondary": !isActive,
        },
        className
      )}
    >
      {children}
    </div>
  );
}
