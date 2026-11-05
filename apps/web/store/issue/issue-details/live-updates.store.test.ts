/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { EInboxIssueSource, EIssueCommentAccessSpecifier, EIssueServiceType } from "@plane/types";
import type { TIssue, TIssueActivity, TIssueComment, TIssueAttachment } from "@plane/types";
import type { IIssueDetail } from "./root.store";
import type { IIssueRootStore } from "../root.store";
import type { CoreRootStore } from "@/store/root.store";
import { IssueStore } from "./issue.store";
import { IssueCommentStore } from "./comment.store";
import { IssueActivityStore } from "./activity.store";
import { IssueAttachmentStore } from "./attachment.store";
import { BaseIssuesStore } from "../helpers/base-issues.store";
import type { IBaseIssueFilterStore } from "../helpers/issue-filter-helper.store";

vi.mock("@/store/root.store", () => ({ rootStore: {} }));
vi.mock("@/lib/store-context", () => ({ store: {} }));
vi.mock("@/services/issue", () => ({
  IssueService: class {
    retrieve = vi.fn();
  },
  IssueArchiveService: vi.fn(function () {
    return { retrieve: vi.fn() };
  }),
  WorkspaceDraftService: vi.fn(function () {
    return { retrieve: vi.fn() };
  }),
  IssueCommentService: class {
    getIssueComments = vi.fn();
  },
  IssueActivityService: class {
    getIssueActivities = vi.fn();
  },
  IssueAttachmentService: class {
    getIssueAttachments = vi.fn();
  },
}));

afterEach(() => vi.restoreAllMocks());

const task: TIssue = {
  id: "task",
  project_id: "project",
  name: "Remote title",
  sequence_id: 1,
  sort_order: 1,
  state_id: "done",
  section_id: "section",
  priority: "none",
  label_ids: [],
  assignee_ids: [],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  parent_id: null,
  cycle_id: null,
  module_ids: [],
  type_id: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  start_date: null,
  target_date: null,
  completed_at: null,
  archived_at: null,
  created_by: "user",
  updated_by: "user",
  is_draft: false,
  description_html: "<p>Remote description</p>",
  issue_reactions: [],
  issue_link: [],
};
const activityContext = {
  workspace: "workspace",
  workspace_detail: { id: "workspace", name: "Workspace", slug: "workspace" },
  project: "project",
  project_detail: {
    id: "project",
    name: "Project",
    identifier: "PR",
    cover_image: "",
    description: null,
    emoji: null,
    icon_prop: null,
  },
  issue: "task",
  issue_detail: {
    id: "task",
    sequence_id: 1,
    sort_order: false,
    name: "Task",
    description_html: "",
    priority: "none" as const,
    start_date: "",
    target_date: "",
    is_draft: false,
  },
  actor: "user",
  actor_detail: {
    id: "user",
    first_name: "Test",
    last_name: "User",
    avatar_url: "",
    is_bot: false,
    display_name: "Test",
  },
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  created_by: "user",
  updated_by: "user",
  attachments: [],
};
const comment: TIssueComment = {
  ...activityContext,
  id: "edited",
  comment_html: "Before",
  comment_json: {},
  comment_stripped: "Before",
  comment_reactions: [],
  external_id: undefined,
  external_source: undefined,
  access: EIssueCommentAccessSpecifier.INTERNAL,
};
const activity: TIssueActivity = {
  ...activityContext,
  id: "activity",
  verb: "updated",
  field: "description",
  old_value: "Before",
  new_value: "Before",
  comment: undefined,
  old_identifier: undefined,
  new_identifier: undefined,
  epoch: 1,
  issue_comment: null,
  source_data: { source: EInboxIssueSource.IN_APP, extra: {} },
};
const attachment: TIssueAttachment = {
  id: "document",
  attributes: { name: "Document", size: 123 },
  asset_url: "/test",
  issue_id: "task",
  updated_at: "2026-01-01",
  updated_by: "user",
  created_by: "user",
};

describe("authoritative live task snapshots", () => {
  it("keeps displayed list rows and pagination during background refresh and clears normally on navigation", () => {
    class TestIssueList extends BaseIssuesStore {
      fetchParentStats = vi.fn().mockResolvedValue(undefined);
      updateParentStats = vi.fn();
    }
    const store = new TestIssueList({} as IIssueRootStore, {} as IBaseIssueFilterStore);
    store.groupedIssueIds = { all: ["task"] };
    store.groupedIssueCount = { all: 1 };
    store.paginationOptions = { canGroup: true, perPageCount: 100 };
    const controller = store.controller;
    store.clear(false, true);
    expect(store.groupedIssueIds).toEqual({ all: ["task"] });
    expect(store.groupedIssueCount).toEqual({ all: 1 });
    expect(store.paginationOptions).toEqual({ canGroup: true, perPageCount: 100 });
    expect(controller.signal.aborted).toBe(true);
    expect(store.controller.signal.aborted).toBe(false);
    store.clear();
    expect(store.groupedIssueIds).toBeUndefined();
    expect(store.paginationOptions).toBeUndefined();
  });
  it("refreshes properties, descriptions and all detail widgets without invoking the initial loader", async () => {
    const fetch = () => vi.fn().mockResolvedValue([]);
    const root = {
      rootIssueStore: {
        issues: { addIssue: vi.fn(), removeIssue: vi.fn() },
        rootStore: { state: { fetchProjectStates: fetch() } },
      },
      addReactions: vi.fn(),
      addLinks: vi.fn(),
      addSubscription: vi.fn(),
      attachment: { fetchAttachments: fetch() },
      activity: { fetchActivities: fetch() },
      comment: { fetchComments: fetch() },
      subIssues: { fetchSubIssues: fetch() },
      relation: { fetchRelations: fetch() },
    } as unknown as IIssueDetail;
    const store = new IssueStore(root, EIssueServiceType.ISSUES);
    vi.mocked(store.issueService.retrieve).mockResolvedValue(task);
    await store.refreshIssue("workspace", "project", "task");
    expect(root.rootIssueStore.issues.addIssue).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Remote title",
        state_id: "done",
        section_id: "section",
        description_html: "<p>Remote description</p>",
      }),
    ]);
    expect(root.comment.fetchComments).toHaveBeenCalledWith("workspace", "project", "task", "mutate", true);
    expect(root.activity.fetchActivities).toHaveBeenCalledWith("workspace", "project", "task", "mutate", true);
    for (const fetcher of [
      root.attachment.fetchAttachments,
      root.subIssues.fetchSubIssues,
      root.relation.fetchRelations,
    ])
      expect(fetcher).toHaveBeenCalledWith("workspace", "project", "task");
    expect(store.getIsFetchingIssueDetails("task")).toBe(false);
  });

  it.each([401, 403, 404])("removes inaccessible/deleted cached tasks on HTTP %s", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const root = { rootIssueStore: { issues: { removeIssue: vi.fn() } } } as unknown as IIssueDetail;
    const store = new IssueStore(root, EIssueServiceType.ISSUES);
    vi.mocked(store.issueService.retrieve).mockRejectedValue({ isAxiosError: true, response: { status } });
    await store.refreshIssue("workspace", "project", "task");
    expect(root.rootIssueStore.issues.removeIssue).toHaveBeenCalledWith("task");
  });

  it("rethrows transient errors so the live refresh queue can retry", async () => {
    const store = new IssueStore({} as IIssueDetail, EIssueServiceType.ISSUES);
    vi.mocked(store.issueService.retrieve).mockRejectedValue(new Error("Network interrupted"));
    await expect(store.refreshIssue("workspace", "project", "task")).rejects.toThrow("Network interrupted");
  });

  it("replaces comments, including edits and deletions, and updates reactions", async () => {
    const root = { commentReaction: { applyCommentReactions: vi.fn() } } as unknown as IIssueDetail;
    const store = new IssueCommentStore(root, EIssueServiceType.ISSUES);
    vi.mocked(store.issueCommentService.getIssueComments)
      .mockResolvedValueOnce([comment, { ...comment, id: "deleted" }])
      .mockResolvedValueOnce([{ ...comment, comment_html: "After", comment_reactions: [{ id: "like" }] }]);
    await store.fetchComments("workspace", "project", "task");
    await store.fetchComments("workspace", "project", "task", "mutate", true);
    expect(store.getCommentsByIssueId("task")).toEqual(["edited"]);
    expect(store.getCommentById("edited")?.comment_html).toBe("After");
    expect(root.commentReaction.applyCommentReactions).toHaveBeenLastCalledWith("edited", [{ id: "like" }]);
    expect(store.issueCommentService.getIssueComments).toHaveBeenLastCalledWith("workspace", "project", "task", {});
  });

  it("reloads coalesced description activities instead of missing timestamp-only edits", async () => {
    const store = new IssueActivityStore({} as CoreRootStore);
    vi.mocked(store.issueActivityService.getIssueActivities)
      .mockResolvedValueOnce([activity])
      .mockResolvedValueOnce([{ ...activity, new_value: "After" }]);
    await store.fetchActivities("workspace", "project", "task");
    await store.fetchActivities("workspace", "project", "task", "mutate", true);
    expect(store.getActivitiesByIssueId("task")).toEqual(["activity"]);
    expect(store.getActivityById("activity")?.new_value).toBe("After");
    expect(store.issueActivityService.getIssueActivities).toHaveBeenLastCalledWith("workspace", "project", "task", {});
  });

  it("removes deleted attachments without clearing an upload in progress", async () => {
    const store = new IssueAttachmentStore({} as IIssueRootStore, EIssueServiceType.ISSUES);
    vi.mocked(store.issueAttachmentService.getIssueAttachments)
      .mockResolvedValueOnce([attachment])
      .mockResolvedValueOnce([]);
    await store.fetchAttachments("workspace", "project", "task");
    store.attachmentsUploadStatusMap.task = {
      upload: { id: "upload", name: "New document", progress: 50, size: 123, type: "text/plain" },
    };
    await store.fetchAttachments("workspace", "project", "task");
    expect(store.getAttachmentsByIssueId("task")).toEqual([]);
    expect(store.getAttachmentsUploadStatusByIssueId("task")?.[0].progress).toBe(50);
  });
});
