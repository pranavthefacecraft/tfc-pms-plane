import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TNotification } from "@plane/types";
import { AccountsActivity } from "./accounts-activity";
import { activityDateKey, activityHref, fetchActivityPage, groupActivity } from "./accounts-activity.helpers";

const fetchNotifications = vi.hoisted(() => vi.fn());
vi.mock("@/services/workspace-notification.service", () => ({
  default: { fetchNotifications },
}));
const accounts = [
  { id: "studio-id", slug: "studio", name: "Studio" },
  { id: "team-id", slug: "team", name: "Team" },
];
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ workspaces: Object.fromEntries(accounts.map((account) => [account.id, account])) }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "user", user_timezone: "America/Los_Angeles" } }),
}));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
function notification(id: string, created_at = "2026-01-02T09:00:00Z"): TNotification {
  return {
    id,
    title: `Activity ${id}`,
    created_at,
    project: "project",
    entity_name: "issue",
    is_inbox_issue: false,
    data: {
      issue: {
        id: "task",
        name: "Design task",
        identifier: "PMS",
        sequence_id: 1,
        state_name: undefined,
        state_group: undefined,
      },
      issue_activity: {
        id: undefined,
        actor: undefined,
        field: "comment",
        issue_comment: undefined,
        verb: "created",
        new_value: undefined,
        old_value: undefined,
      },
    },
    entity_identifier: undefined,
    message_html: undefined,
    message: undefined,
    message_stripped: undefined,
    sender: undefined,
    receiver: undefined,
    triggered_by: undefined,
    triggered_by_details: undefined,
    read_at: undefined,
    archived_at: undefined,
    snoozed_till: undefined,
    is_mentioned_notification: undefined,
    workspace: undefined,
    updated_at: undefined,
    created_by: undefined,
    updated_by: undefined,
  };
}
const response = (results: TNotification[], next?: string) => ({
  results,
  next_page_results: !!next,
  next_cursor: next,
});
beforeEach(() => {
  fetchNotifications.mockReset();
  fetchNotifications.mockResolvedValue(response([]));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => vi.unstubAllGlobals());

it("fetches mentions separately without passing a truthy false parameter, with bounded pagination", async () => {
  await fetchActivityPage(accounts);
  expect(fetchNotifications).toHaveBeenCalledTimes(4);
  for (const account of accounts) {
    expect(fetchNotifications).toHaveBeenCalledWith(account.slug, {
      per_page: 50,
      cursor: "50:0:0",
      mentioned: undefined,
      archived: false,
      snoozed: false,
    });
    expect(fetchNotifications).toHaveBeenCalledWith(account.slug, {
      per_page: 50,
      cursor: "50:0:0",
      mentioned: true,
      archived: false,
      snoozed: false,
    });
  }
});
it("merges newest first and withholds older rows until unfinished accounts catch up", async () => {
  fetchNotifications.mockResolvedValueOnce(
    response([notification("recent", "2026-01-03T12:00:00Z"), notification("middle", "2026-01-02T12:00:00Z")], "50:1:0")
  );
  fetchNotifications.mockResolvedValueOnce(response([notification("old", "2026-01-01T12:00:00Z")]));
  const first = await fetchActivityPage([accounts[0]!]);
  expect(first.items.map((item) => item.notification.id)).toEqual(["recent", "middle", "old"]);
  expect(
    first.items
      .filter((item) => Date.parse(item.notification.created_at!) >= first.cutoff)
      .map((item) => item.notification.id)
  ).toEqual(["recent", "middle"]);
  fetchNotifications.mockResolvedValueOnce(response([notification("old", "2026-01-01T12:00:00Z")]));
  const second = await fetchActivityPage([accounts[0]!], first);
  expect(second.items.map((item) => item.notification.id)).toEqual(["recent", "middle", "old"]);
  expect(second.cutoff).toBe(-Infinity);
  expect(fetchNotifications.mock.calls[2]?.[1].cursor).toBe("50:1:0");
  expect(second.streams.some((stream) => stream.cursor)).toBe(false);
});
it.each([undefined, {}, response([{ ...notification("bad"), created_at: undefined }]), response([], "50:1:0")])(
  "rejects incomplete/invalid API results rather than showing a false empty feed",
  async (payload) => {
    fetchNotifications.mockResolvedValueOnce(payload);
    await expect(fetchActivityPage([accounts[0]!])).rejects.toThrow(/Invalid activity/);
  }
);
it("preserves request failures", async () => {
  fetchNotifications.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(fetchActivityPage([accounts[0]!])).rejects.toThrow("Forbidden");
});
it("groups dates in the user's time zone, including year boundaries", () => {
  const date = new Date("2026-01-01T01:00:00Z");
  expect(activityDateKey(date, "America/Los_Angeles")).toBe("2025-12-31");
  expect(activityDateKey(date, "Asia/Kolkata")).toBe("2026-01-01");
  const groups = groupActivity(
    [
      { account: accounts[0]!, notification: notification("one", "2026-01-01T01:00:00Z") },
      { account: accounts[0]!, notification: notification("two", "2025-12-31T23:00:00Z") },
    ],
    "America/Los_Angeles"
  );
  expect(groups).toHaveLength(1);
  expect(groups[0]?.[1].items).toHaveLength(2);
});
it("links tasks, whiteboards and messages to their own account and handles intake safely", () => {
  const item = { account: accounts[1]!, notification: notification("one") };
  expect(activityHref(item)).toBe("/team/projects/project/issues/task");
  expect(activityHref({ ...item, notification: { ...item.notification, is_inbox_issue: true } })).toBe(
    "/team/notifications"
  );
  expect(
    activityHref({
      ...item,
      notification: { ...item.notification, entity_name: "workspace_message", entity_identifier: "message" },
    })
  ).toBe("/team/notifications?message=message");
  expect(
    activityHref({
      ...item,
      notification: {
        ...item.notification,
        entity_name: "whiteboard",
        data: { ...item.notification.data!, page_id: "page", thread_id: "a&b" },
      },
    })
  ).toBe("/team/tool/whiteboards/page?thread=a%26b");
});

async function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <MemoryRouter>
          <AccountsActivity />
        </MemoryRouter>
      </SWRConfig>
    )
  );
  return {
    host,
    dispose: async () => {
      await act(() => root.unmount());
      host.remove();
    },
  };
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}
it("renders cards, real View links, timezone dates and account filters", async () => {
  fetchNotifications.mockImplementation((slug: string, params: { mentioned?: boolean }) =>
    Promise.resolve(response(params.mentioned ? [] : [notification(slug, "2026-01-01T01:00:00Z")]))
  );
  const { host, dispose } = await mount();
  try {
    await settle();
    expect(host.querySelector("h1")?.textContent).toBe("All Accounts Activity");
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(host.textContent).toContain("December 31, 2025");
    expect(host.querySelector('a[href="/studio/projects/project/issues/task/"]')).not.toBeNull();
    await act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Team")!.click());
    await settle();
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(host.querySelector("article")?.textContent).toContain("Activity team");
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toBe("Team");
    await act(() =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "All accounts")!.click()
    );
    await settle();
    expect(host.querySelectorAll("article")).toHaveLength(2);
  } finally {
    await dispose();
  }
});
it("shows errors and Retry, then an honest empty state", async () => {
  fetchNotifications.mockRejectedValue(new Error("offline"));
  const { host, dispose } = await mount();
  try {
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load account activity");
    expect(host.textContent).not.toContain("No activity yet");
    fetchNotifications.mockResolvedValue(response([]));
    await act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Retry")!.click());
    await settle();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("No activity yet");
  } finally {
    await dispose();
  }
});
it("loads older activity without chronological gaps and retains cards when loading older fails", async () => {
  let failOlder = true;
  fetchNotifications.mockImplementation((slug: string, params: { mentioned?: boolean; cursor: string }) => {
    if (slug !== "studio" || params.mentioned) return Promise.resolve(response([]));
    if (params.cursor === "50:0:0")
      return Promise.resolve(response([notification("new", "2026-01-03T12:00:00Z")], "50:1:0"));
    if (failOlder) return Promise.reject(new Error("offline"));
    return Promise.resolve(response([notification("older", "2026-01-01T12:00:00Z")]));
  });
  const { host, dispose } = await mount();
  try {
    await settle();
    expect(host.querySelectorAll("article")).toHaveLength(1);
    await act(() =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Load older activity")!.click()
    );
    await settle();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelectorAll("article")).toHaveLength(1);
    failOlder = false;
    await act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Retry")!.click());
    await settle();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect([...host.querySelectorAll("article")].map((card) => card.querySelector("p")?.textContent)).toEqual([
      "Activity new",
      "Activity older",
    ]);
    expect(host.textContent).not.toContain("Load older activity");
  } finally {
    await dispose();
  }
});
it("shows a loading state before notifications arrive", async () => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const pending = new Promise((done) => {
    resolve = done;
  });
  fetchNotifications.mockReturnValue(pending);
  const { host, dispose } = await mount();
  try {
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading activity...");
    await act(() => resolve(response([])));
    await settle();
    expect(host.querySelector('[role="status"]')).toBeNull();
  } finally {
    await dispose();
  }
});
