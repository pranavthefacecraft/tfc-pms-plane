import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { TIssueOperations } from "../issue-detail";
import { PeekOverviewProperties } from "./properties";

const state = vi.hoisted(() => ({
  issue: { id: "task", project_id: "project", state_id: "backlog", section_id: "section", priority: "none" },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => state.issue } }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => ({}) }) }));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: {} }) }));
vi.mock("@/components/dropdowns/estimate/estimate-select", () => ({ EstimateSelect: () => null }));
vi.mock("@/components/dropdowns/member/avatar", () => ({ ButtonAvatars: () => null }));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({
  PrioritySelect: () => <span>Priority control</span>,
}));
vi.mock("@plane/blocks/property-select", () => ({ DateSelect: () => null }));
vi.mock("@/components/project-sections/section-select", () => ({ SectionSelect: () => <span>Section control</span> }));
vi.mock("@/components/issues/parent-select-root", () => ({ IssueParentSelectRoot: () => null }));
vi.mock("../issue-detail/cycle-select", () => ({ IssueCycleSelect: () => null }));
vi.mock("../issue-detail/module-select", () => ({ IssueModuleSelect: () => null }));
vi.mock("../issue-detail/label", () => ({ IssueLabel: () => null }));

it.each([true, false])("hides only the preview State row for disabled=%s without mutating state", (disabled) => {
  const operations = {
    fetch: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  } satisfies TIssueOperations;
  const html = renderToStaticMarkup(
    <PeekOverviewProperties
      workspaceSlug="workspace"
      projectId="project"
      issueId="task"
      disabled={disabled}
      issueOperations={operations}
    />
  );
  expect(html).not.toContain("common.state");
  expect(html).not.toContain("work-item-state-select");
  expect(html).toContain("Section control");
  expect(html).toContain("Priority control");
  expect(state.issue.state_id).toBe("backlog");
  expect(operations.update).not.toHaveBeenCalled();
});
