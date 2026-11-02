/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useState } from "react";
import { observer } from "mobx-react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
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
import {
  EMPTY_PROJECT_DRAFT,
  collaboratorRole,
  identifierCandidates,
  projectAttachmentUrl,
  projectDraftError,
} from "./create-project-dialog.helpers";
import type { TCreateProjectDraft } from "./create-project-dialog.helpers";

const fileService = new FileService();

const fieldClass =
  "w-full rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none placeholder:text-placeholder focus:border-[#135DDD] focus:ring-1 focus:ring-[#135DDD]";

function apiErrorCodes(error: unknown): string[] {
  const data = (error as { data?: Record<string, unknown> } | undefined)?.data ?? error;
  if (!data || typeof data !== "object") return [];
  return Object.values(data as Record<string, unknown>).flatMap((value) =>
    Array.isArray(value) ? value.map(String) : [String(value)]
  );
}

const CollaboratorPicker = observer(function CollaboratorPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: currentUser } = useUser();
  const {
    getUserDetails,
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();
  const nameOf = (id: string) => {
    const user = getUserDetails(id);
    return user?.display_name || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "Team member";
  };
  const term = query.trim().toLocaleLowerCase();
  const options = (workspaceMemberIds ?? []).filter(
    (id) =>
      id !== currentUser?.id &&
      getWorkspaceMemberDetails(id)?.is_active !== false &&
      (!term || nameOf(id).toLocaleLowerCase().includes(term))
  );
  const chosen = new Set(selected);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="create-project-collaborators"
        onClick={() => setOpen((value) => !value)}
        className={`${fieldClass} flex min-h-10 items-center justify-between gap-2 text-left`}
      >
        {selected.length ? (
          <span className="flex flex-wrap gap-1">
            {selected.map((id) => (
              <span key={id} className="rounded-full bg-layer-1 px-2 py-0.5 text-12">
                {nameOf(id)}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-placeholder">Add collaborators</span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="create-project-collaborators" className="mt-1 rounded-lg border border-subtle bg-surface-1 p-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search collaborators"
            className="mb-1 w-full rounded-md border border-subtle px-2 py-1 text-12 outline-none"
          />
          <ul className="max-h-36 overflow-y-auto">
            {options.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-13 hover:bg-layer-1">
                  <input type="checkbox" checked={chosen.has(id)} onChange={() => onToggle(id)} />
                  {nameOf(id)}
                </label>
              </li>
            ))}
            {options.length === 0 && <li className="px-2 py-1.5 text-12 text-secondary">No people found.</li>}
          </ul>
        </div>
      )}
    </div>
  );
});

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
          className={`${fieldClass} pr-9 ${value ? "" : "text-placeholder"}`}
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
    if (draft.collaborators.length) {
      try {
        await bulkAddMembersToProject(workspaceSlug, project.id, {
          members: draft.collaborators.map((memberId) => ({
            member_id: memberId,
            role: collaboratorRole(getWorkspaceMemberDetails(memberId)?.role),
          })),
        });
      } catch {
        problems.push("collaborators");
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
        : { type: "success", title: "Success", message: "Project created successfully." }
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
              <CollaboratorPicker
                selected={draft.collaborators}
                onToggle={(memberId) =>
                  setDraft((previous) => ({
                    ...previous,
                    collaborators: previous.collaborators.includes(memberId)
                      ? previous.collaborators.filter((value) => value !== memberId)
                      : [...previous.collaborators, memberId],
                  }))
                }
              />
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
