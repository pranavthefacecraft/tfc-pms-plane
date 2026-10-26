/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export function sectionErrorMessage(error: unknown): string {
  if (error instanceof Error && !("response" in error)) return error.message;
  if (typeof error === "object" && error !== null) {
    if ("response" in error && error.response) return sectionErrorMessage(error.response);
    if ("data" in error && error.data) return sectionErrorMessage(error.data);
    for (const key of ["name", "sort_order", "detail", "error", "message"]) {
      if (key in error) {
        const value: unknown = Reflect.get(error, key);
        if (typeof value === "string") return value;
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      }
    }
  }
  return "The section could not be saved. Please try again.";
}
