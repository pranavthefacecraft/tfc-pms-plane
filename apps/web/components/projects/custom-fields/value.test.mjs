/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFieldDraft } from "./value.helpers.ts";

test("blank fields clear and text preserves user input", () => {
  for (const type of ["text", "number", "date"]) assert.equal(parseFieldDraft(type, ""), null);
  assert.equal(parseFieldDraft("text", " Notes "), " Notes ");
});
test("numbers support decimals, zero and negatives without NaN fallbacks", () => {
  for (const [input, value] of [
    ["0", 0],
    ["-12.75", -12.75],
    ["1e3", 1000],
  ]) {
    assert.equal(parseFieldDraft("number", input), value);
  }
  for (const input of [" ", "not a number", "Infinity", "NaN", "1e16"]) {
    assert.throws(() => parseFieldDraft("number", input));
  }
});
test("dates require real calendar dates, including leap-year validation", () => {
  assert.equal(parseFieldDraft("date", "2028-02-29"), "2028-02-29");
  for (const input of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-1-01", "tomorrow"]) {
    assert.throws(() => parseFieldDraft("date", input));
  }
});
