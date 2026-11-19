/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useMember } from "@/hooks/store/use-member";

const pastelBackgrounds = ["bg-[#FFD2DD]", "bg-[#DED0F7]", "bg-[#A7F3D0]"];

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

/** Up to three overlapping initials avatars for a task's collaborators, then a "+N" overflow. */
export const CollaboratorAvatars = observer(function CollaboratorAvatars({
  ids,
  pastel = false,
}: {
  ids: string[];
  pastel?: boolean;
}) {
  const { getUserDetails } = useMember();
  return (
    <div className={`flex items-center ${pastel ? "gap-1" : "-space-x-1"}`}>
      {ids.slice(0, 3).map((id) => {
        const person = getUserDetails(id);
        const name =
          person?.display_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Team member";
        return (
          <span
            key={id}
            title={name}
            aria-label={name}
            className={`grid size-6 shrink-0 place-items-center rounded-full font-medium ${pastel ? `${pastelBackgrounds[id.charCodeAt(0) % pastelBackgrounds.length]} text-11 text-[#111827]` : "border-surface-1 border-2 bg-[#1764E8] text-10 text-white"}`}
          >
            {initials(name)}
          </span>
        );
      })}
      {ids.length > 3 && <span className="pl-2 text-11 text-secondary">+{ids.length - 3}</span>}
    </div>
  );
});
