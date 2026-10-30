import type { ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { DialogContent } from "@makeplane/propel/components/dialog";

export type TTaskFormPresentation = "dialog" | "side-panel";

export function TaskFormContent({
  presentation = "dialog",
  size,
  children,
}: {
  presentation?: TTaskFormPresentation;
  size: "md" | "lg";
  children: ReactNode;
}) {
  if (presentation === "dialog") return <DialogContent size={size}>{children}</DialogContent>;

  return (
    <BaseDialog.Portal>
      <BaseDialog.Popup className="shadow-xl fixed inset-y-0 right-0 z-30 flex w-full flex-col overflow-y-auto border-l border-subtle bg-surface-1 outline-none md:w-1/2">
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}
