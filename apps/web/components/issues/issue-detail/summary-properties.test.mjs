/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const { transpileModule, ModuleKind, JsxEmit } = require("typescript");
const source = readFileSync(new URL("./summary-properties.tsx", import.meta.url), "utf8");
const compiled = transpileModule(source, {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
}).outputText;

function renderSummary(issue, disabled = false) {
  const updates = [];
  const exports = {};
  const modules = {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "mobx-react": { observer: (component) => component },
    "@makeplane/propel/icons": { BlockingOutline: "blocking", DueDateOutline: "date", MembersOutline: "members" },
    "@plane/blocks/property-select": { DateSelect: "DateSelect" },
    "@plane/i18n": { useTranslation: () => ({ t: (key) => key }) },
    "@plane/utils": {
      cn: (conditions) =>
        Object.keys(conditions)
          .filter((key) => conditions[key])
          .join(" "),
      getDate: (value) => (value ? new Date(value) : null),
      renderFormattedPayloadDate: (value) => value.toISOString().slice(0, 10),
      shouldHighlightIssueDueDate: (_date, group) => group === "started",
    },
    "@/components/common/layout/sidebar/property-list-item": { SidebarPropertyListItem: "Property" },
    "@/components/dropdowns/member/member-select": { MemberSelect: "MemberSelect" },
    "@/hooks/store/use-issue-detail": { useIssueDetail: () => ({ issue: { getIssueById: () => issue } }) },
    "@/hooks/store/use-project-state": { useProjectState: () => ({ getStateById: () => ({ group: "started" }) }) },
    "@/hooks/store/user": { useUserProfile: () => ({ data: { start_of_the_week: 1 } }) },
    "./relation-select": { IssueRelationSelect: "IssueRelationSelect" },
  };
  runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  const tree = exports.IssueSummaryProperties({
    workspaceSlug: "workspace",
    projectId: "project",
    issueId: "issue",
    disabled,
    issueOperations: {
      update: async (...args) => {
        updates.push(args);
      },
    },
  });
  return { tree, updates };
}

test("summary orders assignees, due date and dependencies before the description", () => {
  const { tree } = renderSummary({});
  assert.deepEqual(
    Array.from(tree.props.children, (row) => row.props.label),
    ["common.assignees", "common.order_by.due_date", "common.dependencies"]
  );
});

test("assignee changes retain multi-assignee support and update the same task", async () => {
  const { tree, updates } = renderSummary({ assignee_ids: ["member-1"] });
  const select = tree.props.children[0].props.children.props;
  assert.equal(select.multiple, true);
  assert.deepEqual(select.value, ["member-1"]);
  await select.onChange(["member-1", "member-2"]);
  assert.deepEqual(structuredClone(updates), [
    ["workspace", "project", "issue", { assignee_ids: ["member-1", "member-2"] }],
  ]);
});

test("due date supports saving and clearing, preserves minimum date and calendar preferences", async () => {
  const { tree, updates } = renderSummary({ start_date: "2026-10-16", target_date: "2026-10-20" });
  const select = tree.props.children[1].props.children.props;
  assert.equal(select.minDate.toISOString().slice(0, 10), "2026-10-16");
  assert.equal(select.value.toISOString().slice(0, 10), "2026-10-20");
  assert.equal(select.weekStartsOn, 1);
  assert.equal(select.clearable, true);
  assert.equal(select.className, "text-danger-primary");
  await select.onChange(new Date("2026-10-21"));
  await select.onChange(null);
  assert.deepEqual(structuredClone(updates.map((args) => args[3])), [
    { target_date: "2026-10-21" },
    { target_date: null },
  ]);
});

test("dependencies expose both directions and reuse the shared relation modal", () => {
  const { tree } = renderSummary({});
  const relations = tree.props.children[2].props.children.map((row) => row.props.children[1].props);
  assert.deepEqual(
    Array.from(relations, (relation) => relation.relationKey),
    ["blocked_by", "blocking"]
  );
  for (const relation of relations) {
    assert.equal(relation.renderModal, false);
    assert.equal(relation.issueId, "issue");
    assert.equal(relation.projectId, "project");
  }
});

test("read-only and archived tasks disable every summary editor", () => {
  const { tree } = renderSummary({}, true);
  assert.equal(tree.props.children[0].props.children.props.disabled, true);
  assert.equal(tree.props.children[1].props.children.props.disabled, true);
  for (const row of tree.props.children[2].props.children) {
    assert.equal(row.props.children[1].props.disabled, true);
  }
});

test("missing tasks do not render stale summary fields", () => {
  assert.equal(renderSummary(undefined).tree, null);
});
