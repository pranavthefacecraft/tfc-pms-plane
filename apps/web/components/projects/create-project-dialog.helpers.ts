/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** A workspace member (`memberId`) or an email that gets a workspace invitation. */
export type TTeammate = {
  memberId?: string;
  email: string;
  role: number;
};

export type TCreateProjectDraft = {
  name: string;
  description: string;
  teammates: TTeammate[];
  startDate: string;
  dueDate: string;
  file: File | null;
};

export const EMPTY_PROJECT_DRAFT: TCreateProjectDraft = {
  name: "",
  description: "",
  teammates: [],
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

export const EDITOR_ROLE = 15;
export const VIEWER_ROLE = 5;
export const ROLE_LABELS: Record<number, string> = { 20: "Admin", 15: "Editor", 5: "Viewer" };

/** Roles a teammate can get: workspace admins are always project admins, guests can only view. */
export function teammateRoleOptions(workspaceRole: number | undefined): number[] {
  if (workspaceRole === 20) return [20];
  if (workspaceRole === 5) return [VIEWER_ROLE];
  return [EDITOR_ROLE, VIEWER_ROLE];
}

/** The project role the API accepts for a member: admins must be admins, others can't exceed their workspace role. */
export function collaboratorRole(workspaceRole: number | undefined, requested = EDITOR_ROLE): number {
  if (workspaceRole === 20) return 20;
  return Math.min(requested, workspaceRole ?? EDITOR_ROLE);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function projectAttachmentUrl(origin: string, workspaceSlug: string, projectId: string, assetId: string) {
  return `${origin.replace(/\/$/, "")}/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/download/${assetId}/`;
}

type TPerson = { id: string; name: string; email: string; isActive: boolean };

/** Members matching the invite box by name or email, and whether the text can be invited as a new email. */
export function teammateSuggestions(
  query: string,
  people: TPerson[],
  teammates: TTeammate[],
  currentUser: { id?: string; email?: string } | undefined,
  limit = 6
): { term: string; suggestions: TPerson[]; canInviteEmail: boolean } {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return { term, suggestions: [], canInviteEmail: false };
  const chosenIds = new Set(teammates.map((teammate) => teammate.memberId));
  const chosenEmails = new Set(teammates.map((teammate) => teammate.email.toLocaleLowerCase()));
  const suggestions = people
    .filter(
      (person) =>
        person.id !== currentUser?.id &&
        person.isActive &&
        !chosenIds.has(person.id) &&
        (person.name.toLocaleLowerCase().includes(term) || person.email.toLocaleLowerCase().includes(term))
    )
    .slice(0, limit);
  const canInviteEmail =
    isEmail(term) &&
    !chosenEmails.has(term) &&
    term !== currentUser?.email?.toLocaleLowerCase() &&
    !people.some((person) => person.email.toLocaleLowerCase() === term);
  return { term, suggestions, canInviteEmail };
}

/** Adds a teammate unless the same member (or the same invited email) is already in the list. */
export function withTeammate(previous: TTeammate[], teammate: TTeammate): TTeammate[] {
  const email = teammate.email.toLocaleLowerCase();
  const exists = previous.some((entry) =>
    teammate.memberId
      ? entry.memberId === teammate.memberId
      : !entry.memberId && entry.email.toLocaleLowerCase() === email
  );
  return exists ? previous : [...previous, teammate];
}

export function personName(
  user: { display_name?: string; first_name?: string; last_name?: string } | undefined,
  fallback: string
): string {
  return user?.display_name || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || fallback;
}
