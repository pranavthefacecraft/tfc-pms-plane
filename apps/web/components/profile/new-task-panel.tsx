import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
import { Dialog, DialogTitle } from "@makeplane/propel/components/dialog";
import type { DialogImperativeActions } from "@makeplane/propel/components/dialog";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { TaskFormContent } from "@/components/common/task-form-content";
import { useProject } from "@/hooks/store/use-project";
import type { TPersonalTask } from "@/services/personal-task.service";
import { personalTaskService } from "@/services/personal-task.service";
import { NewTaskProjectFields, PrivateProjectFields, TaskProperty } from "./new-task-project-fields";
import { newTaskError, saveProjectTask, taskFileKey, taskValueClass } from "./new-task.helpers";
import type { TNewTaskDraft, TTaskSaveProgress } from "./new-task.helpers";

type Props = {
  workspaceSlug: string;
  onClose: () => void;
  onSaved: (task?: TPersonalTask) => void;
};

const priorities = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Normal" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
] as const;

function useNewTaskForm({ workspaceSlug, onClose, onSaved }: Props) {
  const { joinedProjectIds, getProjectById } = useProject();
  const [draft, setDraft] = useState<TNewTaskDraft>({
    name: "",
    description: "",
    priority: "medium",
    start_date: null,
    target_date: null,
    projectId: "",
    assignees: [],
    stateId: "",
    fieldValues: {},
    dependencies: [],
    files: [],
    subtasks: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [projectReady, setProjectReady] = useState(false);
  const [partial, setPartial] = useState(false);
  const pending = useRef(false);
  const actions = useRef<DialogImperativeActions | null>(null);
  const progress = useRef<TTaskSaveProgress>({ completed: new Set() });
  const disabled = busy || partial;
  const change = (patch: Partial<TNewTaskDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const close = () => {
    if (!pending.current) actions.current?.close();
  };
  const projects = joinedProjectIds
    .map((id) => getProjectById(id))
    .filter((project) => project && !project.archived_at);
  const validationError = !draft.name.trim()
    ? "Enter a task name."
    : draft.subtasks.some((task) => !task.name.trim())
      ? "Enter a name for every subtask."
      : draft.projectId && !projectReady
        ? "Project fields are not ready. Wait for them to load or use Retry."
        : "";
  const save = async () => {
    if (pending.current) return;
    if (validationError) {
      setError(validationError);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (draft.projectId) {
        const issue = await saveProjectTask(workspaceSlug, draft, progress.current);
        onSaved();
        setToast({
          type: "success",
          title: "Task saved",
          message: `"${issue.name}" was saved in ${getProjectById(draft.projectId)?.name}. Assigned tasks appear in each assignee's My tasks.`,
        });
      } else {
        const task = await personalTaskService.create(workspaceSlug, {
          name: draft.name.trim(),
          description: draft.description,
          priority: draft.priority,
          start_date: draft.start_date,
          target_date: draft.target_date,
        });
        onSaved(task);
        setToast({
          type: "success",
          title: "Task saved",
          message: `"${task.name}" is saved in My tasks under Personal tasks. Only you can see it. Dated tasks also appear in the Activity calendar.`,
        });
      }
      onClose();
    } catch (cause) {
      console.error("New task save failed", cause);
      const saved = Boolean(progress.current.issue);
      setPartial(saved);
      const message = `${saved ? "The task was created, but some details were not saved. Retry to finish without creating another task. " : ""}${newTaskError(cause)}`;
      setError(message);
      setToast({ type: "error", title: saved ? "Task partially saved" : "Task could not be saved", message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    draft,
    busy,
    error,
    partial,
    pending,
    actions,
    disabled,
    change,
    close,
    projects,
    save,
    setProjectReady,
    validationError,
  };
}

export const NewTaskPanel = observer(function NewTaskPanel(props: Props) {
  const { workspaceSlug, onClose } = props;
  const {
    draft,
    busy,
    error,
    partial,
    pending,
    actions,
    disabled,
    change,
    close,
    projects,
    save,
    setProjectReady,
    validationError,
  } = useNewTaskForm(props);
  const scheduleFields = (
    <>
      <TaskProperty label="Due date">
        <input
          aria-label="Due date"
          type="date"
          className={taskValueClass}
          value={draft.target_date ?? ""}
          min={draft.start_date ?? undefined}
          disabled={disabled}
          onChange={(event) => change({ target_date: event.target.value || null })}
        />
      </TaskProperty>
      <TaskProperty label="Link to Project">
        <select
          aria-label="Link to Project"
          className={taskValueClass}
          value={draft.projectId}
          disabled={disabled}
          onChange={(event) => {
            setProjectReady(false);
            change({
              projectId: event.target.value,
              assignees: [],
              stateId: "",
              fieldValues: {},
              dependencies: [],
              files: [],
              subtasks: [],
            });
          }}
        >
          <option value="">No project (Private to you)</option>
          {projects.map(
            (project) =>
              project && (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              )
          )}
        </select>
        {draft.projectId && (
          <p className="text-11 text-secondary">Changing projects clears project-specific selections.</p>
        )}
      </TaskProperty>
    </>
  );
  const priorityField = (
    <TaskProperty label="Priority">
      <select
        aria-label="Priority"
        className={taskValueClass}
        value={draft.priority}
        disabled={disabled}
        onChange={(event) => {
          const priority = priorities.find((item) => item.value === event.target.value)?.value;
          if (priority) change({ priority });
        }}
      >
        {priorities.map((priority) => (
          <option key={priority.value} value={priority.value}>
            {priority.label}
          </option>
        ))}
      </select>
    </TaskProperty>
  );
  return (
    <Dialog
      open
      modal={false}
      actionsRef={actions}
      discard={{
        when: partial,
        description:
          "The task exists, but some selected details are not saved. Closing discards the remaining draft; the task is kept.",
      }}
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <TaskFormContent presentation="side-panel" size="md">
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <DialogTitle render={<h2 className="text-24! font-semibold!">New Task</h2>}>New Task</DialogTitle>
          <button
            type="button"
            aria-label="Close task panel"
            onClick={close}
            disabled={busy}
            className="rounded p-1 text-secondary hover:bg-layer-1-hover"
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          className="flex flex-col px-5 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            aria-label="Task name"
            placeholder="Task name"
            required
            maxLength={255}
            className="mb-3 rounded border border-subtle bg-transparent px-3 py-2 text-16 font-medium"
            value={draft.name}
            disabled={disabled}
            onChange={(event) => change({ name: event.target.value })}
          />
          {draft.projectId ? (
            <NewTaskProjectFields
              key={draft.projectId}
              slug={workspaceSlug}
              draft={draft}
              disabled={disabled}
              onChange={change}
              onReady={setProjectReady}
              scheduleFields={scheduleFields}
              priorityField={priorityField}
            />
          ) : (
            <>
              <PrivateProjectFields />
              {scheduleFields}
              <TaskProperty label="Dependencies">
                <button type="button" disabled className="py-1 text-13 text-placeholder">
                  Add dependencies
                </button>
              </TaskProperty>
              {priorityField}
              <TaskProperty label="Stage">
                <span className="text-13 text-placeholder">To do</span>
              </TaskProperty>
              <TaskProperty label="Status">
                <span className="rounded-full bg-layer-1 px-2 py-1 text-12 text-secondary">No status</span>
              </TaskProperty>
            </>
          )}
          <TaskAttachments draft={draft} disabled={disabled} onChange={change} />
          {!draft.projectId && (
            <p className="mb-3 text-12 text-secondary">
              Private to you. Choose a project to enable teammates, dependencies, stage, status, files, and subtasks.
            </p>
          )}
          <TaskProperty label="Start date">
            <input
              aria-label="Start date"
              type="date"
              className={taskValueClass}
              value={draft.start_date ?? ""}
              max={draft.target_date ?? undefined}
              disabled={disabled}
              onChange={(event) => change({ start_date: event.target.value || null })}
            />
          </TaskProperty>
          <label className="my-3 flex flex-col gap-2 border-y border-subtle bg-layer-1 p-3 text-13 font-medium">
            Description
            <textarea
              aria-label="Description"
              placeholder="Add a description..."
              rows={4}
              maxLength={20000}
              className="font-normal resize-y bg-transparent outline-none"
              value={draft.description}
              disabled={disabled}
              onChange={(event) => change({ description: event.target.value })}
            />
          </label>
          <TaskSubtasks draft={draft} disabled={disabled} onChange={change} />
          {error && (
            <p role="alert" className="my-3 text-13 text-danger-primary">
              {error}
            </p>
          )}
          <p className="my-3 text-12 text-secondary">
            {draft.projectId
              ? "Saved to the selected project. Project members can see this task."
              : "Saved in My tasks under Personal tasks. If both dates are empty, the due date defaults to today."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" stretch="auto" label="Cancel" disabled={busy} onClick={close} />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              label={partial ? "Retry save" : "Save"}
              loading={busy}
              disabled={Boolean(validationError)}
            />
          </div>
        </form>
      </TaskFormContent>
    </Dialog>
  );
});

function TaskAttachments({
  draft,
  disabled,
  onChange,
}: {
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  const enabled = !disabled && Boolean(draft.projectId);
  return (
    <TaskProperty label="Attach File">
      <label
        className={`inline-block py-1 text-13 ${enabled ? "cursor-pointer" : "cursor-not-allowed text-placeholder"}`}
      >
        Add file
        <input
          aria-label="Attach File"
          type="file"
          multiple
          className="sr-only"
          disabled={!enabled}
          onChange={(event) => {
            const files = new Map(
              [...draft.files, ...Array.from(event.target.files ?? [])].map((file) => [taskFileKey(file), file])
            );
            onChange({ files: Array.from(files.values()) });
            event.target.value = "";
          }}
        />
      </label>
      {draft.files.map((file) => (
        <div key={taskFileKey(file)} className="flex gap-2 text-12">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove file ${file.name}`}
            onClick={() => onChange({ files: draft.files.filter((item) => item !== file) })}
          >
            Remove
          </button>
        </div>
      ))}
    </TaskProperty>
  );
}

function TaskSubtasks({
  draft,
  disabled,
  onChange,
}: {
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  return (
    <section aria-label="Subtasks" className="border-b border-subtle pb-4">
      <h3 className="mb-3 text-13 font-semibold">Subtasks</h3>
      {draft.subtasks.map((task, index) => (
        <div key={task.id} className="mb-2 flex gap-2">
          <input
            aria-label={`Subtask ${index + 1}`}
            required
            maxLength={255}
            value={task.name}
            disabled={disabled}
            className="min-w-0 flex-1 rounded border border-subtle bg-transparent p-2 text-13"
            onChange={(event) =>
              onChange({
                subtasks: draft.subtasks.map((item) =>
                  item.id === task.id ? { ...item, name: event.target.value } : item
                ),
              })
            }
          />
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove subtask ${index + 1}`}
            onClick={() => onChange({ subtasks: draft.subtasks.filter((item) => item.id !== task.id) })}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-13 text-[#135DDD] disabled:text-placeholder"
        disabled={disabled || !draft.projectId}
        onClick={() => onChange({ subtasks: [...draft.subtasks, { id: crypto.randomUUID(), name: "" }] })}
      >
        + Add subtask
      </button>
    </section>
  );
}
