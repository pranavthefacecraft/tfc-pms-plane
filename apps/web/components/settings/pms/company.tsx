/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { IWorkspace } from "@plane/types";
import { setToast } from "@plane/blocks/toast";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { TimezoneSelect } from "@/components/global/timezone-select";

const companyFields = {
  name: { label: "Company name", action: "Change", type: "text", maxLength: 80 },
  website: { label: "Website", action: "Change", type: "url", maxLength: 2048 },
  billing_email: { label: "Billing contact", action: "Edit", type: "email", maxLength: 254 },
  timezone: { label: "Time zone", action: "Change", type: "text", maxLength: 255 },
  currency: { label: "Currency", action: "Change", type: "text", maxLength: 3 },
} as const;
type CompanyField = keyof typeof companyFields;

export const PMSCompany = observer(function PMSCompany({ workspaceSlug }: { workspaceSlug: string }) {
  const workspaceStore = useWorkspace();
  const { workspaceInfoBySlug, allowPermissions } = useUserPermissions();
  const workspace = workspaceStore.getWorkspaceBySlug(workspaceSlug);
  const info = workspaceInfoBySlug(workspaceSlug);
  const canView = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const canEdit = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const [editing, setEditing] = useState<CompanyField | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!info) return <p role="status">Loading workspace permissions...</p>;
  if (!canView) return <p role="alert">Only workspace admins and members can view company details.</p>;
  if (!workspace) return <p role="alert">Company details could not be loaded. Reload the page to try again.</p>;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || busy) return;
    if (!canEdit) {
      setError("Only workspace admins can change company details.");
      return;
    }
    const value = draft.trim();
    const data: Partial<IWorkspace> = { [editing]: value };
    setBusy(true);
    setError("");
    try {
      await workspaceStore.updateWorkspace(workspaceSlug, data);
      setEditing(null);
      setToast({ type: "success", title: "Company details saved", message: "Your workspace has been updated." });
    } catch (cause) {
      console.error("PMS company update failed", cause);
      const message = "Could not save company details. Check the value and your permissions, then try again.";
      setError(message);
      setToast({ type: "error", title: "Could not save changes", message });
    } finally {
      setBusy(false);
    }
  };
  const row = (field: CompanyField) => {
    const details = companyFields[field];
    const isEditing = canEdit && editing === field;
    return (
      <div key={field} className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-4">
        <dt className="text-12 font-medium">{details.label}</dt>
        <dd className="max-w-full min-w-0">
          {isEditing ? (
            <form onSubmit={save} aria-label={`Edit ${details.label}`} className="flex flex-wrap items-center gap-2">
              {field === "timezone" ? (
                <TimezoneSelect
                  value={draft}
                  onChange={setDraft}
                  disabled={busy}
                  label="Company time zone"
                  className="w-64"
                  size="md"
                />
              ) : (
                <input
                  aria-label={details.label}
                  autoFocus
                  type={details.type}
                  maxLength={details.maxLength}
                  required={field === "name"}
                  pattern={field === "currency" ? "[A-Z]{3}" : undefined}
                  placeholder={field === "website" ? "https://example.com" : field === "currency" ? "USD" : undefined}
                  value={draft}
                  onChange={(event) =>
                    setDraft(field === "currency" ? event.target.value.toUpperCase() : event.target.value)
                  }
                  disabled={busy}
                  className="h-9 max-w-full rounded-md border border-subtle bg-surface-1 px-3 text-13 outline-none focus:border-[#135DDD]"
                />
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError("");
                }}
                className="text-12 text-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="text-12 font-medium text-[#135DDD] disabled:opacity-50">
                {busy ? "Saving..." : "Save"}
              </button>
              {error && (
                <p role="alert" className="w-full text-12 text-danger-primary">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <div className="flex items-center gap-2 text-12">
              <span className="break-all text-secondary">{workspace[field] || "Not set"}</span>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`${details.action} ${details.label}`}
                  disabled={busy}
                  onClick={() => {
                    setEditing(field);
                    setDraft(workspace[field] ?? "");
                    setError("");
                  }}
                  className="shrink-0 text-[#135DDD] hover:underline disabled:opacity-50"
                >
                  {details.action}
                </button>
              )}
            </div>
          )}
        </dd>
      </div>
    );
  };
  return (
    <>
      <div className="border-b border-subtle pb-3">
        <h3 className="text-14 font-semibold">Company profile</h3>
        <p className="mt-1 text-12 text-secondary">Business details for {workspace.name}.</p>
      </div>
      <dl>
        {row("name")}
        {row("website")}
      </dl>
      <h3 className="mt-6 border-b border-subtle pb-3 text-14 font-semibold">Regional settings</h3>
      <dl>
        {row("billing_email")}
        {row("timezone")}
        {row("currency")}
      </dl>
      <p className="mt-3 text-12 text-secondary">
        Company name is your workspace name. Billing contact and currency are company profile details; they do not
        configure payments. {!canEdit && "Only workspace admins can change these details."}
      </p>
    </>
  );
});
