/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export function parseFieldDraft(type: "text" | "number" | "date", draft: string): string | number | null {
  if (draft === "") return null;
  if (type === "number") {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || Math.abs(number) > 1e15)
      throw new Error("Enter a finite number between -1000000000000000 and 1000000000000000.");
    return number;
  }
  if (type === "date") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft) ||
      Number.isNaN(Date.parse(`${draft}T00:00:00Z`)) ||
      new Date(`${draft}T00:00:00Z`).toISOString().slice(0, 10) !== draft
    )
      throw new Error("Enter a valid date.");
  }
  return draft;
}
