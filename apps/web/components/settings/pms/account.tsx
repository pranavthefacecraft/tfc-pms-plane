/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { setToast } from "@plane/blocks/toast";
import { validatePersonName } from "@plane/utils";
import { useUser } from "@/hooks/store/user";
import { useInstance } from "@/hooks/store/use-instance";
import { ChangeEmailModal } from "@/components/core/modals/change-email-modal";
import { SecurityProfileSettings } from "@/components/settings/profile/content/pages/security";

export const PMSAccount = observer(function PMSAccount() {
  const { data: user, updateCurrentUser } = useUser();
  const { config } = useInstance();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  if (!user) return <p role="status">Loading account...</p>;
  const original = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const name = draft ?? original;
  const reset = () => {
    setDraft(null);
    setError("");
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const fullName = name.trim().replace(/\s+/g, " ");
    // Keep an existing multi-word first name when the family name is unchanged.
    const suffix = user.last_name ? ` ${user.last_name}` : "";
    const split = fullName.indexOf(" ");
    const first =
      suffix && fullName.endsWith(suffix)
        ? fullName.slice(0, -suffix.length)
        : split < 0
          ? fullName
          : fullName.slice(0, split);
    const last = suffix && fullName.endsWith(suffix) ? user.last_name : split < 0 ? "" : fullName.slice(split + 1);
    const validation = validatePersonName(first);
    const lastValidation = last ? validatePersonName(last) : true;
    if (validation !== true || lastValidation !== true) {
      setError(
        typeof validation === "string"
          ? validation
          : typeof lastValidation === "string"
            ? lastValidation
            : "Enter a valid name."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateCurrentUser({ first_name: first, last_name: last });
      setDraft(null);
      setToast({ type: "success", title: "Changes saved", message: "Your personal information has been updated." });
    } catch (cause) {
      console.error("PMS account update failed", cause);
      setError("Could not save your changes. Please try again.");
      setToast({ type: "error", title: "Could not save changes", message: "Please try again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <form onSubmit={save} aria-label="Personal information">
        <h3 className="mb-6 text-14 font-semibold">Personal information</h3>
        <div className="space-y-7">
          <div className="grid items-center gap-2 sm:grid-cols-[minmax(100px,1fr)_minmax(0,3fr)] sm:gap-6 sm:pr-24">
            <label htmlFor="pms-account-name" className="text-12">
              Name
            </label>
            <input
              id="pms-account-name"
              autoComplete="name"
              required
              maxLength={101}
              value={name}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "pms-account-error" : undefined}
              className="h-9 w-full rounded-md border border-subtle bg-surface-1 px-3 text-13 outline-none focus:border-[#135DDD]"
            />
          </div>
          <div className="grid items-center gap-2 sm:grid-cols-[minmax(100px,1fr)_minmax(0,3fr)] sm:gap-6 sm:pr-24">
            <label htmlFor="pms-account-email" className="text-12">
              Email
            </label>
            <div>
              <input
                id="pms-account-email"
                type="email"
                autoComplete="email"
                readOnly
                value={user.email}
                className="h-9 w-full rounded-md border border-subtle bg-surface-1 px-3 text-13"
              />
              {config?.is_smtp_configured && (
                <button
                  type="button"
                  onClick={() => setEmailOpen(true)}
                  className="mt-1 text-11 text-secondary underline"
                >
                  Change email
                </button>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p id="pms-account-error" role="alert" className="mt-3 text-12 text-danger-primary">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-full border border-strong px-4 py-2 text-12 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || name === original}
            className="rounded-full bg-[#135DDD] px-4 py-2 text-12 font-medium text-white hover:bg-[#0F4FC0] disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
      <section className="mt-6 border-t border-subtle pt-6" aria-label="Sign-in and security">
        <h3 className="mb-2 text-14 font-semibold">Sign-in &amp; security</h3>
        <div className="flex items-center justify-between gap-4 border-b border-subtle py-4">
          <div>
            <h4 className="text-12 font-medium">Password</h4>
            <p className="mt-1 text-12 text-secondary">Change your account password</p>
          </div>
          <button
            type="button"
            onClick={() => setPasswordOpen(!passwordOpen)}
            aria-expanded={passwordOpen}
            className="shrink-0 text-12 underline"
          >
            {passwordOpen ? "Close" : "Change Password"}
          </button>
        </div>
        {passwordOpen && (
          <div className="max-w-xl py-5">
            <SecurityProfileSettings />
          </div>
        )}
        <div className="flex items-center justify-between gap-4 border-b border-subtle py-4">
          <div>
            <h4 className="text-12 font-medium">Two-step verification</h4>
            <p className="mt-1 text-12 text-secondary">Not available in this installation</p>
          </div>
          <span className="text-12 text-tertiary">Unavailable</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h4 className="text-12 font-medium">Current session</h4>
            <p className="mt-1 text-12 text-secondary">Current device</p>
          </div>
          <span className="text-12 text-tertiary">Login history unavailable</span>
        </div>
      </section>
      <Link href="/settings/profile/general" className="mt-4 inline-block text-12 text-secondary underline">
        Advanced profile settings
      </Link>
      {emailOpen && <ChangeEmailModal isOpen onClose={() => setEmailOpen(false)} />}
    </>
  );
});
