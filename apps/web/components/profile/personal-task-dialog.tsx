import { useId, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
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
import type { TPersonalTask, TPersonalTaskData } from "@/services/personal-task.service";
import { personalTaskError, personalTaskService } from "@/services/personal-task.service";

type Props = {
  workspaceSlug: string;
  task?: TPersonalTask;
  onClose: () => void;
  onSaved: (task: TPersonalTask) => void;
  onProjectTask?: (data: TPersonalTaskData) => void;
  canCreateProjectTask?: boolean;
};

const fieldClass = "w-full rounded border border-subtle bg-surface-1 px-3 py-2 text-13";

export function PersonalTaskDialog({
  workspaceSlug,
  task,
  onClose,
  onSaved,
  onProjectTask,
  canCreateProjectTask,
}: Props) {
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TPersonalTask["priority"]>(task?.priority ?? "none");
  const [startDate, setStartDate] = useState(task?.start_date ?? "");
  const [targetDate, setTargetDate] = useState(task?.target_date ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const id = useId();
  const close = () => {
    if (!pending.current) onClose();
  };
  const save = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const data: TPersonalTaskData = {
      name: name.trim(),
      description,
      priority,
      start_date: startDate || null,
      target_date: targetDate || null,
    };
    try {
      const saved = task
        ? await personalTaskService.update(workspaceSlug, task.id, data)
        : await personalTaskService.create(workspaceSlug, data);
      onSaved(saved);
      onClose();
    } catch (cause) {
      console.error("Personal task save failed", cause);
      const message = personalTaskError(cause);
      setError(message);
      setToast({ type: "error", title: "Personal task could not be saved", message });
    } finally {
      pending.current = false;
      setBusy(false);
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
              <DialogTitle>{task ? "Edit personal task" : "Add task"}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <p className="text-13 text-secondary">
                No project · Private to you. You can move this task into a project later.
              </p>
              <label htmlFor={`${id}-name`} className="text-13">
                Task name
              </label>
              <input
                id={`${id}-name`}
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                required
                disabled={busy}
              />
              <label htmlFor={`${id}-description`} className="text-13">
                Description
              </label>
              <textarea
                id={`${id}-description`}
                className={fieldClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={20000}
                rows={4}
                disabled={busy}
              />
              <label htmlFor={`${id}-priority`} className="text-13">
                Priority
              </label>
              <select
                id={`${id}-priority`}
                className={fieldClass}
                value={priority}
                disabled={busy}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value === "none" ||
                    value === "low" ||
                    value === "medium" ||
                    value === "high" ||
                    value === "urgent"
                  )
                    setPriority(value);
                }}
              >
                {["none", "low", "medium", "high", "urgent"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-13">
                  Start date
                  <input
                    type="date"
                    className={fieldClass}
                    value={startDate}
                    disabled={busy}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="text-13">
                  Due date
                  <input
                    type="date"
                    className={fieldClass}
                    value={targetDate}
                    min={startDate || undefined}
                    disabled={busy}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </label>
              </div>
              {error && (
                <p role="alert" className="text-13 text-danger-primary">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {onProjectTask && (
                  <Button
                    variant="secondary"
                    size="md"
                    stretch="auto"
                    type="button"
                    label="Create in a project instead"
                    disabled={busy || !canCreateProjectTask}
                    onClick={() =>
                      onProjectTask({
                        name,
                        description,
                        priority,
                        start_date: startDate || null,
                        target_date: targetDate || null,
                      })
                    }
                  />
                )}
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  type="button"
                  label="Cancel"
                  disabled={busy}
                  onClick={close}
                />
                <Button
                  variant="primary"
                  size="md"
                  stretch="auto"
                  type="submit"
                  label={busy ? "Saving..." : "Save"}
                  disabled={busy || !name.trim()}
                />
              </div>
            </form>
          </DialogBody>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
