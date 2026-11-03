/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Grid2X2, NotebookTabs, SquarePen } from "lucide-react";
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";

const TOOL_ITEMS = [
  { key: "pages", label: "Notepad", path: "tool/pages", icon: NotebookTabs, tile: "bg-[#EAF1FD] text-[#135DDD]" },
  {
    key: "whiteboards",
    label: "Whiteboard",
    path: "tool/whiteboards",
    icon: SquarePen,
    tile: "bg-[#FDF1C7] text-[#A86A00]",
  },
];

/** Figma "Tools" sidebar item: clicking it opens a flyout to the right with Notepad and Whiteboard. */
export const SidebarToolMenu = observer(function SidebarToolMenu() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { toggleSidebar, isExtendedSidebarOpened, toggleExtendedSidebar } = useAppTheme();

  const handleLinkClick = () => {
    setOpen(false);
    if (window.innerWidth < 768) toggleSidebar();
    if (isExtendedSidebarOpened) toggleExtendedSidebar(false);
  };

  const tools = TOOL_ITEMS.map((item) => {
    const href = `/${workspaceSlug?.toString()}/${item.path}/`;
    const isActive =
      pathname.startsWith(href.slice(0, -1)) ||
      (item.key === "whiteboards" && pathname.startsWith(`/${workspaceSlug}/tool/shared-whiteboards/`));
    return { key: item.key, label: item.label, icon: item.icon, tile: item.tile, href, isActive };
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className="w-full text-left outline-none" />}>
        <SidebarNavItem isActive={open || tools.some((tool) => tool.isActive)}>
          <div className="flex items-center gap-1.5 py-[1px]">
            <Grid2X2 className="size-4 flex-shrink-0" />
            <p className="text-13 leading-5 font-medium">Tools</p>
          </div>
        </SidebarNavItem>
      </PopoverTrigger>
      <PopoverContent variant="rich" side="right" align="start" sideOffset={12}>
        <nav aria-label="Tools" className="flex w-56 flex-col gap-1">
          {tools.map(({ key, href, label, icon: Icon, tile, isActive }) => (
            <Link
              key={key}
              href={href}
              onClick={handleLinkClick}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-14 font-semibold text-primary hover:bg-layer-1-hover ${isActive ? "bg-layer-1" : ""}`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-md ${tile}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  );
});
