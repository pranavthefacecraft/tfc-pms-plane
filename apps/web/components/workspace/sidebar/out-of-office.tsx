import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { CalendarDays, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import type { TOutOfOffice } from "@plane/types";
import { useUser, useUserProfile } from "@/hooks/store/user";

export function profileDate(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isOutOfOffice(schedule: TOutOfOffice | null | undefined, today: string): boolean {
  return !!schedule && schedule.start_date <= today && today <= schedule.end_date;
}

export const OutOfOfficeStatus = observer(function OutOfOfficeStatus() {
  const { data: user } = useUser();
  const { data: profile } = useUserProfile();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const schedule = profile?.out_of_office;
  if (!isOutOfOffice(schedule, profileDate(user?.user_timezone || "UTC", now))) return null;
  return (
    <p role="status" className="mt-1 text-12 text-secondary" title={schedule?.message || undefined}>
      Out of office{schedule?.message ? `: ${schedule.message}` : ""}
    </p>
  );
});

export const OutOfOfficeDialog = observer(function OutOfOfficeDialog({ onClose }: { onClose: () => void }) {
  const { data: user } = useUser();
  const { data: profile, updateUserProfile } = useUserProfile();
  const timeZone = user?.user_timezone || "UTC";
  const existing = profile?.out_of_office;
  const [start, setStart] = useState(existing?.start_date ?? profileDate(timeZone));
  const [end, setEnd] = useState(existing?.end_date ?? profileDate(timeZone));
  const [message, setMessage] = useState(existing?.message ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(schedule: TOutOfOffice | null) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await updateUserProfile({ out_of_office: schedule });
      if (!saved) throw new Error("Profile could not be saved");
      setToast({ type: "success", title: schedule ? "Out of office saved" : "Out of office removed" });
      onClose();
    } catch (cause) {
      console.error("Out of office update failed", cause);
      setError("Could not save out of office. Your draft is retained. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  const inputClass = "mt-1 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent size="xs">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Set out of office</DialogTitle>
            <button type="button" aria-label="Close out of office" disabled={saving} onClick={onClose}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-12 text-secondary">
            Dates are inclusive in {timeZone}. This only updates your profile status, not task assignments or replies.
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!start || !end || end < start) {
                setError("Choose an end date on or after the start date.");
                return;
              }
              void save({ start_date: start, end_date: end, message: message.trim() });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-13">
                Start date
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={start}
                  max={end || undefined}
                  disabled={saving}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label className="text-13">
                End date
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={end}
                  min={start || undefined}
                  disabled={saving}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>
            <label className="block text-13">
              Message (optional)
              <textarea
                className={inputClass}
                rows={3}
                maxLength={500}
                value={message}
                disabled={saving}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-13 text-danger-primary">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              {existing && (
                <button
                  type="button"
                  disabled={saving}
                  className="mr-auto text-13 text-danger-primary"
                  onClick={() => void save(null)}
                >
                  Clear dates
                </button>
              )}
              <button type="button" disabled={saving} className="text-13 text-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-[#135DDD] px-3 py-2 text-13 text-white disabled:opacity-60"
              >
                <CalendarDays className="size-4" aria-hidden="true" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
});
