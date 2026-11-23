/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, createRef } from "react";
import type { ReactNode } from "react";
import type { EditorRefApi } from "@plane/editor";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeekOverviewIssueDetails } from "./issue-detail";
import { IssueView } from "./view";

const mocks = vi.hoisted(() => ({
  issue: { id: "task", project_id: "project", name: "Task", description_html: "<p>Details</p>" },
  properties: vi.fn(),
  attachment: vi.fn(),
  fields: vi.fn(),
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => mocks.issue } }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: vi.fn() }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ name: "Current project" }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: null }) }));
vi.mock("@/hooks/use-reload-confirmation", () => ({ default: () => ({ setShowAlert: vi.fn() }) }));
vi.mock("@/hooks/use-live-issue-detail", () => ({ useLiveIssueDetail: vi.fn() }));
vi.mock("@/hooks/use-live-task-updates", () => ({ useLiveTaskUpdates: vi.fn() }));
vi.mock("@/services/issue", () => ({
  WorkItemVersionService: vi.fn(function () {
    return {};
  }),
}));
vi.mock("@/components/core/description-versions", () => ({ DescriptionVersionsRoot: () => null }));
vi.mock("@/components/editor/rich-text/description-input", () => ({
  DescriptionInput: () => <div data-section="description" />,
}));
vi.mock("@/components/projects/custom-fields/service", () => ({
  useCustomFields: () => ({ data: mocks.fields(), mutate: vi.fn() }),
  customFields: { values: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/components/issues/issue-type-switcher", () => ({ IssueTypeSwitcher: () => null }));
vi.mock("../issue-detail/parent", () => ({ IssueParentDetail: () => null }));
vi.mock("../issue-detail/reactions", () => ({ IssueReaction: () => null }));
vi.mock("../issue-detail/issue-activity", () => ({
  IssueActivity: ({ activityOnly }: { activityOnly?: boolean }) => (
    <div data-section={activityOnly ? "activity" : "comments"}>{activityOnly ? "Activity" : "Comments"}</div>
  ),
}));
vi.mock("../issue-detail-widgets", () => ({ IssueDetailWidgets: () => <div data-section="widgets">Widgets</div> }));
vi.mock("../issue-detail-widgets/issue-detail-widget-modals", () => ({ IssueDetailWidgetModals: () => null }));
vi.mock("./drawer-widgets", () => ({
  PeekDrawerWidgets: () => (
    <>
      <div>Subtasks</div>
      <div>Attached Files</div>
    </>
  ),
}));
vi.mock("./dependencies", () => ({ PeekOverviewDependencies: () => <div>Dependencies</div> }));
vi.mock("../issue-detail-widgets/attachments/quick-action-button", () => ({
  IssueAttachmentActionButton: (props: { customButton: ReactNode; disabled: boolean }) => {
    mocks.attachment(props);
    return (
      <button type="button" disabled={props.disabled}>
        {props.customButton}
      </button>
    );
  },
}));
vi.mock("./error", () => ({ IssuePeekOverviewError: () => null }));
vi.mock("./loader", () => ({ IssuePeekOverviewLoader: () => null }));
vi.mock("./header", () => ({
  IssuePeekOverviewHeader: ({ setPeekMode }: { setPeekMode: (mode: string) => void }) => (
    <button type="button" onClick={() => setPeekMode("modal")}>
      Switch to modal
    </button>
  ),
}));
vi.mock("../title-input", () => ({ IssueTitleInput: () => <div>Title</div> }));
vi.mock("../issue-detail/summary-properties", () => ({
  IssueAssignmentAndDueDate: ({ assigneeLabel }: { assigneeLabel: string }) => (
    <>
      <div>{assigneeLabel}</div>
      <div>Due date</div>
    </>
  ),
  IssueDependencies: () => <div>Dependencies</div>,
}));
vi.mock("./properties", () => ({
  PeekOverviewPriority: () => <div>Priority</div>,
  PeekOverviewSection: () => <div>Section</div>,
  PeekOverviewProperties: (props: unknown) => {
    mocks.properties(props);
    return <div>Other properties</div>;
  },
}));

describe("task preview properties placement", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const operations = { fetch: vi.fn(), update: vi.fn(), remove: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fields.mockReturnValue(
      ["Status", "Effort", "Stage"].map((name) => ({ id: name, name, field_type: "text", options: [] }))
    );
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
        <MemoryRouter>
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
          >
            <div>Subtasks</div>
            <div>Attached Files</div>
            <div>Comments</div>
          </PeekOverviewIssueDetails>
        </MemoryRouter>
      )
    );
  }

  it("puts description after dependencies and keeps other fields below comments", async () => {
    await render();
    const properties = host.querySelector('[aria-label="common.properties"]');
    const fields = [...(properties?.children ?? [])].flatMap((node) =>
      node.matches('section[aria-label="Custom fields"]')
        ? [...node.querySelectorAll("p")].map((label) => label.textContent)
        : (node.firstElementChild?.textContent ?? node.textContent)
    );
    expect(fields).toEqual([
      "Assigned To",
      "Due date",
      "Priority",
      "Section",
      "Stage",
      "Status",
      "Attach File",
      "Link To Project",
      "Dependencies",
      "common.description",
      "Subtasks",
      "Attached Files",
      "Comments",
      "Other properties",
      "Effort",
    ]);
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/workspace/projects/project/issues/");
    expect(host.querySelector('section[aria-label="common.description"] [data-section="description"]')).not.toBeNull();
    expect(mocks.properties).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workspaceSlug: "workspace",
        projectId: "project",
        issueId: "task",
        issueOperations: operations,
        disabled: false,
        hidePriority: true,
        hideSection: true,
      })
    );
    expect(mocks.attachment).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: false, issueId: "task" }));
  });

  it("keeps attachment and dependencies available without configured custom fields", async () => {
    mocks.fields.mockReturnValue([]);
    await render();
    expect(host.textContent).toContain("Attach File");
    expect(host.textContent).toContain("Dependencies");
    expect(host.querySelector('section[aria-label="Custom fields"]')).toBeNull();
  });

  it.each([
    [true, false],
    [false, true],
  ])("preserves read-only state for disabled=%s archived=%s", async (disabled, archived) => {
    await render(disabled, archived);
    expect(mocks.properties).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }));
    expect(mocks.attachment).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }));
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
          <MemoryRouter>
            <IssueView
              workspaceSlug="workspace"
              projectId="project"
              issueId="task"
              issueOperations={operations}
              is_archived={false}
            />
          </MemoryRouter>
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

  it("places activity at the end after comments, properties, and widgets", async () => {
    await act(() =>
      root.render(
        <MemoryRouter>
          <IssueView
            workspaceSlug="workspace"
            projectId="project"
            issueId="task"
            issueOperations={operations}
            is_archived={false}
            embedIssue
          />
        </MemoryRouter>
      )
    );
    expect([...host.querySelectorAll("[data-section]")].map((node) => node.getAttribute("data-section"))).toEqual([
      "description",
      "comments",
      "widgets",
      "activity",
    ]);
    const activity = host.querySelector('[data-section="activity"]')!;
    expect(activity.parentElement?.lastElementChild).toBe(activity);
    expect(host.textContent!.indexOf("Other properties")).toBeLessThan(host.textContent!.indexOf("Activity"));
  });
});
