import { act } from "react";
import type { ComponentProps, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EIssueCommentAccessSpecifier } from "@plane/constants";
import { CommentCard } from "./root";

const state = vi.hoisted(() => ({ composer: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("../comment-block", () => ({
  CommentBlock: ({ children }: { children: ReactNode }) => <article>{children}</article>,
}));
vi.mock("./display", () => ({ CommentCardDisplay: () => <div>Comment body</div> }));
vi.mock("../quick-actions", () => ({ CommentQuickActions: () => null }));
vi.mock("../comment-create", () => ({
  CommentCreate: (props: { onSubmitCallback: (id: string) => void }) => {
    state.composer(props);
    return <button onClick={() => props.onSubmitCallback("reply")}>Save reply</button>;
  },
}));

const props: ComponentProps<typeof CommentCard> = {
  workspaceSlug: "team",
  entityId: "task",
  projectId: "project",
  ends: undefined,
  showAccessSpecifier: true,
  showCopyLinkOption: true,
  enableReplies: true,
  presentation: "drawer",
  comment: {
    id: "parent",
    workspace: "workspace",
    workspace_detail: { id: "workspace", name: "Workspace", slug: "team" },
    project: "project",
    project_detail: {
      id: "project",
      name: "Project",
      identifier: "PRJ",
      cover_image: "",
      description: null,
      emoji: null,
      icon_prop: null,
    },
    issue: "task",
    issue_detail: {
      id: "task",
      name: "Task",
      sequence_id: 1,
      sort_order: false,
      description_html: "",
      priority: "none",
      start_date: "",
      target_date: "",
      is_draft: false,
    },
    actor: "user",
    actor_detail: {
      id: "user",
      display_name: "Member",
      avatar_url: "",
      first_name: "Member",
      last_name: "",
      is_bot: false,
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    created_by: "user",
    updated_by: "user",
    attachments: [],
    comment_reactions: [],
    comment_stripped: "Comment",
    comment_html: "<p>Comment</p>",
    comment_json: {},
    external_id: undefined,
    external_source: undefined,
    access: EIssueCommentAccessSpecifier.INTERNAL,
  },
  activityOperations: {
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
  },
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("opens a real reply composer with parent context and closes it on success", async () => {
  await act(() => root.render(<CommentCard {...props} />));
  await act(() => host.querySelector("button")!.click());
  expect(state.composer).toHaveBeenLastCalledWith(
    expect.objectContaining({
      parentId: "parent",
      access: EIssueCommentAccessSpecifier.INTERNAL,
      entityId: "task",
      activityOperations: props.activityOperations,
    })
  );
  await act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Save reply")!.click());
  expect(host.textContent).not.toContain("Save reply");
  expect(host.querySelector("button")!.textContent).toBe("Reply");
});
it.each([{ disabled: true }, { enableReplies: false }, { presentation: undefined }])(
  "does not expose replies when unavailable: %j",
  async (overrides) => {
    await act(() => root.render(<CommentCard {...props} {...overrides} />));
    expect(host.querySelector("button")).toBeNull();
    expect(state.composer).not.toHaveBeenCalled();
  }
);
