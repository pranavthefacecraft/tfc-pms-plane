/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { taskPanelDefaults, usesTaskPanel } from "./create-task-entry.helpers";

describe("usesTaskPanel", () => {
  it("opens the side form for plain creates and board or list group payloads", () => {
    expect(usesTaskPanel({ inCycleOrModule: false })).toBe(true);
    expect(
      usesTaskPanel({
        data: { project_id: "p", state_id: "s", priority: "high", assignee_ids: ["u"], label_ids: [] },
        storeType: EIssuesStoreType.PROJECT,
        inCycleOrModule: false,
      })
    ).toBe(true);
  });

  it("keeps the popup when the side form would lose context", () => {
    expect(usesTaskPanel({ inCycleOrModule: true })).toBe(false);
    expect(usesTaskPanel({ isDraft: true, inCycleOrModule: false })).toBe(false);
    expect(usesTaskPanel({ storeType: EIssuesStoreType.EPIC, inCycleOrModule: false })).toBe(false);
    expect(usesTaskPanel({ data: { id: "existing" }, inCycleOrModule: false })).toBe(false);
    expect(usesTaskPanel({ data: { parent_id: "parent" }, inCycleOrModule: false })).toBe(false);
    expect(usesTaskPanel({ data: { label_ids: ["bug"] }, inCycleOrModule: false })).toBe(false);
  });
});

describe("taskPanelDefaults", () => {
  it("presets project, section and group values", () => {
    expect(
      taskPanelDefaults({ section_id: null, state_id: "s", priority: "urgent", assignee_ids: ["u"] }, "route-project")
    ).toEqual({ projectId: "route-project", sectionId: null, stateId: "s", priority: "urgent", assignees: ["u"] });
    expect(taskPanelDefaults({ project_id: "p" }, "route-project")).toEqual({ projectId: "p" });
    expect(taskPanelDefaults(undefined)).toEqual({});
  });
});
