import { act } from "react";
import { createRoot } from "react-dom/client";
import { Command } from "cmdk";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceSearch } from "./workspace-search";
import type { SearchCategory } from "./workspace-search";
import type { TPMSSearchResult, TPMSSearchResponse } from "@/services/pms-search.service";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  more: vi.fn(),
  retry: vi.fn(),
  loading: false,
  error: false,
  debounce: null as string | null,
  hasMore: false,
  empty: false,
  keys: [] as unknown[],
  category: "all",
}));
const results: TPMSSearchResult[] = [
  {
    id: "my-tasks",
    kind: "navigation",
    name: "My tasks",
    detail: "Go to page",
    href: "/second/profile/me",
    workspace_slug: "second",
    workspace_name: "Second workspace",
  },
  {
    id: "task",
    kind: "tasks",
    name: "My task module",
    detail: "PMS-12",
    href: "/second/projects/project/issues/task",
    workspace_slug: "second",
    workspace_name: "Second workspace",
  },
  {
    id: "personal",
    kind: "tasks",
    name: "My private task",
    detail: "Personal task",
    href: "/team/profile/me?personal_task=personal",
    workspace_slug: "team",
    workspace_name: "Team",
  },
  {
    id: "project",
    kind: "projects",
    name: "Design project",
    detail: "DES",
    href: "/team/projects/project/overview",
    workspace_slug: "team",
    workspace_name: "Team",
  },
  {
    id: "person",
    kind: "people",
    name: "Design teammate",
    detail: "teammate@example.test",
    href: "/team/profile/person",
    workspace_slug: "team",
    workspace_name: "Team",
  },
  {
    id: "document",
    kind: "documents",
    name: "Design whiteboard",
    detail: "Whiteboard",
    href: "/second/tool/whiteboards/document",
    workspace_slug: "second",
    workspace_name: "Second workspace",
  },
  {
    id: "file",
    kind: "files",
    name: "Design.pdf",
    detail: "File attachment",
    href: "/team/projects/project/files",
    workspace_slug: "team",
    workspace_name: "Team",
  },
];
vi.mock("swr/infinite", () => ({
  default: (getKey: (index: number, previous: TPMSSearchResponse | null) => unknown) => {
    const key = getKey(0, null);
    mocks.keys.push(key);
    return {
      data:
        key && !mocks.loading && !mocks.error
          ? [
              {
                results: mocks.empty
                  ? []
                  : results.filter((item) => mocks.category === "all" || item.kind === mocks.category),
                has_more: mocks.hasMore,
                next_offset: mocks.hasMore ? 20 : null,
              },
            ]
          : undefined,
      isLoading: mocks.loading,
      error: mocks.error ? new Error("Request failed") : undefined,
      isValidating: false,
      size: 1,
      setSize: mocks.more,
      mutate: mocks.retry,
    };
  },
}));
vi.mock("swr", () => ({
  default: () => ({ data: [], isLoading: false, mutate: mocks.retry }),
}));
vi.mock("@/hooks/use-debounce", () => ({ default: (value: string) => mocks.debounce ?? value }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "me" } }) }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const close = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  mocks.loading = false;
  mocks.error = false;
  mocks.debounce = null;
  mocks.hasMore = false;
  mocks.empty = false;
  mocks.keys = [];
  mocks.push.mockReset();
  mocks.more.mockReset();
  mocks.retry.mockReset();
  close.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(category: SearchCategory = "all", query = "my tasks") {
  mocks.category = category;
  await act(() =>
    root.render(
      <Command shouldFilter={false}>
        <Command.List
          ref={(node) => {
            node?.querySelectorAll<HTMLElement>("[cmdk-item], [cmdk-group-heading]").forEach((item) => {
              item.scrollIntoView = vi.fn();
            });
          }}
        >
          <WorkspaceSearch workspaceSlug="team" category={category} searchTerm={query} onClose={close} />
        </Command.List>
      </Command>
    )
  );
}
it("shows My tasks navigation and task results across workspaces", async () => {
  await render();
  expect(host.textContent).toContain("My tasks");
  expect(host.textContent).toContain("My task module");
  expect(host.textContent).toContain("Second workspace");
  expect(mocks.keys).toContainEqual(["PMS_SEARCH", "me", "my tasks", "all", 0]);
  expect(host.querySelectorAll("[cmdk-item]")).toHaveLength(7);
});
it.each(["tasks", "projects", "people", "documents", "files"] as const)(
  "requests %s category from global search",
  async (category) => {
    await render(category);
    expect(mocks.keys).toContainEqual(["PMS_SEARCH", "me", "my tasks", category, 0]);
    expect(host.querySelectorAll("[cmdk-item]")).toHaveLength(category === "tasks" ? 2 : 1);
  }
);
it("opens cross-workspace navigation and closes the dropdown", async () => {
  await render();
  await act(() => host.querySelector<HTMLElement>("[cmdk-item]")?.click());
  expect(close).toHaveBeenCalledOnce();
  expect(mocks.push).toHaveBeenCalledWith("/second/profile/me");
});
it("loads additional result pages rather than silently truncating matches", async () => {
  mocks.hasMore = true;
  await render();
  const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Show more results");
  expect(button).toBeDefined();
  await act(() => button?.click());
  expect(mocks.more).toHaveBeenCalledWith(2);
});
it("handles failed additional pages without unhandled promise rejections", async () => {
  const error = new Error("Request failed");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    mocks.hasMore = true;
    mocks.more.mockRejectedValueOnce(error);
    await render();
    const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Show more results");
    await act(() => button?.click());
    expect(log).toHaveBeenCalledWith("Unable to load more PMS search results.", error);
  } finally {
    log.mockRestore();
  }
});
it("shows loading without stale results while debouncing", async () => {
  mocks.debounce = "old query";
  await render();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading...");
  expect(host.querySelectorAll("[cmdk-item]")).toHaveLength(0);
});
it("offers an explicit retry for failed search", async () => {
  mocks.error = true;
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Unable to load");
  await act(() => host.querySelector<HTMLButtonElement>('[role="alert"] button')?.click());
  expect(mocks.retry).toHaveBeenCalledOnce();
  expect(mocks.retry).toHaveBeenCalledWith(undefined, { throwOnError: false });
  expect(host.textContent).not.toContain("No matching results");
});
it("shows empty state only after a successful empty response", async () => {
  mocks.empty = true;
  await render();
  expect(host.textContent).toContain("No matching results.");
});
it("does not call global search on an empty query", async () => {
  await render("all", "");
  expect(mocks.keys).toContain(null);
  expect(host.textContent).toContain("No recent items.");
});
