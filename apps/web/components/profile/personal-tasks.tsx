import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
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
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { TPersonalTask } from "@/services/personal-task.service";
import { personalTaskError, personalTaskService, personalTasksKey } from "@/services/personal-task.service";
import { PersonalTaskDialog } from "./personal-task-dialog";

function PersonalTaskRow({
  task,
  busy,
  canMove,
  onComplete,
  onEdit,
  onMove,
  onDelete,
}: {
  task: TPersonalTask;
  busy: boolean;
  canMove: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-subtle px-5 py-3 text-13">
      <input
        type="checkbox"
        checked={Boolean(task.completed_at)}
        disabled={busy}
        aria-label={`${task.completed_at ? "Reopen" : "Complete"} ${task.name}`}
        onChange={onComplete}
      />
      <button
        type="button"
        className={`min-w-0 flex-1 truncate text-left ${task.completed_at ? "text-secondary line-through" : ""}`}
        disabled={busy}
        onClick={onEdit}
      >
        {task.name}
      </button>
      <span className="text-12 text-secondary">{task.priority === "none" ? "No priority" : task.priority}</span>
      {task.target_date && <span className="text-12 text-secondary">Due {task.target_date}</span>}
      <button type="button" className="text-accent-primary" disabled={busy || !canMove} onClick={onMove}>
        Move to project
      </button>
      <button
        type="button"
        className="text-danger-primary"
        disabled={busy}
        aria-label={`Delete ${task.name}`}
        onClick={onDelete}
      >
        Delete
      </button>
    </li>
  );
}

function PersonalTaskActionDialog({
  type,
  task,
  projects,
  projectId,
  busy,
  error,
  onProjectChange,
  onClose,
  onConfirm,
}: {
  type: "move" | "delete";
  task: TPersonalTask;
  projects: { id: string; name: string }[];
  projectId: string;
  busy: boolean;
  error: string;
  onProjectChange: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const moving = type === "move";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{moving ? "Move to project" : "Delete personal task"}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 text-13">
              <p>
                {moving
                  ? `"${task.name}" will become a project task assigned to you. People with access to that project will be able to see it.`
                  : `Delete "${task.name}"? This cannot be undone.`}
              </p>
              {moving && (
                <label>
                  Project
                  <select
                    className="mt-2 w-full rounded border border-subtle bg-surface-1 p-2"
                    value={projectId}
                    disabled={busy}
                    onChange={(event) => onProjectChange(event.target.value)}
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {error && (
                <p role="alert" className="text-danger-primary">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="md" stretch="auto" label="Cancel" disabled={busy} onClick={onClose} />
                <Button
                  variant="primary"
                  size="md"
                  stretch="auto"
                  label={busy ? "Saving..." : moving ? "Move task" : "Delete task"}
                  disabled={busy || (moving && !projectId)}
                  onClick={onConfirm}
                />
              </div>
            </div>
          </DialogBody>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}

export const PersonalTasks = observer(function PersonalTasks() {
  const { workspaceSlug, userId } = useParams();
  const { data: user } = useUser();
  const { allowPermissions } = useUserPermissions();
  const authorized = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  if (!workspaceSlug || !user || user.id !== userId || !authorized) return null;
  return (
    <PersonalTasksList key={`${workspaceSlug}:${user.id}`} workspaceSlug={workspaceSlug.toString()} userId={user.id} />
  );
});

export const PersonalTasksList = observer(function PersonalTasksList({
  workspaceSlug,
  userId,
}: {
  workspaceSlug: string;
  userId: string;
}) {
  const {
    data: tasks,
    error,
    mutate,
  } = useSWR(personalTasksKey(workspaceSlug, userId), () => personalTaskService.list(workspaceSlug));
  const { joinedProjectIds, getProjectById } = useProject();
  const router = useAppRouter();
  const [dialog, setDialog] = useState<{ type: "edit" | "delete" | "move"; task: TPersonalTask } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const pending = useRef(false);
  const projects = joinedProjectIds
    .map((id) => getProjectById(id))
    .filter((project): project is NonNullable<typeof project> => project !== undefined && !project.archived_at);
  const perform = async (operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setOperationError("");
    try {
      await operation();
    } catch (cause) {
      console.error("Personal task operation failed", cause);
      const message = personalTaskError(cause);
      setOperationError(message);
      setToast({ type: "error", title: "Personal task operation failed", message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const saveCached = (task: TPersonalTask) => {
    void mutate((current) => current?.map((item) => (item.id === task.id ? task : item)), { revalidate: false });
  };
  const close = () => {
    if (!pending.current) setDialog(null);
  };
  return (
    <section aria-label="Personal tasks" className="shrink-0 border-b border-subtle">
      <header className="flex items-center justify-between bg-layer-1 px-5 py-3">
        <h2 className="text-13 font-semibold">Personal tasks {tasks ? `(${tasks.length})` : ""}</h2>
        <span className="text-12 text-secondary">No project · Private to you</span>
      </header>
      {error ? (
        <div role="alert" className="p-4 text-13 text-danger-primary">
          Could not load personal tasks.{" "}
          <button type="button" className="underline" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      ) : !tasks ? (
        <p className="p-4 text-13 text-secondary">Loading personal tasks...</p>
      ) : tasks.length === 0 ? (
        <p className="px-5 py-3 text-13 text-secondary">
          No personal tasks yet. Use Add work item to create one without a project.
        </p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <PersonalTaskRow
              key={task.id}
              task={task}
              busy={busy}
              canMove={projects.length > 0}
              onComplete={() =>
                void perform(async () => {
                  const updated = await personalTaskService.update(workspaceSlug, task.id, {
                    is_completed: !task.completed_at,
                  });
                  await mutate((current) => current?.map((item) => (item.id === task.id ? updated : item)), {
                    revalidate: false,
                  });
                })
              }
              onEdit={() => setDialog({ type: "edit", task })}
              onMove={() => {
                setProjectId("");
                setDialog({ type: "move", task });
              }}
              onDelete={() => setDialog({ type: "delete", task })}
            />
          ))}
        </ul>
      )}
      {operationError && (
        <p role="alert" className="px-5 py-2 text-13 text-danger-primary">
          {operationError}
        </p>
      )}
      {dialog?.type === "edit" && (
        <PersonalTaskDialog
          key={dialog.task.id}
          workspaceSlug={workspaceSlug}
          task={dialog.task}
          onClose={close}
          onSaved={saveCached}
        />
      )}
      {dialog && dialog.type !== "edit" && (
        <PersonalTaskActionDialog
          type={dialog.type}
          task={dialog.task}
          projects={projects}
          projectId={projectId}
          busy={busy}
          error={operationError}
          onProjectChange={setProjectId}
          onClose={close}
          onConfirm={() =>
            void perform(async () => {
              if (dialog.type === "delete") {
                await personalTaskService.remove(workspaceSlug, dialog.task.id);
              } else {
                const issue = await personalTaskService.move(workspaceSlug, dialog.task.id, projectId);
                setToast({
                  type: "success",
                  title: "Task moved",
                  message: "Your task is now in the selected project.",
                });

                router.push(`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}`);
              }
              await mutate((current) => current?.filter((item) => item.id !== dialog.task.id), {
                revalidate: false,
              });
              setDialog(null);
            })
          }
        />
      )}
    </section>
  );
});
