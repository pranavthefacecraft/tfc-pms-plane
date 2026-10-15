/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type WhiteboardDocument = {
  id: string;
  name: string;
  extension: ".pdf" | ".docx" | ".xlsx";
};

export function isWhiteboardDocument(value: unknown): value is WhiteboardDocument {
  if (!value || typeof value !== "object") return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) &&
    "name" in value &&
    typeof value.name === "string" &&
    "extension" in value &&
    [".pdf", ".docx", ".xlsx"].includes(String(value.extension))
  );
}

export function safeTextLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
