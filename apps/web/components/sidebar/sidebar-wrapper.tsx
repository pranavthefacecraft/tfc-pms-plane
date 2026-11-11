/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { PreferencesOutline } from "@makeplane/propel/icons";
import { ScrollArea } from "@makeplane/propel/components/scroll-area";
// components
import { CustomizeNavigationDialog } from "@/components/navigation/customize-navigation-dialog";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
// plane web components
import { WorkspaceEditionBadge } from "@/components/workspace/edition-badge";
import { AppSidebarToggleButton } from "./sidebar-toggle-button";
import { SidebarFooter } from "./sidebar-footer";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";

type TSidebarWrapperProps = {
  title: string;
  children: React.ReactNode;
  quickActions?: React.ReactNode;
  header?: React.ReactNode;
  compact?: boolean;
};

export const SidebarWrapper = observer(function SidebarWrapper(props: TSidebarWrapperProps) {
  const { title, children, quickActions, header, compact = false } = props;
  // translation
  const { t } = useTranslation();
  // state
  const [isCustomizeNavDialogOpen, setIsCustomizeNavDialogOpen] = useState(false);
  // store hooks
  const { toggleSidebar, sidebarCollapsed } = useAppTheme();
  // refs
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClickDetector(ref, () => {
    if (sidebarCollapsed === false && window.innerWidth < 768) {
      toggleSidebar();
    }
  });

  if (compact) {
    return (
      <div className="flex h-full w-full flex-col" data-sidebar-compact>
        <div className="flex shrink-0 justify-center pb-3">
          <img
            src="/clevdex-sidebar-icon.png"
            alt="PMS by Clevdex"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
        </div>
        <nav aria-label={title} className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-2">
          {children}
        </nav>
        <SidebarFooter compact />
      </div>
    );
  }

  return (
    <>
      <CustomizeNavigationDialog isOpen={isCustomizeNavDialogOpen} onClose={() => setIsCustomizeNavDialogOpen(false)} />
      <div ref={ref} className="flex h-full w-full animate-fade-in flex-col">
        {header && (
          <div className="mb-3 flex shrink-0 flex-col gap-3 px-3 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 rounded-md bg-white">
                <img
                  src="/clevdex-pms-lockup.svg"
                  alt="PMS by Clevdex"
                  width={184}
                  height={40}
                  className="h-auto max-w-full"
                />
              </div>
              <div className="shrink-0">
                <AppSidebarToggleButton />
              </div>
            </div>
            {/* Keep the workspace switcher mounted for future use, but hide it from the sidebar. */}
            <div hidden className="hidden">
              {header}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 px-3">
          {/* Workspace switcher and settings */}

          {/* Retain the Projects heading and customization control for future use. */}
          <div
            hidden={title === "Projects"}
            className={title === "Projects" ? "hidden" : "flex items-center justify-between gap-2 px-2"}
          >
            <span className="pt-1 text-16 font-medium text-primary">{title}</span>
            <div className="flex items-center gap-2">
              {title === "Projects" && (
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon={<Icon icon={PreferencesOutline} />}
                  aria-label={t("customize_navigation")}
                  onClick={() => setIsCustomizeNavDialogOpen(true)}
                />
              )}
              {!header && <AppSidebarToggleButton />}
            </div>
          </div>
          {/* Quick actions */}
          {quickActions}
        </div>

        <div className="min-h-0 flex-1">
          <ScrollArea orientation="vertical">
            <div className="flex flex-col gap-3 overflow-x-hidden px-3 pt-3 pb-0.5">{children}</div>
          </ScrollArea>
        </div>
        <SidebarFooter />
        {/* Community footer is temporarily hidden; retain it for later use. */}
        <div hidden className="hidden h-12 items-center justify-between border-t border-subtle bg-surface-1 p-3">
          <WorkspaceEditionBadge />
          {/* TODO: To be checked if we need this */}
          {/* <div className="flex items-center gap-2">
          {!shouldRenderAppRail && <HelpMenu />}
          {!isAppRailEnabled && <AppSidebarToggleButton />}
        </div> */}
        </div>
      </div>
    </>
  );
});
