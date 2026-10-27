import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IssueSearchModalEmptyState } from "./issue-search-modal-empty-state";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/empty-state/simple-empty-state-root", () => ({
  SimpleEmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));
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
});

it.each([true, false])(
  "explains excluded dependency candidates only for relation searches=%s",
  async (isRelationSearch) => {
    await act(() =>
      root.render(
        <IssueSearchModalEmptyState
          issues={[]}
          searchTerm=""
          debouncedSearchTerm=""
          isSearching={false}
          isRelationSearch={isRelationSearch}
        />
      )
    );
    expect(host.textContent?.includes("already-linked work items")).toBe(isRelationSearch);
  }
);

it("preserves the no-matching-results state when searching by name", async () => {
  await act(() =>
    root.render(
      <IssueSearchModalEmptyState
        issues={[]}
        searchTerm="logo"
        debouncedSearchTerm="logo"
        isSearching={false}
        isRelationSearch
      />
    )
  );
  expect(host.textContent).toBe("issue_relation.empty_state.no_issues.title");
});
