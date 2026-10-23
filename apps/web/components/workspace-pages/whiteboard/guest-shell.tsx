/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { InboxOutline, PenToolOutline, SearchOutline } from "@makeplane/propel/icons";
import { useLocalStorage, useOutsideClickDetector } from "@plane/hooks";
import { SIDEBAR_WIDTH } from "@plane/constants";
import { GlobalModals } from "@/components/common/modal/global";
import { ResizableSidebar } from "@/components/sidebar/resizable-sidebar";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { UserMenuRoot } from "@/components/workspace/sidebar/user-menu-root";
import { useAppTheme } from "@/hooks/store/use-app-theme";

const RESTRICTED_SECTIONS = ["Home", "Drafts", "Your work", "New work item"];
const RESTRICTED_WORKSPACE_SECTIONS = ["Projects", "Views", "Analytics", "Settings"];
const RESTRICTED_TITLE = "Not available with whiteboard-only guest access";

function RestrictedItem({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title={RESTRICTED_TITLE}
      className="w-full cursor-not-allowed rounded-md border border-transparent px-2 py-1 text-left text-13 font-medium text-tertiary opacity-50"
    >
      {label}
    </button>
  );
}

const GuestSidebar = observer(function GuestSidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { sidebarCollapsed, toggleSidebar } = useAppTheme();
  useOutsideClickDetector(ref, () => {
    if (!sidebarCollapsed && window.innerWidth < 768) toggleSidebar();
  });
  return (
    <aside ref={ref} aria-label="Workspace sidebar" className="flex h-full w-full flex-col gap-3 overflow-y-auto px-3">
      <div className="flex min-h-10 items-center gap-2 pb-3">
        <img src="/tfc-pms-logo.png" alt="TFC PMS" className="size-7 object-contain" />
        <span className="min-w-0 flex-1 truncate text-14 font-semibold">{workspaceSlug}</span>
        <span className="text-12 text-tertiary">Guest</span>
      </div>
      <div className="flex items-center justify-between px-2">
        <span className="text-16 font-medium">Projects</span>
        <AppSidebarToggleButton />
      </div>
      <nav aria-label="Guest workspace navigation" className="space-y-3">
        <div className="flex flex-col gap-0.5">
          {RESTRICTED_SECTIONS.map((label) => (
            <RestrictedItem key={label} label={label} />
          ))}
        </div>
        <div className="space-y-1">
          <h2 className="px-2 text-13 font-semibold text-placeholder">Workspace</h2>
          {RESTRICTED_WORKSPACE_SECTIONS.map((label) => (
            <RestrictedItem key={label} label={label} />
          ))}
        </div>
        <div className="space-y-1">
          <h2 className="px-2 text-13 font-semibold text-placeholder">Tool</h2>
          <RestrictedItem label="Notepad" />
          <SidebarNavItem isActive>
            <span aria-current="page" className="flex items-center gap-1.5 text-13 font-medium">
              <PenToolOutline className="size-4" />
              Whiteboard
            </span>
          </SidebarNavItem>
        </div>
      </nav>
      <p className="mt-auto px-2 py-4 text-12 text-tertiary">Guest access is limited to this shared whiteboard.</p>
    </aside>
  );
});

export const GuestWhiteboardShell = observer(function GuestWhiteboardShell({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: ReactNode;
}) {
  const { sidebarCollapsed, toggleSidebar, sidebarPeek, toggleSidebarPeek, isAnySidebarDropdownOpen } = useAppTheme();
  const { storedValue, setValue } = useLocalStorage("sidebarWidth", SIDEBAR_WIDTH);
  const [width, setWidth] = useState<number>(storedValue ?? SIDEBAR_WIDTH);
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-canvas">
      <GlobalModals workspaceSlug={workspaceSlug} />
      <ResizableSidebar
        showPeek={sidebarPeek}
        togglePeek={toggleSidebarPeek}
        isCollapsed={sidebarCollapsed}
        toggleCollapsed={toggleSidebar}
        width={width}
        setWidth={setWidth}
        onWidthChange={setValue}
        isAnySidebarDropdownOpen={isAnySidebarDropdownOpen}
      >
        <GuestSidebar workspaceSlug={workspaceSlug} />
      </ResizableSidebar>
      <main className="relative isolate flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1">
        <header
          aria-label="Workspace header"
          className="z-[27] flex min-h-10 shrink-0 items-center gap-3 bg-white px-3.5 dark:bg-surface-1"
        >
          {sidebarCollapsed && <AppSidebarToggleButton />}
          <button
            type="button"
            disabled
            title={RESTRICTED_TITLE}
            className="flex items-center gap-2 text-13 text-tertiary opacity-50"
          >
            <SearchOutline className="size-4" />
            Search
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              disabled
              aria-label="Inbox"
              title={RESTRICTED_TITLE}
              className="text-tertiary opacity-50"
            >
              <InboxOutline className="size-5" />
            </button>
            <UserMenuRoot />
          </div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
});
