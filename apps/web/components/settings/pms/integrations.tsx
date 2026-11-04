/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";

const unavailableRow = (label: string) => (
  <div key={label} className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-4 text-12">
    <dt className="font-medium">{label}</dt>
    <dd className="text-secondary">Not available in this edition</dd>
  </div>
);

export const PMSIntegrations = observer(function PMSIntegrations({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceInfoBySlug, allowPermissions } = useUserPermissions();
  const info = workspaceInfoBySlug(workspaceSlug);
  const canView = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  if (!info) return <p role="status">Loading workspace permissions...</p>;
  if (!canView) return <p role="alert">Only workspace admins and members can view integrations.</p>;
  return (
    <>
      <div className="border-b border-subtle pb-3">
        <h3 className="text-14 font-semibold">Connected apps</h3>
        <p className="mt-1 text-12 text-secondary">Keep your schedules in sync.</p>
      </div>
      <dl>{["Google Calendar", "Microsoft Outlook"].map(unavailableRow)}</dl>
      <h3 className="mt-6 border-b border-subtle pb-3 text-14 font-semibold">Files &amp; collaboration</h3>
      <dl>
        {["Google Drive", "Microsoft OneDrive"].map(unavailableRow)}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-4 text-12">
          <dt className="font-medium">API access</dt>
          <dd className="flex items-center gap-2">
            <span className="text-secondary">Personal API tokens</span>
            <Link href="/settings/profile/api-tokens" className="text-[#135DDD] hover:underline">
              View
            </Link>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-12 text-secondary">
        Calendar and cloud-drive connections are not implemented in this self-hosted edition.
      </p>
      {isAdmin && (
        <Link
          href={`/${workspaceSlug}/settings/integrations`}
          className="mt-3 inline-block text-12 text-[#135DDD] hover:underline"
        >
          Existing workspace integrations
        </Link>
      )}
    </>
  );
});
