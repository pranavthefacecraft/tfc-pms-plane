/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, createRef } from "react";
import type { EditorRefApi } from "@plane/editor";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeekOverviewIssueDetails } from "./issue-detail";
import { IssueView } from "./view";

const mocks = vi.hoisted(() => ({
  issue: { id: "task", project_id: "project", name: "Task", description_html: "<p>Details</p>" },
  properties: vi.fn(),
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => mocks.issue } }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: vi.fn() }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: null }) }));
vi.mock("@/hooks/use-reload-confirmation", () => ({ default: () => ({ setShowAlert: vi.fn() }) }));
vi.mock("@/hooks/use-live-issue-detail", () => ({ useLiveIssueDetail: vi.fn() }));
vi.mock("@/services/issue", () => ({
  WorkItemVersionService: vi.fn(function () {
    return {};
  }),
}));
vi.mock("@/components/core/description-versions", () => ({ DescriptionVersionsRoot: () => null }));
vi.mock("@/components/editor/rich-text/description-input", () => ({
  DescriptionInput: () => <div data-section="description" />,
}));
vi.mock("@/components/projects/custom-fields/task-fields", () => ({
  TaskCustomFields: () => <div data-section="custom-fields" />,
}));
vi.mock("@/components/issues/issue-type-switcher", () => ({ IssueTypeSwitcher: () => null }));
vi.mock("../issue-detail/parent", () => ({ IssueParentDetail: () => null }));
vi.mock("../issue-detail/reactions", () => ({ IssueReaction: () => null }));
vi.mock("../issue-detail/issue-activity", () => ({ IssueActivity: () => null }));
vi.mock("../issue-detail-widgets", () => ({ IssueDetailWidgets: () => null }));
vi.mock("./error", () => ({ IssuePeekOverviewError: () => null }));
vi.mock("./loader", () => ({ IssuePeekOverviewLoader: () => null }));
vi.mock("./header", () => ({
  IssuePeekOverviewHeader: ({ setPeekMode }: { setPeekMode: (mode: string) => void }) => (
    <button type="button" onClick={() => setPeekMode("modal")}>
      Switch to modal
    </button>
  ),
}));
vi.mock("../title-input", () => ({ IssueTitleInput: () => <div data-section="title" /> }));
vi.mock("../issue-detail/summary-properties", () => ({
  IssueSummaryProperties: () => <div data-section="dependencies" />,
}));
vi.mock("./properties", () => ({
  PeekOverviewProperties: (props: unknown) => {
    mocks.properties(props);
    return <div data-section="properties" />;
  },
}));

describe("task preview properties placement", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const operations = { fetch: vi.fn(), update: vi.fn(), remove: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render(disabled = false, isArchived = false) {
    await act(() =>
      root.render(
        <PeekOverviewIssueDetails
          editorRef={createRef<EditorRefApi>()}
          workspaceSlug="workspace"
          projectId="project"
          issueId="task"
          issueOperations={operations}
          disabled={disabled}
          isArchived={isArchived}
          isSubmitting="saved"
          setIsSubmitting={vi.fn()}
        />
      )
    );
  }

  it("renders properties once below dependencies and before custom fields and description", async () => {
    await render();
    expect([...host.querySelectorAll("[data-section]")].map((node) => node.getAttribute("data-section"))).toEqual([
      "title",
      "dependencies",
      "properties",
      "custom-fields",
      "description",
    ]);
    expect(mocks.properties).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workspaceSlug: "workspace",
        projectId: "project",
        issueId: "task",
        issueOperations: operations,
        disabled: false,
      })
    );
  });

  it.each([
    [true, false],
    [false, true],
  ])("preserves read-only state for disabled=%s archived=%s", async (disabled, archived) => {
    await render(disabled, archived);
    expect(mocks.properties).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }));
  });

  it("dims the project area only while task details are shown in the side panel", async () => {
    const projectPortal = document.createElement("div");
    projectPortal.id = "project-task-details-portal";
    const fullScreenPortal = document.createElement("div");
    fullScreenPortal.id = "full-screen-portal";
    host.before(projectPortal, fullScreenPortal);
    try {
      await act(() =>
        root.render(
          <IssueView
            workspaceSlug="workspace"
            projectId="project"
            issueId="task"
            issueOperations={operations}
            is_archived={false}
          />
        )
      );
      const switchMode = projectPortal.querySelector("button")!;
      expect(projectPortal.querySelector('[aria-hidden="true"]')).not.toBeNull();
      expect(fullScreenPortal.childElementCount).toBe(0);

      await act(() => switchMode.click());
      expect(projectPortal.childElementCount).toBe(0);
      expect(fullScreenPortal.querySelector("button")?.textContent).toBe("Switch to modal");
    } finally {
      projectPortal.remove();
      fullScreenPortal.remove();
    }
  });
});
