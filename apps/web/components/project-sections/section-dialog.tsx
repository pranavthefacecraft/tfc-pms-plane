/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
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
import { useProjectSection } from "@/hooks/store/use-project-section";
import type { TProjectSection } from "@/services/project/project-section.service";
import { sectionErrorMessage } from "./errors";

type Props = {
  workspaceSlug: string;
  projectId: string;
  mode: "create" | "manage";
  onClose: () => void;
  onDeleted: () => Promise<void>;
  onCreated: () => Promise<void>;
};

export const SectionDialog = observer(function SectionDialog({
  workspaceSlug,
  projectId,
  mode,
  onClose,
  onDeleted,
  onCreated,
}: Props) {
  const sections = useProjectSection();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TProjectSection | null>(null);
  const pending = useRef(false);
  const close = () => {
    if (!pending.current) onClose();
  };
  const perform = async (operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      console.error("Project section operation failed", cause);
      const message = sectionErrorMessage(cause);
      setError(message);
      setToast({ type: "error", title: "Section operation failed", message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Section name is required.");
      return;
    }
    await perform(async () => {
      await sections.create(workspaceSlug, projectId, trimmed);
      await onCreated();
      setToast({
        type: "success",
        title: "Section created",
        message: "The section is available across this project. Task statuses are unchanged.",
      });
      onClose();
    });
  };
  const items = sections.getSections(workspaceSlug, projectId);
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
              <DialogTitle>{mode === "create" ? "Add section" : "Manage sections"}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p className="mb-3 text-13 text-secondary">
              Sections organize work independently of status and are shared across this project.
            </p>
            {mode === "create" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <fieldset disabled={busy} className="space-y-3">
                  <label htmlFor="section-name" className="text-13">
                    Section name
                  </label>
                  <InputGroup size="lg">
                    <Input
                      id="section-name"
                      name="section-name"
                      size="lg"
                      value={name}
                      autoFocus
                      maxLength={100}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </InputGroup>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    stretch="auto"
                    label={busy ? "Creating..." : "Create section"}
                  />
                </fieldset>
              </form>
            ) : (
              <div className="max-h-96 space-y-2 overflow-auto">
                {!items.length && (
                  <p className="text-13 text-secondary">No sections yet. Use Add section to create one.</p>
                )}
                {items.map((section, index) => (
                  <SectionRow
                    key={`${section.id}:${section.name}`}
                    section={section}
                    busy={busy}
                    first={index === 0}
                    last={index === items.length - 1}
                    onRename={(value) =>
                      void perform(async () => {
                        await sections.update(workspaceSlug, projectId, section.id, { name: value });
                      })
                    }
                    onMove={(direction) =>
                      void perform(async () => {
                        await sections.move(workspaceSlug, projectId, section.id, direction);
                      })
                    }
                    onDelete={() => setDeleting(section)}
                  />
                ))}
              </div>
            )}
            {deleting && (
              <div className="mt-4 space-y-2 rounded border border-subtle p-3">
                <p className="text-13">
                  Delete "{deleting.name}"? Its tasks will be kept under No section. Their statuses will not change.
                </p>
                <Button
                  variant="danger"
                  size="md"
                  stretch="auto"
                  label="Delete section"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await sections.remove(workspaceSlug, projectId, deleting.id);
                      setDeleting(null);
                      try {
                        await onDeleted();
                      } catch (cause) {
                        console.error("Section deleted but work items could not be refreshed", cause);
                        setError(
                          "Section deleted and tasks kept. Work items could not be refreshed; reload this view."
                        );
                      }
                    })
                  }
                />
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  label="Keep section"
                  disabled={busy}
                  onClick={() => setDeleting(null)}
                />
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-13 text-danger-primary">
                {error}
              </p>
            )}
            <div className="mt-4">
              <Button
                variant="secondary"
                size="md"
                stretch="auto"
                label={mode === "create" ? "Cancel" : "Close"}
                disabled={busy}
                onClick={close}
              />
            </div>
          </DialogBody>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
});

function SectionRow({
  section,
  busy,
  first,
  last,
  onRename,
  onMove,
  onDelete,
}: {
  section: TProjectSection;
  busy: boolean;
  first: boolean;
  last: boolean;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(section.name);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onRename(name.trim());
      }}
    >
      <fieldset disabled={busy} className="flex flex-wrap items-center gap-2 rounded border border-subtle p-2">
        <div className="min-w-0 flex-1">
          <InputGroup size="md">
            <Input
              aria-label={`Rename ${section.name}`}
              size="md"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
            />
          </InputGroup>
        </div>
        <button type="submit" disabled={!name.trim() || name.trim() === section.name} className="text-13">
          Save
        </button>
        <button
          type="button"
          aria-label={`Move ${section.name} up`}
          disabled={first}
          onClick={() => onMove(-1)}
          className="text-13"
        >
          Up
        </button>
        <button
          type="button"
          aria-label={`Move ${section.name} down`}
          disabled={last}
          onClick={() => onMove(1)}
          className="text-13"
        >
          Down
        </button>
        <button
          type="button"
          aria-label={`Delete ${section.name}`}
          onClick={onDelete}
          className="text-13 text-danger-primary"
        >
          Delete
        </button>
      </fieldset>
    </form>
  );
}
