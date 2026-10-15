/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { isWhiteboardDocument, safeTextLink } from "./documents.helpers.ts";

test("document metadata accepts only valid IDs and supported formats", () => {
  const document = { id: "12345678-1234-1234-1234-123456789abc", name: "Notes.docx", extension: ".docx" };
  for (const extension of [".pdf", ".docx", ".xlsx"]) {
    assert.equal(isWhiteboardDocument({ ...document, extension }), true);
  }
  for (const value of [null, {}, { ...document, id: "../other" }, { ...document, extension: ".html" }]) {
    assert.equal(isWhiteboardDocument(value), false);
  }
});

test("text links accept web and email URLs and reject executable or malformed URLs", () => {
  assert.equal(safeTextLink("https://example.com"), "https://example.com/");
  assert.equal(safeTextLink("http://example.com/a"), "http://example.com/a");
  assert.equal(safeTextLink("mailto:team@example.com"), "mailto:team@example.com");
  for (const value of ["javascript:alert(1)", "data:text/html,test", "file:///secret", "example.com", ""]) {
    assert.equal(safeTextLink(value), null);
  }
});
