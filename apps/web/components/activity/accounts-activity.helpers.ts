import { orderBy } from "lodash-es";
import type { IWorkspace, TNotification } from "@plane/types";
import workspaceNotificationService from "@/services/workspace-notification.service";

export type ActivityAccount = Pick<IWorkspace, "id" | "slug" | "name">;
type ActivityStream = { account: ActivityAccount; mentioned: boolean; cursor: string | undefined };
export type AccountActivity = { account: ActivityAccount; notification: TNotification };
export type ActivityPage = { items: AccountActivity[]; streams: ActivityStream[]; cutoff: number };
const pageSize = 50;

export async function fetchActivityPage(accounts: ActivityAccount[], previous?: ActivityPage): Promise<ActivityPage> {
  const streams =
    previous?.streams.filter((stream) => stream.cursor) ??
    accounts.flatMap((account) =>
      [false, true].map((mentioned) => ({ account, mentioned, cursor: `${pageSize}:0:0` }))
    );
  const pages = await Promise.all(
    streams.map(async (stream) => {
      const page = await workspaceNotificationService.fetchNotifications(stream.account.slug, {
        per_page: pageSize,
        cursor: stream.cursor,
        mentioned: stream.mentioned ? true : undefined,
        archived: false,
        snoozed: false,
      });
      if (!page?.results || (page.next_page_results && (!page.next_cursor || page.results.length === 0)))
        throw new Error(`Invalid activity response for ${stream.account.slug}`);
      for (const item of page.results) {
        if (!item.created_at || !Number.isFinite(Date.parse(item.created_at)))
          throw new Error(`Invalid activity timestamp for ${item.id}`);
      }
      return {
        items: page.results.map((notification) => ({ account: stream.account, notification })),
        stream: { ...stream, cursor: page.next_page_results ? page.next_cursor : undefined },
        cutoff: page.next_page_results ? Date.parse(page.results[page.results.length - 1]!.created_at!) : -Infinity,
      };
    })
  );
  const items = orderBy(
    [
      ...new Map(
        [...(previous?.items ?? []), ...pages.flatMap((page) => page.items)].map((item) => [
          `${item.account.id}:${item.notification.id}`,
          item,
        ])
      ).values(),
    ],
    [(item) => Date.parse(item.notification.created_at!), (item) => item.notification.id],
    ["desc", "asc"]
  );
  // Withhold older rows until every unfinished stream has caught up to that date.
  return {
    items,
    streams: pages.map((page) => page.stream),
    cutoff: Math.max(-Infinity, ...pages.map((page) => page.cutoff)),
  };
}

export function activityHref({ account, notification }: AccountActivity): string {
  const root = `/${encodeURIComponent(account.slug)}`;
  if (notification.entity_name === "workspace_message" && notification.entity_identifier)
    return `${root}/notifications?message=${encodeURIComponent(notification.entity_identifier)}`;
  if (notification.entity_name === "whiteboard" && notification.data?.page_id)
    return `${root}/tool/whiteboards/${encodeURIComponent(notification.data.page_id)}${
      notification.data.thread_id ? `?thread=${encodeURIComponent(notification.data.thread_id)}` : ""
    }`;
  if (notification.project && notification.data?.issue?.id && !notification.is_inbox_issue)
    return `${root}/projects/${encodeURIComponent(notification.project)}/issues/${encodeURIComponent(notification.data.issue.id)}`;
  return `${root}/notifications`;
}

export function activityDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => {
      const part = parts.find((part) => part.type === type);
      if (!part) throw new Error(`Could not format activity date ${type}`);
      return part.value;
    })
    .join("-");
}

export function groupActivity(items: AccountActivity[], timeZone: string) {
  const groups = new Map<string, { date: Date; items: AccountActivity[] }>();
  for (const item of items) {
    const date = new Date(item.notification.created_at!);
    const key = activityDateKey(date, timeZone);
    const group = groups.get(key) ?? { date, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()];
}
