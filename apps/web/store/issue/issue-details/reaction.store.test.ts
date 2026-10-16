/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import type { TIssueReaction } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { IssueReactionStore } from "./reaction.store";

vi.mock("@/services/issue", () => ({
  IssueReactionService: class {
    deleteIssueReaction = vi.fn();
    createIssueReaction = vi.fn();
    listIssueReactions = vi.fn();
  },
}));

const ownLike: TIssueReaction = {
  id: "own-like",
  actor: "user-1",
  reaction: "128077",
  issue: "task",
  display_name: "Member one",
};
const otherLike: TIssueReaction = {
  id: "other-like",
  actor: "user-2",
  reaction: "128077",
  issue: "task",
  display_name: "Member two",
};

function setup() {
  const root = { activity: { fetchActivities: vi.fn() } };
  const store = new IssueReactionStore(root, EIssueServiceType.ISSUES);
  store.addReactions("task", [ownLike, otherLike]);
  return store;
}

describe("persistent task likes", () => {
  it("reloads likes from the server", async () => {
    const store = setup();
    vi.mocked(store.issueReactionService.listIssueReactions).mockResolvedValue([ownLike, otherLike]);
    await store.fetchReactions("workspace", "project", "task");
    expect(store.getReactionsByIssueId("task")?.["128077"]).toHaveLength(2);
    expect(store.reactionsByUser("task", "user-1")).toHaveLength(1);
  });

  it("removes only the current user's like after server confirmation", async () => {
    const store = setup();
    vi.mocked(store.issueReactionService.deleteIssueReaction).mockResolvedValue(undefined);
    await store.removeReaction("workspace", "project", "task", "128077", "user-1");
    expect(store.getReactionsByIssueId("task")?.["128077"]).toEqual(["other-like"]);
    expect(store.getReactionById("own-like")).toBeUndefined();
    expect(store.getReactionById("other-like")?.actor).toBe("user-2");
  });

  it("preserves the liked state and count if the server rejects an unlike", async () => {
    const store = setup();
    vi.mocked(store.issueReactionService.deleteIssueReaction).mockRejectedValue(new Error("Offline"));
    await expect(store.removeReaction("workspace", "project", "task", "128077", "user-1")).rejects.toThrow("Offline");
    expect(store.getReactionsByIssueId("task")?.["128077"]).toHaveLength(2);
    expect(store.reactionsByUser("task", "user-1")).toHaveLength(1);
  });
});
