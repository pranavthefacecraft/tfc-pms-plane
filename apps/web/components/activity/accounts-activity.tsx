import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import { ArrowRight } from "lucide-react";
import { orderWorkspacesList } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser } from "@/hooks/store/user";
import { activityDateKey, activityHref, fetchActivityPage, groupActivity } from "./accounts-activity.helpers";
import type { ActivityAccount, ActivityPage } from "./accounts-activity.helpers";

function ActivityFeed({
  accounts,
  userId,
  timeZone,
}: {
  accounts: ActivityAccount[];
  userId: string;
  timeZone: string;
}) {
  const accountKey = accounts.map((account) => account.id).join(",");
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<ActivityPage>(
    (index, previous: ActivityPage | null) => {
      if (!accounts.length || (previous && !previous.streams.some((stream) => stream.cursor))) return null;
      return ["all-accounts-activity", userId, accountKey, index, previous];
    },
    ([, , , , previous]: [string, string, string, number, ActivityPage | null]) =>
      fetchActivityPage(accounts, previous ?? undefined),
    { revalidateFirstPage: false, revalidateOnFocus: false }
  );
  const page = data?.[data.length - 1];
  const items = page?.items.filter((item) => Date.parse(item.notification.created_at!) >= page.cutoff) ?? [];
  const groups = groupActivity(items, timeZone);
  const today = activityDateKey(new Date(), timeZone);
  const hasMore = page?.streams.some((stream) => stream.cursor);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en", { timeZone, month: "long", day: "numeric", year: "numeric" }),
    [timeZone]
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", minute: "2-digit" }),
    [timeZone]
  );

  return (
    <div className="mt-8">
      {isLoading && (
        <p role="status" className="text-13 text-secondary">
          Loading activity...
        </p>
      )}
      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-danger-strong p-4 text-13">
          <p>Could not load account activity. Please try again.</p>
          <button type="button" className="mt-2 font-medium text-[#135DDD]" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      )}
      {!isLoading && !error && items.length === 0 && !hasMore && (
        <p className="rounded-lg border border-subtle bg-surface-1 p-6 text-13 text-secondary">
          No activity yet. Assignments, mentions and other personal notifications will appear here.
        </p>
      )}
      {groups.map(([key, group]) => (
        <section key={key} className="mb-7" aria-label={key === today ? "Today" : dateFormatter.format(group.date)}>
          <h2 className="mb-4 text-16 font-semibold">{key === today ? "Today" : dateFormatter.format(group.date)}</h2>
          <div className="space-y-3">
            {group.items.map((item) => {
              const { notification, account } = item;
              const issue = notification.data?.issue;
              const context = [
                issue?.identifier && issue.sequence_id ? `${issue.identifier}-${issue.sequence_id}` : undefined,
                issue?.name,
                account.name,
              ]
                .filter(Boolean)
                .join(" / ");
              return (
                <article
                  key={`${account.id}:${notification.id}`}
                  className="flex items-center gap-4 rounded-lg border border-[#E2E6EF] bg-surface-1 p-4 md:gap-6 md:px-5"
                >
                  <time dateTime={notification.created_at} className="w-20 shrink-0 text-12 text-secondary">
                    {timeFormatter.format(new Date(notification.created_at!))}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="text-13 font-medium">
                      {notification.title || notification.message_stripped || "Task activity"}
                    </p>
                    <p className="mt-1 text-12 text-secondary">{context}</p>
                  </div>
                  <Link
                    href={activityHref(item)}
                    aria-label={`View ${notification.title || "activity"} in ${account.name}`}
                    className="flex shrink-0 items-center gap-1 text-13 font-medium text-[#135DDD]"
                  >
                    View <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {hasMore && (
        <button
          type="button"
          disabled={isValidating || !!error}
          className="rounded-md border border-subtle bg-surface-1 px-4 py-2 text-13 disabled:opacity-50"
          onClick={() => void setSize(size + 1)}
        >
          {isValidating ? "Loading..." : "Load older activity"}
        </button>
      )}
    </div>
  );
}

export const AccountsActivity = observer(function AccountsActivity() {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const { workspaces } = useWorkspace();
  const { data: user } = useUser();
  const accounts = orderWorkspacesList(Object.values(workspaces ?? {}));
  const selected = accounts.find((account) => account.id === selectedAccount);
  const visibleAccounts = selected ? [selected] : accounts;
  const timeZone = user?.user_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="p-4 md:p-7">
      <PageHead title="All Accounts Activity" />
      <div className="max-w-5xl">
        <h1 className="text-20 font-semibold">All Accounts Activity</h1>
        <p className="mt-2 text-13 text-secondary">
          Your personal notifications across PMS accounts. Archived notifications and snoozed reminders are managed in
          each account&apos;s inbox.
        </p>
        <div aria-label="Filter by account" className="mt-6 flex flex-wrap gap-2">
          {[{ id: null, name: "All accounts" }, ...accounts].map((account) => (
            <button
              key={account.id ?? "all"}
              type="button"
              aria-pressed={account.id === (selected?.id ?? null)}
              onClick={() => setSelectedAccount(account.id)}
              className={`rounded-md border px-4 py-2 text-13 ${account.id === (selected?.id ?? null) ? "border-[#135DDD] bg-[#EAF2FF] text-[#135DDD] dark:bg-layer-1" : "border-subtle bg-surface-1 text-secondary"}`}
            >
              {account.name}
            </button>
          ))}
        </div>
        {user ? (
          <ActivityFeed
            key={`${user.id}:${selected?.id ?? "all"}`}
            accounts={visibleAccounts}
            userId={user.id}
            timeZone={timeZone}
          />
        ) : (
          <p role="status" className="mt-8 text-13 text-secondary">
            Loading accounts...
          </p>
        )}
      </div>
    </div>
  );
});
