/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TCreateProjectDraft = {
  name: string;
  description: string;
  collaborators: string[];
  startDate: string;
  dueDate: string;
  file: File | null;
};

export const EMPTY_PROJECT_DRAFT: TCreateProjectDraft = {
  name: "",
  description: "",
  collaborators: [],
  startDate: "",
  dueDate: "",
  file: null,
};

// Mirrors Project.FORBIDDEN_IDENTIFIER_CHARS_PATTERN on the API.
const FORBIDDEN_NAME_CHARS = /[&+,:;$^}{*=?@#|'<>.()%!-]/;
const IDENTIFIER_MAX = 10;

export function projectDraftError(draft: TCreateProjectDraft): string | null {
  const name = draft.name.trim();
  if (!name) return "Enter a project name.";
  if (FORBIDDEN_NAME_CHARS.test(name)) return "Project name can't contain special characters like & + , : ; - . ( ) !";
  if (!draft.startDate) return "Select a start date.";
  if (!draft.dueDate) return "Select a due date.";
  if (draft.dueDate < draft.startDate) return "Due date can't be before the start date.";
  return null;
}

/** Short identifier candidates for a name, e.g. "Website Redesign" → WR, WR2, WR3… avoiding `taken`. */
export function identifierCandidates(name: string, taken: Iterable<string>, count = 5): string[] {
  const words = name
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  const base = (words.length > 1 ? words.map((word) => word[0]).join("") : (words[0] ?? "")).slice(0, 5) || "PRJ";
  const used = new Set([...taken].map((value) => value.toUpperCase()));
  const result: string[] = [];
  for (let suffix = 1; result.length < count; suffix += 1) {
    const tail = suffix === 1 ? "" : String(suffix);
    const candidate = `${base.slice(0, IDENTIFIER_MAX - tail.length)}${tail}`;
    if (!used.has(candidate)) result.push(candidate);
  }
  return result;
}

/** A project role can't exceed the member's workspace role; collaborators join as members (15) at most. */
export function collaboratorRole(workspaceRole: number | undefined): number {
  return Math.min(workspaceRole ?? 15, 15);
}

export function projectAttachmentUrl(origin: string, workspaceSlug: string, projectId: string, assetId: string) {
  return `${origin.replace(/\/$/, "")}/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/download/${assetId}/`;
}
