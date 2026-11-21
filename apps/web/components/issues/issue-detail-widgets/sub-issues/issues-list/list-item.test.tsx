import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { TSubIssueOperations } from "@plane/types";
import { SubIssuesListItem } from "./list-item";

const state = vi.hoisted(() => ({ completed: false }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: {
      getIssueById: () => ({
        id: "task",
        project_id: "project",
        sequence_id: 3,
        name: "Review booking",
        state_id: "state",
        target_date: "2026-11-20",
        assignee_ids: ["person"],
      }),
    },
    subIssues: {
      filters: { getSubIssueFilters: () => undefined },
      subIssueHelpersByIssueId: () => ({ preview_loader: [], issue_visibility: [] }),
    },
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => undefined }) }));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: () => ({ group: state.completed ? "completed" : "started" }) }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: () => ({ display_name: "Pat Parker", avatar_url: "/avatar.png" }) }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: true }) }));
vi.mock("@/hooks/use-issue-peek-overview-redirection", () => ({
  default: () => ({ handleRedirection: vi.fn() }),
}));
vi.mock("@/components/issues/issue-detail-widgets/sub-issues/helper", () => ({
  useSubIssueOperations: () => ({ fetchSubIssues: vi.fn() }),
}));
vi.mock("@/components/issues/issue-detail/issue-identifier", () => ({ IssueIdentifier: () => null }));
vi.mock("./properties", () => ({ SubIssuesListItemProperties: () => <span>Standard properties</span> }));
vi.mock("./root", () => ({ SubIssuesListRoot: () => null }));

it.each([false, true])("shows the drawer layout and completion state (completed=%s)", (completed) => {
  state.completed = completed;
  const operations = {
    fetchSubIssues: vi.fn(),
    addSubIssue: vi.fn(),
    updateSubIssue: vi.fn(),
    removeSubIssue: vi.fn(),
    deleteSubIssue: vi.fn(),
    copyLink: vi.fn(),
  } satisfies TSubIssueOperations;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <SubIssuesListItem
      workspaceSlug="workspace"
      projectId="project"
      parentIssueId="parent"
      rootIssueId="parent"
      issueId="task"
      spacingLeft={6}
      canEdit
      presentation="drawer"
      handleIssueCrudState={vi.fn()}
      subIssueOperations={operations}
    />
  );
  const row = host.querySelector("a")!;
  expect(
    [...row.querySelectorAll('[role="img"], time, [title="Pat Parker"]')].map((element) => element.outerHTML)
  ).toEqual([
    expect.stringContaining(`aria-label="${completed ? "Completed" : "Incomplete"}"`),
    expect.stringContaining(">Nov 20</time>"),
    expect.stringContaining(">PP</span>"),
  ]);
  expect(row.textContent).toContain("Review booking");
  expect(row.querySelector('[aria-label="aria_labels.common.more_actions"]')).not.toBeNull();
  expect(row.textContent).not.toContain("Standard properties");
});
