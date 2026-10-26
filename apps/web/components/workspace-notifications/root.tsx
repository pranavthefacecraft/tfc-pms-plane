/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { useSearchParams } from "react-router";
import { WorkspaceMessageDetail } from "@/components/workspace-messages/message-detail";
// plane imports
import { ENotificationLoader, ENotificationQueryParamType } from "@plane/constants";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { cn } from "@plane/utils";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceIssueProperties } from "@/hooks/use-workspace-issue-properties";
import { useNotificationPreview } from "@/hooks/use-notification-preview";
// local imports
import { InboxContentRoot } from "../inbox/content";

type NotificationsRootProps = {
  workspaceSlug?: string;
};

export const NotificationsRoot = observer(function NotificationsRoot({ workspaceSlug }: NotificationsRootProps) {
  // hooks
  const { currentWorkspace } = useWorkspace();
  const {
    currentSelectedNotificationId,
    setCurrentSelectedNotificationId,
    notificationLiteByNotificationId,
    notificationIdsByWorkspaceId,
    getNotifications,
    notifications,
    getUnreadNotificationsCount,
  } = useWorkspaceNotifications();
  const { fetchUserProjectInfo } = useUserPermissions();
  const { isWorkItem, PeekOverviewComponent, setPeekWorkItem } = useNotificationPreview();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedNotification = currentSelectedNotificationId ? notifications[currentSelectedNotificationId] : undefined;
  const messageId =
    selectedNotification?.entity_name === "workspace_message"
      ? selectedNotification.entity_identifier
      : currentSelectedNotificationId
        ? undefined
        : searchParams.get("message");
  // derived values
  const { workspace_slug, project_id, issue_id, is_inbox_issue } =
    notificationLiteByNotificationId(currentSelectedNotificationId);

  // fetching workspace work item properties
  useWorkspaceIssueProperties(workspaceSlug);

  // fetch workspace notifications
  const notificationMutation =
    currentWorkspace && notificationIdsByWorkspaceId(currentWorkspace.id)
      ? ENotificationLoader.MUTATION_LOADER
      : ENotificationLoader.INIT_LOADER;
  const notificationLoader =
    currentWorkspace && notificationIdsByWorkspaceId(currentWorkspace.id)
      ? ENotificationQueryParamType.CURRENT
      : ENotificationQueryParamType.INIT;
  useSWR(
    currentWorkspace?.slug ? `WORKSPACE_NOTIFICATION_${currentWorkspace?.slug}` : null,
    currentWorkspace?.slug
      ? () => getNotifications(currentWorkspace?.slug, notificationMutation, notificationLoader)
      : null
  );

  // fetching user project member info
  const { isLoading: projectMemberInfoLoader } = useSWR(
    workspace_slug && project_id && is_inbox_issue
      ? `PROJECT_MEMBER_PERMISSION_INFO_${workspace_slug}_${project_id}`
      : null,
    workspace_slug && project_id && is_inbox_issue ? () => fetchUserProjectInfo(workspace_slug, project_id) : null
  );

  const embedRemoveCurrentNotification = useCallback(
    () => setCurrentSelectedNotificationId(undefined),
    [setCurrentSelectedNotificationId]
  );

  // clearing up the selected notifications when unmounting the page
  useEffect(
    () => () => {
      setPeekWorkItem(undefined);
    },
    [setCurrentSelectedNotificationId, setPeekWorkItem]
  );

  return (
    <div className={cn("h-full w-full overflow-hidden", isWorkItem && "overflow-y-auto")}>
      {messageId && workspaceSlug ? (
        <WorkspaceMessageDetail
          key={`${workspaceSlug}:${messageId}`}
          workspaceSlug={workspaceSlug}
          messageId={messageId}
          onRead={() => {
            const notification = Object.values(notifications).find(
              (item) =>
                item.entity_name === "workspace_message" &&
                item.entity_identifier === messageId &&
                item.workspace === currentWorkspace?.id
            );
            if (notification && !notification.read_at)
              notification.mutateNotification({ read_at: new Date().toISOString() });
            void getUnreadNotificationsCount(workspaceSlug).catch((error: unknown) =>
              console.error("Could not refresh unread message count", error)
            );
          }}
          onClose={() => {
            setCurrentSelectedNotificationId(undefined);
            setSearchParams((params) => {
              params.delete("message");
              return params;
            });
          }}
        />
      ) : !currentSelectedNotificationId ? (
        <div className="flex size-full items-center justify-center">
          <EmptyStateCompact assetKey="unknown" assetClassName="size-20" />
        </div>
      ) : (
        <>
          {is_inbox_issue === true && workspace_slug && project_id && issue_id ? (
            <>
              {projectMemberInfoLoader ? (
                <div className="flex h-full w-full items-center justify-center">
                  <LogoSpinner />
                </div>
              ) : (
                <InboxContentRoot
                  setIsMobileSidebar={() => {}}
                  isMobileSidebar={false}
                  workspaceSlug={workspace_slug}
                  projectId={project_id}
                  inboxIssueId={issue_id}
                  isNotificationEmbed
                  embedRemoveCurrentNotification={embedRemoveCurrentNotification}
                />
              )}
            </>
          ) : (
            <PeekOverviewComponent embedIssue embedRemoveCurrentNotification={embedRemoveCurrentNotification} />
          )}
        </>
      )}
    </div>
  );
});
