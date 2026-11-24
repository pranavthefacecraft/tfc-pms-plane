/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { CalendarDays, Check, Plus, UserRound } from "lucide-react";
import { LogOutOutline, SettingsOutline } from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { GOD_MODE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { getFileURL, getFirstCharacters, orderWorkspacesList } from "@plane/utils";
import type { IWorkspace } from "@plane/types";
// components
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useUser, useUserProfile } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useInstance } from "@/hooks/store/use-instance";
import { OutOfOfficeDialog, OutOfOfficeStatus } from "./out-of-office";

export const UserMenuRoot = observer(function UserMenuRoot({ showInitial = false }: { showInitial?: boolean }) {
  // states
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [outOfOfficeOpen, setOutOfOfficeOpen] = useState(false);
  // router
  const router = useRouter();
  // store hooks
  const { toggleAnySidebarDropdown } = useAppTheme();
  const { data: currentUser } = useUser();
  const { signOut } = useUser();
  const { currentWorkspace, workspaces } = useWorkspace();
  const { updateUserProfile } = useUserProfile();
  const { config } = useInstance();
  const orderedWorkspaces = orderWorkspacesList(Object.values(workspaces ?? {}));
  const workspacesList = currentWorkspace
    ? [currentWorkspace, ...orderedWorkspaces.filter((workspace) => workspace.id !== currentWorkspace.id)]
    : orderedWorkspaces;
  // derived values
  const isUserInstanceAdmin = false;
  const userInitial = Array.from(
    currentUser?.first_name?.trim() || currentUser?.display_name?.trim() || currentUser?.email?.trim() || ""
  )[0]?.toUpperCase();
  const profileInitials =
    [currentUser?.first_name, currentUser?.last_name]
      .map((name) => Array.from(name?.trim() || "")[0] || "")
      .join("")
      .toUpperCase() || userInitial;
  const displayName =
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") ||
    currentUser?.display_name ||
    currentUser?.email ||
    "";
  // translation
  const { t } = useTranslation();

  const handleSignOut = () => {
    signOut().catch(() =>
      setToast({
        type: "error",
        title: t("auth.sign_out.toast.error.title"),
        message: t("auth.sign_out.toast.error.message"),
      })
    );
  };

  const switchWorkspace = async (workspace: IWorkspace) => {
    if (switching) return;
    if (workspace.id === currentWorkspace?.id) {
      setIsUserMenuOpen(false);
      return;
    }
    setSwitching(true);
    setSwitchError("");
    try {
      const saved = await updateUserProfile({ last_workspace_id: workspace.id });
      if (!saved) throw new Error("Workspace preference could not be saved");
      router.push(`/${workspace.slug}`);
      setIsUserMenuOpen(false);
    } catch (cause) {
      console.error("Workspace switching failed", cause);
      const message = "Could not switch workspace. Please try again.";
      setSwitchError(message);
      setToast({ type: "error", title: "Workspace switch failed", message });
    } finally {
      setSwitching(false);
    }
  };

  // Toggle sidebar dropdown state when menu is open
  useEffect(() => {
    if (isUserMenuOpen) toggleAnySidebarDropdown(true);
    else toggleAnySidebarDropdown(false);
  }, [isUserMenuOpen, toggleAnySidebarDropdown]);

  return (
    <div className="flex items-center">
      <Menu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
        {/* propel: `AppSidebarItem` takes no arbitrary props, so it cannot be the Base UI trigger
            — the popup would have no element to anchor to. The trigger is a plain button wearing
            the same chrome, with the item's own icon part inside it. */}
        <MenuTrigger
          render={
            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-0.5 text-tertiary"
              aria-label={t("aria_labels.projects_sidebar.open_user_menu")}
            >
              {showInitial ? (
                <span className="flex size-8 items-center justify-center rounded-full bg-[#135DDD] text-14 font-medium text-white">
                  {userInitial}
                </span>
              ) : (
                <AppSidebarItem.Icon
                  icon={
                    <Avatar
                      alt={currentUser?.display_name}
                      fallback={currentUser?.display_name?.[0]?.toUpperCase()}
                      src={getFileURL(currentUser?.avatar_url ?? "")}
                      size="xs"
                    />
                  }
                  highlight={isUserMenuOpen}
                />
              )}
            </button>
          }
        />
        <BaseMenu.Portal>
          <BaseMenu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={16} className="z-30">
            <BaseMenu.Popup className="shadow-lg max-h-[var(--available-height)] overflow-y-auto rounded-lg border border-subtle bg-surface-1 outline-none">
              <div className="grid w-[640px] max-w-[calc(100vw-2rem)] grid-cols-1 min-[480px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="min-w-0 border-b border-subtle bg-[#F8FAFC] p-3 min-[480px]:border-r min-[480px]:border-b-0 dark:bg-surface-2">
                  <h2 className="mb-2 px-1 text-13 font-semibold text-primary">Accounts</h2>
                  <div aria-label="Workspaces" className="max-h-64 space-y-1 overflow-y-auto">
                    {workspacesList.map((workspace) => {
                      const active = workspace.id === currentWorkspace?.id;
                      return (
                        <BaseMenu.Item
                          key={workspace.id}
                          closeOnClick={false}
                          disabled={switching}
                          aria-current={active ? "page" : undefined}
                          onClick={() => void switchWorkspace(workspace)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none data-highlighted:bg-layer-1-hover ${active ? "dark:text-custom-primary-100 bg-[#EAF2FF] text-[#135DDD] dark:bg-layer-1" : "text-primary"}`}
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-5 shrink-0 place-items-center rounded-full bg-[#135DDD] text-9 font-medium text-white"
                          >
                            {getFirstCharacters(workspace.name).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-12 font-medium">{workspace.name}</span>
                          {active && <Check className="size-3.5 shrink-0 text-[#135DDD]" aria-hidden="true" />}
                        </BaseMenu.Item>
                      );
                    })}
                    {workspacesList.length === 0 && (
                      <p className="px-3 py-2 text-12 text-secondary">No workspaces available.</p>
                    )}
                  </div>
                  {switching && (
                    <p role="status" className="px-2 text-12 text-secondary">
                      Switching workspace...
                    </p>
                  )}
                  {switchError && (
                    <p role="alert" className="px-2 text-12 text-danger-primary">
                      {switchError}
                    </p>
                  )}
                </div>
                <div className="min-w-0 p-3">
                  <div className="flex items-center gap-3 px-1 py-1">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#135DDD] text-12 font-medium text-white"
                    >
                      {profileInitials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-13 font-semibold text-primary">{displayName}</p>
                      <p className="mt-0.5 truncate text-12 text-tertiary">{currentUser?.email}</p>
                    </div>
                  </div>
                  <div className="px-1">
                    <OutOfOfficeStatus />
                  </div>
                  <BaseMenu.Item
                    className="my-2 flex w-full items-center justify-center gap-1 rounded-full border border-subtle px-3 py-1.5 text-12 text-secondary outline-none data-highlighted:bg-layer-1-hover"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setOutOfOfficeOpen(true);
                    }}
                  >
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    Set out of office
                  </BaseMenu.Item>
                  <div className="space-y-1 border-t border-subtle pt-2">
                    {!config?.is_workspace_creation_disabled && (
                      <MenuItem
                        icon={<Plus className="size-4 text-[#135DDD]" />}
                        label="Add another account"
                        render={<Link href="/create-workspace" />}
                      />
                    )}
                    {currentWorkspace && currentUser?.id && (
                      <MenuItem
                        icon={<UserRound className="size-4" />}
                        label="Profile"
                        render={<Link href={`/${currentWorkspace.slug}/profile/${currentUser.id}`} />}
                      />
                    )}
                    <MenuItem
                      icon={<Icon icon={SettingsOutline} />}
                      label="Settings"
                      onClick={() =>
                        router.push(
                          currentWorkspace
                            ? `/${currentWorkspace.slug}/pms-settings/account`
                            : "/settings/profile/general"
                        )
                      }
                    />
                  </div>
                  <div className="mt-2 space-y-1 border-t border-subtle pt-2">
                    {workspacesList[0] && (
                      <MenuItem
                        label="All accounts activity →"
                        render={<Link href={`/${workspacesList[0].slug}/all-accounts-activity`} />}
                      />
                    )}
                    <MenuItem label={t("workspace_invites")} render={<Link href="/invitations" />} />
                    <MenuItem icon={<Icon icon={LogOutOutline} />} label={t("sign_out")} onClick={handleSignOut} />
                    {isUserInstanceAdmin && (
                      <MenuItem
                        variant="accent"
                        label={t("enter_god_mode")}
                        onClick={() => router.push(GOD_MODE_URL)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      </Menu>
      {outOfOfficeOpen && <OutOfOfficeDialog onClose={() => setOutOfOfficeOpen(false)} />}
    </div>
  );
});
