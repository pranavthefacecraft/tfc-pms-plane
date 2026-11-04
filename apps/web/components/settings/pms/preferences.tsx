/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { observer } from "mobx-react";
import { START_OF_THE_WEEK_OPTIONS } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import { useUser, useUserProfile } from "@/hooks/store/user";
import { TimezoneSelect } from "@/components/global/timezone-select";

export const PMSPreferences = observer(function PMSPreferences() {
  const { data: user, updateCurrentUser } = useUser();
  const { data: profile, isLoading, error: profileError, updateUserProfile } = useUserProfile();
  const [editing, setEditing] = useState<"week" | "timezone" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (profileError?.status === "user-profile-fetch-error")
    return <p role="alert">Could not load preferences. Reload the page to try again.</p>;
  if (!user || !profile || isLoading) return <p role="status">Loading preferences...</p>;

  const reset = () => {
    setEditing(null);
    setError("");
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || busy) return;
    const week = START_OF_THE_WEEK_OPTIONS.find((option) => String(option.value) === draft);
    if (editing === "week" && !week) {
      setError("Select a valid first day of the week.");
      return;
    }
    if (editing === "timezone" && !draft) {
      setError("Select a time zone.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editing === "week" && week) {
        const saved = await updateUserProfile({ start_of_the_week: week.value });
        if (!saved) throw new Error("Week-start preference could not be saved");
      } else await updateCurrentUser({ user_timezone: draft });
      reset();
      setToast({
        type: "success",
        title: "Preferences saved",
        message: "Your personal preferences have been updated.",
      });
    } catch (cause) {
      console.error("PMS preferences update failed", cause);
      const message = "Could not save preferences. Please try again.";
      setError(message);
      setToast({ type: "error", title: "Could not save preferences", message });
    } finally {
      setBusy(false);
    }
  };
  const preferenceRow = (field: "week" | "timezone", label: string, value: string) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-4">
      <dt className="text-12 font-medium">{label}</dt>
      <dd className="max-w-full min-w-0">
        {editing === field ? (
          <form onSubmit={save} aria-label={`Edit ${label}`} className="flex flex-wrap items-center gap-2">
            {field === "week" ? (
              <select
                aria-label="Week starts on"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={busy}
                className="h-9 rounded-md border border-subtle bg-surface-1 px-3 text-13"
              >
                {START_OF_THE_WEEK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <TimezoneSelect
                value={draft}
                onChange={setDraft}
                disabled={busy}
                label="Personal time zone"
                size="md"
                className="w-64"
              />
            )}
            <button type="button" onClick={reset} disabled={busy} className="text-12 text-secondary">
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
            <span className="text-secondary">{value}</span>
            <button
              type="button"
              aria-label={`Change ${label}`}
              disabled={busy}
              onClick={() => {
                setEditing(field);
                setDraft(field === "week" ? String(profile.start_of_the_week) : (user.user_timezone ?? ""));
                setError("");
              }}
              className="text-[#135DDD] hover:underline disabled:opacity-50"
            >
              Change
            </button>
          </div>
        )}
      </dd>
    </div>
  );
  return (
    <>
      <div className="border-b border-subtle pb-3">
        <h3 className="text-14 font-semibold">Task defaults</h3>
        <p className="mt-1 text-12 text-secondary">Workspace-wide task defaults are not available in this edition.</p>
      </div>
      <dl className="divide-y divide-subtle border-b border-subtle text-12">
        {[
          ["Default status", "Configured per project"],
          ["Task visibility", "Personal tasks are private; project tasks follow project access"],
          ["Due date", "Set when creating a task"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <dt className="font-medium">{label}</dt>
            <dd className="text-secondary">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-6 border-b border-subtle pb-3 text-14 font-semibold">Calendar &amp; notifications</h3>
      <dl>
        {preferenceRow(
          "week",
          "Week starts on",
          START_OF_THE_WEEK_OPTIONS.find((option) => option.value === profile.start_of_the_week)?.label ?? "Not set"
        )}
        {preferenceRow("timezone", "Time zone", user.user_timezone || "Not set")}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-4 text-12">
          <dt className="font-medium">Task updates</dt>
          <dd className="flex items-center gap-2">
            <span className="text-secondary">Personal notification settings</span>
            <Link href="/settings/profile/notifications" className="text-[#135DDD] hover:underline">
              Manage
            </Link>
          </dd>
        </div>
      </dl>
      <div className="mt-4 rounded-md bg-[#F8F9FB] p-3 dark:bg-layer-1">
        <h4 className="text-13 font-medium">Project-level controls</h4>
        <p className="mt-1 text-12 text-secondary">
          Edit stages and fields inside each project. Automations are not available in this edition.
        </p>
      </div>
      <p className="mt-3 text-12 text-secondary">
        Week start and time zone are personal preferences, not company-wide settings. Custom PMS calendars currently use
        Monday-first weeks; the week-start preference applies to the existing task calendars and date pickers.
      </p>
      <Link href="/settings/profile/preferences" className="mt-3 inline-block text-12 text-[#135DDD] hover:underline">
        Appearance, language and advanced preferences
      </Link>
    </>
  );
});
