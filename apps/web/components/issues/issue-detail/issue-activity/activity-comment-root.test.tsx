import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { E_SORT_ORDER, defaultActivityFilters } from "@plane/constants";
import { IssueActivityCommentRoot } from "./activity-comment-root";

const state = vi.hoisted(() => ({
  comments: {
    root: { id: "root", parent: null },
    reply: { id: "reply", parent: "root" },
    nested: { id: "nested", parent: "reply" },
    other: { id: "other", parent: null },
  } as Record<string, { id: string; parent: string | null }>,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    activity: {
      getActivityAndCommentsByIssueId: () => [
        { id: "event", activity_type: "DEFAULT", created_at: "" },
        ...Object.keys(state.comments).map((id) => ({ id, activity_type: "COMMENT", created_at: "" })),
      ],
    },
    comment: { getCommentById: (id: string) => state.comments[id] },
  }),
}));
vi.mock("@/components/comments/card/root", () => ({
  CommentCard: ({ comment, children }: { comment: { id: string }; children: ReactNode }) => (
    <div data-comment={comment.id}>{children}</div>
  ),
}));
vi.mock("./activity/activity-list", () => ({
  IssueActivityItem: ({ activityId }: { activityId: string }) => <div data-event={activityId} />,
}));
vi.mock("./loader", () => ({ IssueActivityLoader: () => null }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  delete state.comments.orphan;
  delete state.comments.cycleA;
  delete state.comments.cycleB;
  delete state.comments.self;
});
async function render(mode: "comments" | "activity") {
  await act(() =>
    root.render(
      <IssueActivityCommentRoot
        workspaceSlug="team"
        projectId="project"
        issueId="task"
        isIntakeIssue={false}
        selectedFilters={defaultActivityFilters}
        activityOperations={operations}
        sortOrder={E_SORT_ORDER.ASC}
        presentation="drawer"
        mode={mode}
      />
    )
  );
}
const operations = {
  copyCommentLink: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  removeComment: vi.fn(),
  uploadCommentAsset: vi.fn(),
  duplicateCommentAsset: vi.fn(),
  addCommentReaction: vi.fn(),
  deleteCommentReaction: vi.fn(),
  react: vi.fn(),
  reactionIds: vi.fn(),
  userReactions: vi.fn(),
  getReactionUsers: vi.fn(),
};
it("renders replies beneath their parent once and excludes activity from the comments section", async () => {
  await render("comments");
  expect(host.querySelectorAll('[data-comment="reply"]')).toHaveLength(1);
  expect(host.querySelector('[data-comment="root"] [data-comment="reply"] [data-comment="nested"]')).not.toBeNull();
  expect(host.querySelector('[data-comment="root"] [data-comment="other"]')).toBeNull();
  expect(host.querySelector("[data-event]")).toBeNull();
});
it("renders only history in the activity section", async () => {
  await render("activity");
  expect(host.querySelector('[data-event="event"]')).not.toBeNull();
  expect(host.querySelector("[data-comment]")).toBeNull();
});
it("keeps orphaned and malformed threads visible without duplicates", async () => {
  state.comments.orphan = { id: "orphan", parent: "missing" };
  state.comments.cycleA = { id: "cycleA", parent: "cycleB" };
  state.comments.cycleB = { id: "cycleB", parent: "cycleA" };
  state.comments.self = { id: "self", parent: "self" };
  await render("comments");
  for (const id of Object.keys(state.comments)) {
    expect(host.querySelectorAll(`[data-comment="${id}"]`)).toHaveLength(1);
  }
});
