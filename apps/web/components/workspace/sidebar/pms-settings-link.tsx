/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";

export function PMSSettingsLink() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const href = `/${workspaceSlug}/pms-settings`;
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={`${href}/account`} aria-current={active ? "page" : undefined}>
      <SidebarNavItem isActive={active} className={active ? "dark:text-custom-primary-100 text-[#135DDD]" : undefined}>
        <div className="flex items-center gap-1.5 py-[1px]">
          <Settings className="size-4 shrink-0" />
          <span className="text-13 leading-5 font-medium">PMS Settings</span>
        </div>
      </SidebarNavItem>
    </Link>
  );
}
