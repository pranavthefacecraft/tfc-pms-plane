/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";

export const PMSBilling = observer(function PMSBilling({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceInfoBySlug, allowPermissions } = useUserPermissions();
  const workspaceStore = useWorkspace();
  const workspace = workspaceStore.getWorkspaceBySlug(workspaceSlug);
  const info = workspaceInfoBySlug(workspaceSlug);
  const canView = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  if (!info) return <p role="status">Loading workspace permissions...</p>;
  if (!canView) return <p role="alert">Only workspace admins and members can view billing.</p>;

  return (
    <>
      <div className="border-b border-subtle pb-3">
        <h3 className="text-14 font-semibold">Current plan</h3>
        <p className="mt-1 text-12 text-secondary">Your PMS subscription and usage.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-3">
        <div>
          <p className="text-13 font-medium">Community</p>
          <p className="mt-1 text-12 text-secondary">
            Unlimited projects, issues, cycles, modules, pages, and storage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-12 text-secondary">Free / Self-hosted</span>
          <button type="button" disabled className="cursor-not-allowed text-12 font-medium text-secondary opacity-50">
            Manage Plan
          </button>
        </div>
      </div>
      <dl>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle py-3 text-12">
          <dt className="font-medium">Next payment</dt>
          <dd className="text-secondary">No scheduled payment for Community</dd>
        </div>
      </dl>
      <h3 className="mt-6 border-b border-subtle pb-3 text-14 font-semibold">Payment &amp; invoices</h3>
      <dl className="divide-y divide-subtle border-b border-subtle text-12">
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <dt className="font-medium">Payment method</dt>
          <dd className="text-secondary">Not available in Community</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <dt className="font-medium">Latest invoice</dt>
          <dd className="text-secondary">Not available in Community</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <dt className="font-medium">Billing email</dt>
          <dd className="break-all text-secondary">{workspace?.billing_email || "Not set in Company profile"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-12 text-secondary">
        Plan management is temporarily unavailable. Payments and invoices are not managed inside this self-hosted app.
        Billing email is managed in Company profile.
      </p>
    </>
  );
});
