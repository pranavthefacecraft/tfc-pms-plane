import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IssueActivity } from "./root";

const state = vi.hoisted(() => ({ composer: vi.fn(), feed: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/hooks", () => ({
  useLocalStorage: (_key: string, value: unknown) => ({ storedValue: value, setValue: vi.fn() }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ id: "project" }) }),
}));
vi.mock("./helper", () => ({ useWorkItemCommentOperations: () => ({}) }));
vi.mock("./sort-root", () => ({ ActivitySortRoot: () => <button>Sort</button> }));
vi.mock("./filter-root", () => ({ ActivityFilterRoot: () => <button>Filter</button> }));
vi.mock("@/components/comments/comment-create", () => ({
  CommentCreate: (props: unknown) => {
    state.composer(props);
    return <div data-composer />;
  },
}));
vi.mock("./activity-comment-root", () => ({
  IssueActivityCommentRoot: (props: unknown) => {
    state.feed(props);
    return <div data-feed />;
  },
}));

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

async function render(presentation?: "drawer", disabled = false, activityOnly = false) {
  await act(() =>
    root.render(
      <IssueActivity
        workspaceSlug="team"
        projectId="project"
        issueId="task"
        presentation={presentation}
        disabled={disabled}
        activityOnly={activityOnly}
      />
    )
  );
}

it("shows the drawer composer before the combined comments and activity feed", async () => {
  await render("drawer");
  expect(host.querySelector("h3")?.textContent).toBe("Comments And Activity");
  expect(state.composer).toHaveBeenLastCalledWith(
    expect.objectContaining({ presentation: "drawer", showToolbarInitially: true })
  );
  expect(state.feed).toHaveBeenLastCalledWith(expect.objectContaining({ presentation: "drawer", mode: "comments" }));
  expect(host.querySelector("[data-composer]")?.compareDocumentPosition(host.querySelector("[data-feed]")!)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
  expect(host.textContent).toContain("Sort");
  expect(host.textContent).toContain("Filter");
});

it("renders activity separately without a comment composer", async () => {
  await render("drawer", false, true);
  expect(host.querySelector("h3")?.textContent).toBe("common.activity");
  expect(host.querySelector("[data-composer]")).toBeNull();
  expect(state.feed).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "activity" }));
});

it("keeps the full page activity layout and hides the composer for read-only tasks", async () => {
  await render();
  expect(host.querySelector("h3")?.textContent).toBe("common.activity");
  expect(state.feed).toHaveBeenLastCalledWith(expect.objectContaining({ presentation: undefined }));
  await render("drawer", true);
  expect(host.querySelector("[data-composer]")).toBeNull();
  expect(host.querySelector("[data-feed]")).not.toBeNull();
});
