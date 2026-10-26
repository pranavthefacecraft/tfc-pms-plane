import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NotificationsRoot } from "@/components/workspace-notifications/root";
import { NotificationItem } from "@/components/workspace-notifications/sidebar/notification-card/item";

const mocks = vi.hoisted(() => ({
  selected: undefined as string | undefined,
  select: vi.fn(),
  read: vi.fn(),
  peek: vi.fn(),
  notification: {
    id: "notification-1",
    entity_name: "workspace_message",
    entity_identifier: "message-1",
    title: "Workspace news",
    message_stripped: "Hello team",
    read_at: null,
    data: { message_id: "message-1" },
    triggered_by_details: { display_name: "Alice" },
  },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("swr", () => ({ default: () => ({}) }));
vi.mock("@/hooks/store/notifications", () => ({
  useWorkspaceNotifications: () => ({
    currentSelectedNotificationId: mocks.selected,
    setCurrentSelectedNotificationId: mocks.select,
    notifications: { "notification-1": mocks.notification },
    notificationLiteByNotificationId: () => ({}),
    notificationIdsByWorkspaceId: () => [],
    getNotifications: vi.fn(),
  }),
}));
vi.mock("@/hooks/store/notifications/use-notification", () => ({
  useNotification: () => ({ asJson: mocks.notification, markNotificationAsRead: mocks.read }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "workspace", slug: "team" },
    getWorkspaceBySlug: () => ({ id: "workspace" }),
  }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ getIsIssuePeeked: vi.fn(), setPeekIssue: mocks.peek }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ fetchUserProjectInfo: vi.fn() }) }));
vi.mock("@/hooks/use-workspace-issue-properties", () => ({ useWorkspaceIssueProperties: vi.fn() }));
vi.mock("@/hooks/use-notification-preview", () => ({
  useNotificationPreview: () => ({
    isWorkItem: false,
    PeekOverviewComponent: () => <div>Issue preview</div>,
    setPeekWorkItem: mocks.peek,
  }),
}));
vi.mock("@/components/workspace-notifications/sidebar/notification-card/options", () => ({
  NotificationOption: () => <span>Read, archive and snooze options</span>,
}));
vi.mock("@/components/workspace-notifications/sidebar/notification-card/content", () => ({
  NotificationContent: () => null,
}));
vi.mock("@/components/common/logo-spinner", () => ({ LogoSpinner: () => null }));
vi.mock("@/components/inbox/content", () => ({ InboxContentRoot: () => <div>Intake content</div> }));
vi.mock("@/components/workspace-messages/message-detail", () => ({
  WorkspaceMessageDetail: ({
    messageId,
    workspaceSlug,
    onClose,
  }: {
    messageId: string;
    workspaceSlug: string;
    onClose: () => void;
  }) => (
    <article>
      Message {messageId} in {workspaceSlug}
      <button onClick={onClose}>Back to Inbox</button>
    </article>
  ),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.selected = undefined;
  mocks.read.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("renders workspace messages without requiring a project or issue, and selects and marks them read", async () => {
  await act(() => root.render(<NotificationItem workspaceSlug="team" notificationId="notification-1" />));
  expect(host.textContent).toContain("Workspace news");
  expect(host.textContent).toContain("Hello team");
  expect(host.textContent).toContain("Alice");
  expect(host.textContent).toContain("archive and snooze");
  await act(() => host.querySelector("button")?.click());
  expect(mocks.select).toHaveBeenCalledWith("notification-1");
  expect(mocks.read).toHaveBeenCalledWith("team");
});
it("opens a selected message instead of issue peek content", async () => {
  mocks.selected = "notification-1";
  await act(() =>
    root.render(
      <MemoryRouter>
        <NotificationsRoot workspaceSlug="team" />
      </MemoryRouter>
    )
  );
  expect(host.querySelector("article")?.textContent).toContain("Message message-1 in team");
  expect(host.textContent).not.toContain("Issue preview");
});
it("opens an email deep link and can return to the Inbox list", async () => {
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={["/team/notifications/?message=message-1"]}>
        <NotificationsRoot workspaceSlug="team" />
      </MemoryRouter>
    )
  );
  expect(host.querySelector("article")).not.toBeNull();
  await act(() => host.querySelector("article button")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(host.querySelector("article")).toBeNull();
  expect(mocks.select).toHaveBeenCalledWith(undefined);
});
