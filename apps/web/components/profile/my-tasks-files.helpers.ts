/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getFileURL } from "@plane/utils";
import type { TMyTaskFile } from "@/services/workspace-my-tasks.service";

export type TFileKind = "image" | "archive" | "document" | "link";
export type TFileFilter = "all" | "image" | "file" | "link";

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const ARCHIVE_EXTENSION = /\.(zip|rar|7z|tar|gz)$/i;

export function fileKind(file: TMyTaskFile): TFileKind {
  if (file.kind === "link") return "link";
  if (file.mime_type.startsWith("image/") || IMAGE_EXTENSION.test(file.name)) return "image";
  if (ARCHIVE_EXTENSION.test(file.name)) return "archive";
  return "document";
}

/** Only http(s) links are opened as-is so stored values like `javascript:` can never run. */
export function fileHref(file: TMyTaskFile): string {
  if (file.kind === "attachment") return getFileURL(file.url) ?? "#";
  const url = file.url.trim();
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^[a-z][a-z0-9+.-]*:\/*/i, "")}`;
}

export function matchesFileFilter(file: TMyTaskFile, filter: TFileFilter, query: string): boolean {
  const kind = fileKind(file);
  if (filter === "image" && kind !== "image") return false;
  if (filter === "link" && kind !== "link") return false;
  if (filter === "file" && (kind === "image" || kind === "link")) return false;
  const term = query.trim().toLocaleLowerCase();
  return !term || [file.name, file.url, file.issue_name].some((value) => value.toLocaleLowerCase().includes(term));
}
