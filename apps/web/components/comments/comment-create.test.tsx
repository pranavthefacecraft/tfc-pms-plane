import { act, forwardRef, useImperativeHandle } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EIssueCommentAccessSpecifier } from "@plane/constants";
import { CommentCreate } from "./comment-create";

const state = vi.hoisted(() => ({ create: vi.fn(), clear: vi.fn(), saved: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace" }) }),
}));
vi.mock("@/services/file.service", () => ({ FileService: vi.fn(function FileService() {}) }));
vi.mock("@/components/editor/lite-text", () => ({
  LiteTextEditor: forwardRef(function Editor(
    props: {
      initialValue: string;
      onChange: (json: object, html: string) => void;
      onEnterKeyPress: (event: unknown) => void;
    },
    ref
  ) {
    useImperativeHandle(ref, () => ({ clearEditor: state.clear, isEditorReadyToDiscard: () => true }));
    return (
      <>
        <textarea
          aria-label="Reply text"
          value={props.initialValue}
          onChange={(event) => props.onChange({}, event.target.value)}
        />
        <button onClick={props.onEnterKeyPress}>Send reply</button>
      </>
    );
  }),
}));
const operations = {
  copyCommentLink: vi.fn(),
  createComment: state.create,
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
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root.render(
      <CommentCreate
        entityId="task"
        workspaceSlug="team"
        projectId="project"
        activityOperations={operations}
        parentId="parent-comment"
        access={EIssueCommentAccessSpecifier.INTERNAL}
        presentation="drawer"
        onSubmitCallback={state.saved}
      />
    )
  );
  await act(() => {
    const input = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "<p>A reply</p>");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("saves replies with their parent and inherited access", async () => {
  state.create.mockResolvedValue({ id: "new-reply" });
  await act(() => host.querySelector("button")!.click());
  expect(state.create).toHaveBeenCalledWith(
    expect.objectContaining({
      parent: "parent-comment",
      access: EIssueCommentAccessSpecifier.INTERNAL,
      comment_html: "<p>A reply</p>",
    })
  );
  expect(state.saved).toHaveBeenCalledWith("new-reply");
  expect(state.clear).toHaveBeenCalledOnce();
});
it("preserves a reply draft when creation is unsuccessful", async () => {
  state.create.mockResolvedValue(undefined);
  await act(() => host.querySelector("button")!.click());
  expect(state.saved).not.toHaveBeenCalled();
  expect(state.clear).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")!.value).toBe("<p>A reply</p>");
});
