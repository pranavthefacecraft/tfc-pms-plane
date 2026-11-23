/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { AttachOutline, TopArrowOutline } from "@makeplane/propel/icons";
// constants
import type { EditorRefApi, ToolbarMenuItem } from "@plane/editor";
import { IMAGE_ITEM } from "@plane/editor";

type LiteToolbarProps = {
  onSubmit: (e: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent<HTMLButtonElement>) => void;
  isSubmitting: boolean;
  isEmpty: boolean;
  executeCommand: (item: ToolbarMenuItem) => void;
};

export function LiteToolbar({ onSubmit, isSubmitting, isEmpty, executeCommand }: LiteToolbarProps) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <button
        onClick={() => executeCommand(IMAGE_ITEM)}
        type="button"
        className="p-1 text-tertiary transition-colors hover:text-secondary"
      >
        <AttachOutline className="size-3" />
      </button>
      <button
        type="button"
        onClick={(e) => onSubmit(e)}
        disabled={isEmpty || isSubmitting}
        className="rounded-sm bg-accent-primary p-1 text-primary transition-colors hover:bg-accent-primary/80 disabled:bg-layer-1 disabled:text-secondary"
      >
        <TopArrowOutline className="size-3" />
      </button>
    </div>
  );
}

export type { LiteToolbarProps };

export function DrawerCommentToolbar({
  editorRef,
  isEmpty,
  isSubmitting,
  submitLabel,
  onSubmit,
}: {
  editorRef: Pick<
    EditorRefApi,
    "focus" | "setEditorValueAtCursorPosition" | "executeMenuItemCommand" | "isEditorReadyToDiscard"
  > | null;
  isEmpty: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-14 text-accent-primary">
      <button
        type="button"
        disabled={!editorRef || isSubmitting}
        onClick={() => {
          editorRef?.focus("end");
          editorRef?.setEditorValueAtCursorPosition("@");
        }}
      >
        @ Mention
      </button>
      <button
        type="button"
        disabled={!editorRef || isSubmitting}
        onClick={() => editorRef?.executeMenuItemCommand({ itemKey: "attachment", savedSelection: null })}
      >
        Attach file
      </button>
      <button
        type="button"
        className="ml-auto disabled:text-placeholder"
        disabled={isEmpty || isSubmitting || !editorRef?.isEditorReadyToDiscard()}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}
