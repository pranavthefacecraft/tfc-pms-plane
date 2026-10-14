/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { PagesOutline, ToolOutline } from "@makeplane/propel/icons";
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import useLocalStorage from "@/hooks/use-local-storage";

const TOOL_ITEMS = [{ key: "pages", label: "Pages", path: "tool/pages", icon: PagesOutline }];

export const SidebarToolMenu = observer(function SidebarToolMenu() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const { setValue: setIsOpen, storedValue: isOpen } = useLocalStorage<boolean>("is_tool_menu_open", true);
  const { toggleSidebar, isExtendedSidebarOpened, toggleExtendedSidebar } = useAppTheme();

  const handleLinkClick = () => {
    if (window.innerWidth < 768) toggleSidebar();
    if (isExtendedSidebarOpened) toggleExtendedSidebar(false);
  };

  return (
    <Collapsible
      placement="sidebar"
      open={!!isOpen}
      onOpenChange={(open) => setIsOpen(open)}
      trigger={
        <span className="flex items-center gap-1.5 text-13 font-semibold whitespace-nowrap text-placeholder">
          <ToolOutline className="size-3.5" />
          Tool
        </span>
      }
    >
      <div className="flex flex-col gap-0.5">
        {TOOL_ITEMS.map((item) => {
          const href = `/${workspaceSlug?.toString()}/${item.path}/`;
          const Icon = item.icon;
          return (
            <Link key={item.key} href={href} onClick={handleLinkClick}>
              <SidebarNavItem isActive={pathname.startsWith(href.slice(0, -1))}>
                <div className="flex items-center gap-1.5 py-[1px]">
                  <Icon className="size-4 flex-shrink-0" />
                  <p className="text-13 leading-5 font-medium">{item.label}</p>
                </div>
              </SidebarNavItem>
            </Link>
          );
        })}
      </div>
    </Collapsible>
  );
});
