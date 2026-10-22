/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// helpers
import { cn } from "@plane/utils";
import {
  SIDEBAR_NAV_ITEM_ACTIVE_CLASSNAME,
  SIDEBAR_NAV_ITEM_INTERACTION_CLASSNAME,
} from "@/components/sidebar/sidebar-navigation";

type Props = {
  children: React.ReactNode;
  elementRef: React.RefObject<HTMLDivElement | null>;
  isMenuActive?: boolean;
};

export function FavoriteItemWrapper(props: Props) {
  const { children, elementRef, isMenuActive = false } = props;
  return (
    <>
      <div
        ref={elementRef}
        className={cn(
          "group/project-item relative flex w-full items-center rounded-md px-2 py-1.5 text-primary",
          SIDEBAR_NAV_ITEM_INTERACTION_CLASSNAME,
          {
            [SIDEBAR_NAV_ITEM_ACTIVE_CLASSNAME]: isMenuActive,
          }
        )}
      >
        {children}
      </div>
    </>
  );
}
