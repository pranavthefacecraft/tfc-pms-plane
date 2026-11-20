/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useMember } from "@/hooks/store/use-member";

export const collaboratorAddButtonClass =
  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-[#135DDD] bg-[#EAF2FF] p-0 text-[#3A4D66] hover:bg-[#DCEAFF] disabled:cursor-not-allowed";

function initials(name: string) {
  const words = name
    .toUpperCase()
    .split(/\s+/)
    .map((part) => part.match(/\p{L}/gu))
    .filter((letters) => letters !== null);
  const [first, second] = words;
  if (!first) return "TM";
  return first[0] + (second?.[0] ?? first[1] ?? first[0]);
}

export const CollaboratorAvatars = observer(function CollaboratorAvatars({
  ids,
  variant = "compact",
}: {
  ids: string[];
  variant?: "compact" | "project";
}) {
  const { getUserDetails } = useMember();
  if (!ids.length) return null;
  const project = variant === "project";
  const maxVisible = project ? 2 : 3;
  const hidden = ids.length - maxVisible;
  return (
    <div className={`flex shrink-0 items-center ${project ? "-space-x-2" : "-space-x-1"}`}>
      {ids.slice(0, maxVisible).map((id) => {
        const person = getUserDetails(id);
        const name =
          person?.display_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Team member";
        return (
          <span
            key={id}
            title={name}
            aria-label={name}
            className={`grid shrink-0 place-items-center rounded-full font-medium text-white ${project ? "size-8 bg-[#135DDD] text-14" : "border-surface-1 size-6 border-2 bg-[#1764E8] text-10"}`}
          >
            {initials(name)}
          </span>
        );
      })}
      {hidden > 0 && (
        <span
          aria-label={`${hidden} more collaborators`}
          className={
            project
              ? "grid size-8 shrink-0 place-items-center rounded-full bg-[#EAF2FF] text-14 font-semibold text-[#135DDD]"
              : "pl-2 text-11 text-secondary"
          }
        >
          +{hidden}
        </span>
      )}
    </div>
  );
});
