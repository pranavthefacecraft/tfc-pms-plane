/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel, STATE_GROUPS } from "@plane/constants";
import type { IState, TStateGroups } from "@plane/types";
import { AddOutline } from "@makeplane/propel/icons";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { StateForm } from "./create-update/form";

export const AddSection = observer(function AddSection({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const { allowPermissions } = useUserPermissions();
  const { getProjectById } = useProject();
  const canCreate = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);
  if (!canCreate || getProjectById(projectId)?.archived_at) return null;
  return (
    <div className="shrink-0 border-t border-subtle bg-surface-1 px-4 py-2">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-13 text-secondary hover:bg-layer-1-hover hover:text-primary"
        onClick={() => setOpen(true)}
      >
        <AddOutline className="size-4" />
        Add section
      </button>
      {open && (
        <AddSectionDialog
          key={`${workspaceSlug}:${projectId}`}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
});

function stateErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null) {
      if ("name" in data) {
        if (typeof data.name === "string") return data.name;
        if (Array.isArray(data.name) && typeof data.name[0] === "string") return data.name[0];
      }
      if ("error" in data && typeof data.error === "string") return data.error;
    }
  }
  return "Section could not be created. Please try again.";
}

function AddSectionDialog({
  workspaceSlug,
  projectId,
  onClose,
}: {
  workspaceSlug: string;
  projectId: string;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<TStateGroups>("unstarted");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const { createState } = useProjectState();
  const close = () => {
    if (!pending.current) onClose();
  };
  const submit = async (data: Partial<IState>) => {
    if (pending.current) return { status: "pending" };
    const name = data.name?.trim();
    if (!name) {
      setError("Section name is required.");
      return { status: "error" };
    }
    pending.current = true;
    setSubmitting(true);
    setError("");
    try {
      await createState(workspaceSlug, projectId, { ...data, name, group });
      setToast({
        type: "success",
        title: "Section created",
        message: "The new state is available across this project and in Settings.",
      });
      onClose();
      return { status: "success" };
    } catch (cause: unknown) {
      console.error("Could not create project section", cause);
      const message = stateErrorMessage(cause);
      setError(message);
      setToast({ type: "error", title: "Could not create section", message });
      return { status: "error" };
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Add section</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p className="mb-3 text-13 text-secondary">
              Sections use project states. Group List or Board by State and show empty groups to see a new section
              before adding work items. Calendar and Timeline show work items, not empty state columns.
            </p>
            <label className="flex flex-col gap-1 text-13">
              State group
              <select
                aria-label="State group"
                value={group}
                disabled={submitting}
                className="rounded border border-subtle bg-surface-1 p-2"
                onChange={(event) => {
                  const value = event.target.value;
                  const option = Object.values(STATE_GROUPS).find((item) => item.key === value);
                  if (option) setGroup(option.key);
                }}
              >
                {Object.values(STATE_GROUPS).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <StateForm
              data={{ name: "", description: "", color: STATE_GROUPS.unstarted.color }}
              onSubmit={submit}
              onCancel={close}
              buttonDisabled={submitting}
              buttonTitle={submitting ? "Creating..." : "Create section"}
            />
            {error && (
              <p role="alert" className="mt-2 text-13 text-danger-primary">
                {error}
              </p>
            )}
          </DialogBody>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
