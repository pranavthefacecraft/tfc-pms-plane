/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Mail } from "lucide-react";

/** Matching workspace members, plus an "Invite <email>" option, under an invite-teammates input. */
export function SuggestionList({
  term,
  suggestions,
  canInviteEmail,
  onAddMember,
  onAddEmail,
}: {
  term: string;
  suggestions: { id: string; name: string; email: string }[];
  canInviteEmail: boolean;
  onAddMember: (id: string) => void;
  onAddEmail: () => void;
}) {
  return (
    <ul aria-label="Suggestions" className="rounded-lg border border-subtle bg-surface-1 py-1">
      {suggestions.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onAddMember(person.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-13 hover:bg-layer-1"
          >
            <span className="font-medium">{person.name}</span>
            {person.email && <span className="truncate text-12 text-secondary">{person.email}</span>}
          </button>
        </li>
      ))}
      {canInviteEmail && (
        <li>
          <button
            type="button"
            onClick={onAddEmail}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-13 hover:bg-layer-1"
          >
            <Mail className="size-3.5 text-secondary" aria-hidden="true" />
            Invite {term}
          </button>
        </li>
      )}
      {!suggestions.length && !canInviteEmail && (
        <li className="px-3 py-1.5 text-12 text-secondary">No teammates found. Type an email to invite.</li>
      )}
    </ul>
  );
}

export function Avatar({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#135DDD]/10 text-12 font-semibold text-[#135DDD] uppercase"
    >
      {label.trim().charAt(0) || "?"}
    </span>
  );
}
