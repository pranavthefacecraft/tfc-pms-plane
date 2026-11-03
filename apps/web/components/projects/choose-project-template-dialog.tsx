/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@makeplane/propel/components/dialog";
import { PROJECT_TEMPLATES } from "./project-templates";
import type { TProjectTemplate } from "./project-templates";

/** Figma "Choose a Project" step shown before the Create Project form. */
export function ChooseProjectTemplateDialog({
  isOpen,
  onClose,
  onChoose,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (template: TProjectTemplate) => void;
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="sm">
        <div className="flex flex-col p-5 pb-12">
          <div className="mb-4 flex items-center justify-between">
            <DialogTitle>Choose a Project</DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-secondary hover:bg-layer-1"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {PROJECT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onChoose(template.id)}
                className="flex min-h-16 flex-col items-start gap-1 rounded-md border border-subtle bg-surface-1 px-3 py-3 text-left hover:border-[#135DDD] hover:bg-layer-1 focus-visible:border-[#135DDD] focus-visible:outline-none"
              >
                <span className="text-13 font-medium text-primary">{template.title}</span>
                <span className="text-12 text-secondary">{template.description}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
