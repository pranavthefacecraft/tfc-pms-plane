/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useMember } from "@/hooks/store/use-member";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Up to three overlapping initials avatars for a task's collaborators, then a "+N" overflow. */
export const CollaboratorAvatars = observer(function CollaboratorAvatars({ ids }: { ids: string[] }) {
  const { getUserDetails } = useMember();
  return (
    <div className="flex items-center -space-x-1">
      {ids.slice(0, 3).map((id) => {
        const person = getUserDetails(id);
        const name =
          person?.display_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Team member";
        return (
          <span
            key={id}
            title={name}
            aria-label={name}
            className="grid size-6 place-items-center rounded-full border-2 border-white bg-[#1764E8] text-10 font-medium text-white"
          >
            {initials(name)}
          </span>
        );
      })}
      {ids.length > 3 && <span className="pl-2 text-11 text-secondary">+{ids.length - 3}</span>}
    </div>
  );
});
