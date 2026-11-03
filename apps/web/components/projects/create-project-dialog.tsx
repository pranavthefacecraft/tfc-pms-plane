/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useId, useState } from "react";
import { observer } from "mobx-react";
import { CalendarDays, ChevronDown, Lock, Mail, X } from "lucide-react";
import { API_BASE_URL, RANDOM_EMOJI_CODES } from "@plane/constants";
import { Dialog, DialogContent, DialogTitle } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import { EFileAssetType } from "@plane/types";
import type { TProject } from "@plane/types";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { FileService } from "@/services/file.service";
import { ProjectCollaboratorsService } from "@/services/project-collaborators.service";
import {
  EDITOR_ROLE,
  EMPTY_PROJECT_DRAFT,
  ROLE_LABELS,
  VIEWER_ROLE,
  collaboratorRole,
  identifierCandidates,
  projectAttachmentUrl,
  projectDraftError,
  teammateRoleOptions,
  teammateSuggestions,
  personName,
  withTeammate,
} from "./create-project-dialog.helpers";
import type { TCreateProjectDraft, TTeammate } from "./create-project-dialog.helpers";

const fileService = new FileService();
const collaboratorsService = new ProjectCollaboratorsService();

const fieldClass =
  "w-full rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none placeholder:text-placeholder focus:border-[#135DDD] focus:ring-1 focus:ring-[#135DDD]";

function apiErrorCodes(error: unknown): string[] {
  const data = (error as { data?: Record<string, unknown> } | undefined)?.data ?? error;
  if (!data || typeof data !== "object") return [];
  return Object.values(data as Record<string, unknown>).flatMap((value) =>
    Array.isArray(value) ? value.map(String) : [String(value)]
  );
}

const keyOf = (teammate: TTeammate) => teammate.memberId ?? teammate.email;

const CollaboratorPicker = observer(function CollaboratorPicker({
  teammates,
  onChange,
}: {
  teammates: TTeammate[];
  onChange: (update: (previous: TTeammate[]) => TTeammate[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: currentUser } = useUser();
  const {
    getUserDetails,
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();
  const nameOf = (id: string) => personName(getUserDetails(id), "Team member");
  const emailOf = (id: string) => getUserDetails(id)?.email ?? "";
  const people = (workspaceMemberIds ?? []).map((id) => ({
    id,
    name: nameOf(id),
    email: emailOf(id),
    isActive: getWorkspaceMemberDetails(id)?.is_active !== false,
  }));
  const { term, suggestions, canInviteEmail } = teammateSuggestions(query, people, teammates, currentUser);

  const addTeammate = (teammate: TTeammate) => {
    onChange((previous) => withTeammate(previous, teammate));
    setQuery("");
  };
  const addMember = (id: string) =>
    addTeammate({
      memberId: id,
      email: emailOf(id),
      role: teammateRoleOptions(getWorkspaceMemberDetails(id)?.role)[0],
    });
  const addEmail = () => addTeammate({ email: term, role: EDITOR_ROLE });
  const ownerName = personName(currentUser, "You");

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="create-project-collaborators"
        onClick={() => setOpen((value) => !value)}
        className={`${fieldClass} flex min-h-10 items-center justify-between gap-2 text-left`}
      >
        {teammates.length ? (
          <span>
            {teammates.length} {teammates.length === 1 ? "teammate" : "teammates"} selected
          </span>
        ) : (
          <span className="text-placeholder">Add collaborators</span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id="create-project-collaborators"
          className="shadow-sm mt-2 flex flex-col gap-3 rounded-xl border border-subtle bg-surface-1 p-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-project-invite" className="text-13 font-medium">
              Invite teammates
            </label>
            <input
              id="create-project-invite"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                // Enter adds the teammate instead of submitting the whole form.
                event.preventDefault();
                if (suggestions[0]) addMember(suggestions[0].id);
                else if (canInviteEmail) addEmail();
              }}
              placeholder="Enter email or teammate name"
              className={fieldClass}
            />
            {term && (
              <SuggestionList
                term={term}
                suggestions={suggestions}
                canInviteEmail={canInviteEmail}
                onAddMember={addMember}
                onAddEmail={addEmail}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-13 font-medium">People with access</span>
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              <li className="flex items-center gap-3">
                <Avatar label={ownerName} />
                <span className="min-w-0 flex-1 truncate text-13">{ownerName}</span>
                <span className="text-12 text-secondary">Owner</span>
              </li>
              {teammates.map((teammate) => (
                <TeammateRow
                  key={keyOf(teammate)}
                  teammate={teammate}
                  name={teammate.memberId ? nameOf(teammate.memberId) : teammate.email}
                  roles={
                    teammate.memberId
                      ? teammateRoleOptions(getWorkspaceMemberDetails(teammate.memberId)?.role)
                      : [EDITOR_ROLE, VIEWER_ROLE]
                  }
                  onChange={onChange}
                />
              ))}
            </ul>
          </div>
          {teammates.length === 0 && (
            <p className="flex items-center gap-1.5 border-t border-subtle pt-3 text-12 text-secondary">
              <Lock className="size-3.5" aria-hidden="true" />
              Only me
            </p>
          )}
        </div>
      )}
    </div>
  );
});

function SuggestionList({
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

function TeammateRow({
  teammate,
  name,
  roles,
  onChange,
}: {
  teammate: TTeammate;
  name: string;
  roles: number[];
  onChange: (update: (previous: TTeammate[]) => TTeammate[]) => void;
}) {
  const key = keyOf(teammate);
  return (
    <li className="flex items-center gap-3">
      <Avatar label={name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-13">{name}</span>
        {!teammate.memberId && <span className="text-11 text-secondary">Invitation will be emailed</span>}
      </span>
      {roles.length > 1 ? (
        <select
          aria-label={`Role for ${name}`}
          value={teammate.role}
          onChange={(event) => {
            const role = Number(event.target.value);
            onChange((previous) => previous.map((entry) => (keyOf(entry) === key ? { ...entry, role } : entry)));
          }}
          className="rounded-md border border-subtle bg-surface-1 px-2 py-1 text-12 outline-none"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-12 text-secondary">{ROLE_LABELS[roles[0]]}</span>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={() => onChange((previous) => previous.filter((entry) => keyOf(entry) !== key))}
        className="rounded p-1 text-secondary hover:bg-layer-1 hover:text-primary"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#135DDD]/10 text-12 font-semibold text-[#135DDD] uppercase"
    >
      {label.trim().charAt(0) || "?"}
    </span>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-13 font-medium">
        {label} *
      </label>
      <div className="relative">
        <input
          id={id}
          type="date"
          required
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => {
            // The browser's own picker icon is hidden, so clicking the field opens the picker instead.
            try {
              event.currentTarget.showPicker?.();
            } catch {
              // showPicker isn't allowed in some contexts (e.g. cross-origin iframes); typing still works.
            }
          }}
          className={`${fieldClass} cursor-pointer pr-9 ${value ? "" : "text-placeholder"} [&::-webkit-calendar-picker-indicator]:hidden`}
        />
        <CalendarDays
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-secondary"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export const CreateProjectDialog = observer(function CreateProjectDialog({
  isOpen,
  onClose,
  workspaceSlug,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const id = useId();
  const router = useAppRouter();
  const { createProject, updateProject, projectMap } = useProject();
  const {
    project: { bulkAddMembersToProject },
    workspace: { getWorkspaceMemberDetails },
  } = useMember();
  const [draft, setDraft] = useState<TCreateProjectDraft>(EMPTY_PROJECT_DRAFT);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const error = projectDraftError(draft);
  const update = (patch: Partial<TCreateProjectDraft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const changeTeammates = useCallback(
    (change: (previous: TTeammate[]) => TTeammate[]) =>
      setDraft((previous) => ({ ...previous, teammates: change(previous.teammates) })),
    []
  );

  const close = () => {
    if (busy) return;
    setDraft(EMPTY_PROJECT_DRAFT);
    setTouched(false);
    onClose();
  };

  const create = async (): Promise<TProject | null> => {
    const name = draft.name.trim();
    const payload: Partial<TProject> = {
      name,
      description: draft.description.trim(),
      start_date: draft.startDate,
      target_date: draft.dueDate,
      network: 2,
      logo_props: {
        in_use: "emoji",
        emoji: { value: RANDOM_EMOJI_CODES[Math.floor(Math.random() * RANDOM_EMOJI_CODES.length)] },
      },
    };
    const taken = Object.values(projectMap).map((project) => project.identifier);
    for (const identifier of identifierCandidates(name, taken)) {
      try {
        // Identifiers are tried one at a time: the next candidate is only needed if this one is taken.
        // oxlint-disable-next-line no-await-in-loop
        return await createProject(workspaceSlug, { ...payload, identifier });
      } catch (createError) {
        const codes = apiErrorCodes(createError);
        if (codes.includes("PROJECT_IDENTIFIER_ALREADY_EXIST")) continue;
        const message = codes.includes("PROJECT_NAME_ALREADY_EXIST")
          ? "A project with this name already exists."
          : codes.includes("PROJECT_NAME_CANNOT_CONTAIN_SPECIAL_CHARACTERS")
            ? "Project name can't contain special characters."
            : "Couldn't create the project. Please try again.";
        setToast({ type: "error", title: "Error", message });
        return null;
      }
    }
    setToast({ type: "error", title: "Error", message: "Couldn't find a free project ID. Try another name." });
    return null;
  };

  const finish = async (project: TProject) => {
    const problems: string[] = [];
    const members = draft.teammates.flatMap((teammate) =>
      teammate.memberId
        ? [
            {
              member_id: teammate.memberId,
              role: collaboratorRole(getWorkspaceMemberDetails(teammate.memberId)?.role, teammate.role),
            },
          ]
        : []
    );
    const invites = draft.teammates
      .filter((teammate) => !teammate.memberId)
      .map(({ email, role }) => ({ email, role }));
    let invitedCount = 0;
    if (members.length) {
      try {
        await bulkAddMembersToProject(workspaceSlug, project.id, { members });
      } catch {
        problems.push("collaborators");
      }
    }
    if (invites.length) {
      try {
        invitedCount = (await collaboratorsService.invite(workspaceSlug, project.id, invites)).invited.length;
      } catch {
        problems.push("invited teammates");
      }
    }
    if (draft.file) {
      try {
        const upload = await fileService.uploadProjectAsset(
          workspaceSlug,
          project.id,
          { entity_identifier: project.id, entity_type: EFileAssetType.PROJECT_ATTACHMENT },
          draft.file
        );
        const origin = API_BASE_URL || window.location.origin;
        await updateProject(workspaceSlug, project.id, {
          overview_resources: [
            {
              title: draft.file.name,
              url: projectAttachmentUrl(origin, workspaceSlug, project.id, upload.asset_id),
              kind: "link",
            },
          ],
        });
      } catch {
        problems.push("the attached file");
      }
    }
    setToast(
      problems.length
        ? {
            type: "warning",
            title: "Project created",
            message: `Couldn't add ${problems.join(" or ")}. You can add them from the project overview.`,
          }
        : {
            type: "success",
            title: "Success",
            message: invitedCount
              ? `Project created. Invitations sent to ${invitedCount} ${invitedCount === 1 ? "person" : "people"}.`
              : "Project created successfully.",
          }
    );
  };

  const submit = async () => {
    setTouched(true);
    if (error || busy) return;
    setBusy(true);
    try {
      const project = await create();
      if (!project) return;
      await finish(project);
      setDraft(EMPTY_PROJECT_DRAFT);
      setTouched(false);
      onClose();
      router.push(`/${workspaceSlug}/projects/${project.id}/overview`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent size="md">
        <form
          className="flex max-h-[85vh] flex-col overflow-y-auto p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <DialogTitle>Create Project</DialogTitle>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded p-1 text-secondary hover:bg-layer-1"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-name`} className="text-13 font-medium">
                Project Name *
              </label>
              <input
                id={`${id}-name`}
                value={draft.name}
                maxLength={255}
                required
                onChange={(event) => update({ name: event.target.value })}
                placeholder="e.g. Website Redesign"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-description`} className="text-13 font-medium">
                Description (optional)
              </label>
              <textarea
                id={`${id}-description`}
                value={draft.description}
                rows={3}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="What is this project for?"
                className={`${fieldClass} resize-none`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-13 font-medium">Collaborators</span>
              <CollaboratorPicker teammates={draft.teammates} onChange={changeTeammates} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateField
                id={`${id}-start`}
                label="Start Date"
                value={draft.startDate}
                onChange={(startDate) => update({ startDate })}
              />
              <DateField
                id={`${id}-due`}
                label="Due Date"
                value={draft.dueDate}
                min={draft.startDate || undefined}
                onChange={(dueDate) => update({ dueDate })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-file`} className="text-13 font-medium">
                Attach File (optional)
              </label>
              <label htmlFor={`${id}-file`} className={`${fieldClass} flex cursor-pointer items-center gap-2`}>
                <span className={`min-w-0 flex-1 truncate ${draft.file ? "" : "text-placeholder"}`}>
                  {draft.file?.name ?? "Choose file"}
                </span>
                {draft.file && (
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={(event) => {
                      event.preventDefault();
                      update({ file: null });
                    }}
                    className="text-secondary hover:text-primary"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </label>
              <input
                id={`${id}-file`}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  update({ file: event.target.files?.[0] ?? null });
                  event.target.value = "";
                }}
              />
            </div>
            {touched && error && (
              <p role="alert" className="text-12 text-danger-primary">
                {error}
              </p>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-full border border-subtle px-4 py-1.5 text-13 font-medium hover:bg-layer-1 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !!error}
              className="rounded-full bg-[#135DDD] px-4 py-1.5 text-13 font-medium text-white hover:bg-[#0F4FC0] disabled:bg-[#135DDD]/50"
            >
              {busy ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});
