import { useState } from "react";
import type { IWorkspaceMember } from "@plane/types";
import { Input, InputGroup } from "@makeplane/propel/components/input";

export function MessageRecipients({
  members,
  selectedIds,
  disabled,
  onChange,
}: {
  members: IWorkspaceMember[];
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selected = new Set(selectedIds);
  const memberById = new Map(members.map(({ member }) => [member.id, member]));
  const matches = members.filter(({ member }) =>
    `${member.display_name} ${member.first_name} ${member.last_name} ${member.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <fieldset className="min-h-0 shrink-0 space-y-2" disabled={disabled}>
      <legend className="text-13 font-medium">To</legend>
      <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
        {selectedIds.map((id) => {
          const member = memberById.get(id);
          const name = member?.display_name || member?.first_name || "Unavailable recipient";
          return (
            <button
              type="button"
              key={id}
              aria-label={`Remove ${name}`}
              className="rounded bg-layer-1 px-2 py-1 text-12"
              onClick={() => onChange(selectedIds.filter((selectedId) => selectedId !== id))}
            >
              {name} &times;
            </button>
          );
        })}
      </div>
      <InputGroup size="md">
        <Input
          size="md"
          aria-label="Search workspace members"
          placeholder="Search workspace members"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </InputGroup>
      <div className="max-h-28 overflow-y-auto rounded border border-subtle p-2">
        {matches.map(({ member }) => (
          <label key={member.id} className="flex items-center gap-2 py-1 text-13">
            <input
              type="checkbox"
              checked={selected.has(member.id)}
              disabled={!selected.has(member.id) && selectedIds.length >= 100}
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...selectedIds, member.id] : selectedIds.filter((id) => id !== member.id)
                )
              }
            />
            {member.display_name || `${member.first_name} ${member.last_name}`}
          </label>
        ))}
        {matches.length === 0 && <p className="text-13 text-secondary">No matching workspace members.</p>}
      </div>
      <p className="text-12 text-secondary">{selectedIds.length} selected (up to 100)</p>
    </fieldset>
  );
}
