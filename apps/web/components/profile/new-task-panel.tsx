import { useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
import { Dialog, DialogTitle } from "@makeplane/propel/components/dialog";
import type { DialogImperativeActions } from "@makeplane/propel/components/dialog";
import type { TIssue } from "@plane/types";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { TaskFormContent } from "@/components/common/task-form-content";
import { TaskDateField } from "./task-date-field";
import { PersonalTaskStageSelect } from "./personal-task-stage-select";
import { useProject } from "@/hooks/store/use-project";
import type { TPersonalTask } from "@/services/personal-task.service";
import { personalTaskService } from "@/services/personal-task.service";
import { NewTaskProjectFields, PrivateProjectFields, TaskProperty } from "./new-task-project-fields";
import {
  newTaskError,
  newTaskHints,
  newTaskValidationError,
  saveProjectTask,
  taskFileKey,
  taskValueClass,
} from "./new-task.helpers";
import type { TCreateTaskIssue, TNewTaskDraft, TTaskSaveProgress } from "./new-task.helpers";

type Props = {
  workspaceSlug: string;
  onClose: () => void;
  /** `task` is set for personal tasks, `issue` for tasks saved to a project. */
  onSaved: (task?: TPersonalTask, issue?: TIssue) => void;
  /** Values preselected from where the form was opened, such as a project, section or board column. */
  defaults?: Partial<TNewTaskDraft>;
  /** Keeps the task in `defaults.projectId`. */
  projectLocked?: boolean;
  /** Limits the projects offered; personal tasks are not offered when set. */
  allowedProjectIds?: string[];
  createIssue?: TCreateTaskIssue;
  schedule?: boolean;
  edit?: {
    issueId: string;
    save: (draft: TNewTaskDraft, progress: TTaskSaveProgress) => Promise<void>;
    descriptionEditor: (disabled: boolean) => ReactNode;
    attachments: { id: string; name: string }[];
    subtasks: { id: string; name: string }[];
  };
};

const priorities = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Normal" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
] as const;

function useNewTaskForm({
  workspaceSlug,
  onClose,
  onSaved,
  defaults,
  projectLocked,
  allowedProjectIds,
  createIssue,
  edit,
}: Props) {
  const { joinedProjectIds, getProjectById } = useProject();
  const [draft, setDraft] = useState<TNewTaskDraft>(() => ({
    name: "",
    description: "",
    priority: "medium",
    start_date: null,
    target_date: null,
    projectId: "",
    assignees: [],
    inviteEmails: [],
    stateId: "",
    fieldValues: {},
    dependencies: [],
    files: [],
    subtasks: [],
    stage: "todo",
    ...defaults,
  }));
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
  const lockedIds = projectLocked && defaults?.projectId ? [defaults.projectId] : undefined;
  const projects = (lockedIds ?? allowedProjectIds ?? joinedProjectIds)
    .map((id) => getProjectById(id))
    .filter((project) => project && !project.archived_at);
  const personalAllowed = !projectLocked && !allowedProjectIds;
  const validationError = newTaskValidationError(draft, personalAllowed, projectReady);
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
      if (edit) {
        await edit.save(draft, progress.current);
        setToast({ type: "success", title: "Task saved", message: "Your changes were saved." });
      } else if (draft.projectId) {
        const issue = await saveProjectTask(workspaceSlug, draft, progress.current, createIssue);
        onSaved(undefined, issue);
        setToast({
          type: "success",
          title: "Task saved",
          message: `"${issue.name}" was saved in ${getProjectById(draft.projectId)?.name}. Assigned tasks appear in each assignee's My tasks.${draft.inviteEmails?.length ? " Invitations were queued; new teammates will be assigned after accepting." : ""}`,
        });
      } else {
        const task = await personalTaskService.create(workspaceSlug, {
          name: draft.name.trim(),
          description: draft.description,
          priority: draft.priority,
          start_date: draft.start_date,
          target_date: draft.target_date,
          stage: draft.stage,
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
      console.error("Task save failed", cause);
      const saved = Boolean(progress.current.issue) || progress.current.completed.has("issue-update");
      setPartial(saved);
      const message = `${saved ? (edit ? "Some changes were saved. Retry to finish saving the remaining changes. " : "The task was created, but some details were not saved. Retry to finish without creating another task. ") : ""}${newTaskError(cause)}`;
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
    personalAllowed,
    projectLocked: Boolean(projectLocked),
    save,
    setProjectReady,
    validationError,
  };
}

export const NewTaskPanel = observer(function NewTaskPanel(props: Props) {
  const { workspaceSlug, onClose, edit, schedule = false } = props;
  const title = schedule ? "Add Task" : edit ? "Edit Task" : "New Task";
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
    personalAllowed,
    projectLocked,
    save,
    setProjectReady,
    validationError,
  } = useNewTaskForm(props);
  return (
    <Dialog
      open
      modal={schedule}
      disablePointerDismissal={Boolean(edit)}
      actionsRef={actions}
      discard={{
        when: partial,
        description: edit
          ? "Closing discards the remaining unsaved changes. Previously saved changes will be kept."
          : "The task exists, but some selected details are not saved. Closing discards the remaining draft; the task is kept.",
      }}
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <TaskFormContent presentation={schedule ? "dialog" : "side-panel"} size={schedule ? "xs" : "md"}>
        <div className="flex shrink-0 items-center justify-between px-5 pt-6 pb-3">
          <DialogTitle
            render={<h2 className={schedule ? "text-20! font-semibold!" : "text-24! font-semibold!"}>{title}</h2>}
          >
            {title}
          </DialogTitle>
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
          className={schedule ? "flex min-h-0 flex-col overflow-y-auto px-5 pb-6" : "flex flex-col px-5 pb-6"}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TaskFormFields
            workspaceSlug={workspaceSlug}
            draft={draft}
            disabled={disabled}
            onChange={change}
            projects={projects}
            personalAllowed={personalAllowed}
            projectLocked={projectLocked}
            onReady={setProjectReady}
            schedule={schedule}
            edit={edit}
            error={error}
          />
          <div className={schedule ? "mt-4 flex justify-between gap-2" : "flex justify-end gap-2"}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              stretch="auto"
              label="Cancel"
              disabled={busy}
              onClick={close}
            />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              label={partial ? "Retry save" : schedule ? "Add Task" : "Save"}
              loading={busy}
              disabled={Boolean(validationError)}
            />
          </div>
        </form>
      </TaskFormContent>
    </Dialog>
  );
});

function TaskFormFields({
  workspaceSlug,
  draft,
  disabled,
  onChange,
  projects,
  personalAllowed,
  projectLocked,
  onReady,
  schedule,
  edit,
  error,
}: {
  workspaceSlug: string;
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
  projects: ReturnType<typeof useNewTaskForm>["projects"];
  personalAllowed: boolean;
  projectLocked: boolean;
  onReady: (ready: boolean) => void;
  schedule: boolean;
  edit?: Props["edit"];
  error: string;
}) {
  const projectSelect = useRef<HTMLSelectElement>(null);
  const taskNameId = useId();
  const [advanced, setAdvanced] = useState(false);
  const hints = newTaskHints(Boolean(draft.projectId), personalAllowed);
  const dueDateField = (
    <TaskProperty label="Due date">
      <TaskDateField
        label="Due date"
        value={draft.target_date ?? ""}
        min={draft.start_date ?? undefined}
        disabled={disabled}
        onChange={(target_date) => onChange({ target_date })}
      />
    </TaskProperty>
  );
  const projectPicker = (
    <TaskProjectPicker
      selectRef={projectSelect}
      draft={draft}
      projects={projects}
      disabled={disabled}
      locked={projectLocked}
      personalAllowed={personalAllowed}
      onChange={(projectId) => {
        onReady(false);
        onChange({
          projectId,
          sectionId: undefined,
          assignees: [],
          inviteEmails: [],
          stateId: "",
          fieldValues: {},
          dependencies: [],
          files: [],
          subtasks: [],
        });
      }}
    />
  );
  const priorityField = <TaskPriority draft={draft} disabled={disabled} onChange={onChange} />;
  const attachmentsField = (
    <TaskAttachments draft={draft} disabled={disabled} onChange={onChange} existing={edit?.attachments} />
  );
  const advancedToggle = (
    <label className="mb-4 flex w-fit items-center gap-2 text-13">
      <input
        type="checkbox"
        checked={advanced}
        disabled={disabled}
        onChange={(event) => setAdvanced(event.target.checked)}
      />
      Advanced Details
    </label>
  );
  return (
    <>
      {schedule && <ScheduleActivityType tabId={`${taskNameId}-tab`} panelId={`${taskNameId}-panel`} />}
      <div
        role={schedule ? "tabpanel" : undefined}
        id={schedule ? `${taskNameId}-panel` : undefined}
        aria-labelledby={schedule ? `${taskNameId}-tab` : undefined}
        className="flex flex-col"
      >
        <TaskNameInput id={taskNameId} schedule={schedule} draft={draft} disabled={disabled} onChange={onChange} />
        {draft.projectId ? (
          <NewTaskProjectFields
            key={draft.projectId}
            slug={workspaceSlug}
            draft={draft}
            disabled={disabled}
            onChange={onChange}
            onReady={onReady}
            scheduleFields={dueDateField}
            priorityField={priorityField}
            schedule={schedule ? { projectPicker, advancedToggle, advanced, attachments: attachmentsField } : undefined}
            trailingFields={
              <>
                {attachmentsField}
                {projectPicker}
              </>
            }
            issueId={edit?.issueId}
          />
        ) : (
          <PrivateTaskFields
            draft={draft}
            disabled={disabled}
            onChange={onChange}
            onChooseProject={() => projectSelect.current?.focus()}
            dueDateField={dueDateField}
            projectPicker={projectPicker}
            priorityField={priorityField}
            attachmentsField={attachmentsField}
            schedule={schedule}
            advanced={advanced}
            advancedToggle={advancedToggle}
          />
        )}
        {!draft.projectId && <p className="mb-3 text-12 text-secondary">{hints.choose}</p>}
        <TaskDetails
          schedule={schedule}
          advanced={advanced}
          edit={edit}
          draft={draft}
          disabled={disabled}
          onChange={onChange}
        />
        {error && (
          <p role="alert" className="my-3 text-13 text-danger-primary">
            {error}
          </p>
        )}
        {!schedule && (
          <p className="my-3 text-12 text-secondary">{edit ? "Changes are applied when you save." : hints.saved}</p>
        )}
      </div>
    </>
  );
}

function TaskNameInput({
  id,
  schedule,
  draft,
  disabled,
  onChange,
}: {
  id: string;
  schedule: boolean;
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  return (
    <>
      {schedule && (
        <label htmlFor={id} className="mb-1 text-12 text-secondary">
          Task Title *
        </label>
      )}
      <input
        id={id}
        aria-label={schedule ? "Task Title" : "Task name"}
        placeholder={schedule ? "Enter Task Title" : "Task name"}
        required
        maxLength={255}
        className="mb-3 rounded border border-subtle bg-transparent px-3 py-2 text-16 font-medium"
        value={draft.name}
        disabled={disabled}
        onChange={(event) => onChange({ name: event.target.value })}
      />
    </>
  );
}

function TaskPriority({
  draft,
  disabled,
  onChange,
}: {
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  return (
    <TaskProperty label="Priority">
      <select
        aria-label="Priority"
        className={taskValueClass}
        value={draft.priority}
        disabled={disabled}
        onChange={(event) => {
          const priority = priorities.find((item) => item.value === event.target.value)?.value;
          if (priority) onChange({ priority });
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
}

function TaskDetails({
  schedule,
  advanced,
  edit,
  draft,
  disabled,
  onChange,
}: {
  schedule: boolean;
  advanced: boolean;
  edit?: Props["edit"];
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
}) {
  if (schedule && !advanced) {
    return draft.subtasks.some((task) => !task.name.trim()) ? (
      <p role="alert" className="mb-3 text-12 text-danger-primary">
        Open Advanced Details and enter a name for every subtask.
      </p>
    ) : null;
  }
  return (
    <>
      {edit ? (
        <section aria-label="Description" className="my-3 border-y border-subtle bg-layer-1 p-3 text-13">
          <h3 className="mb-2 font-medium">Description</h3>
          {edit.descriptionEditor(disabled)}
        </section>
      ) : (
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
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </label>
      )}
      <TaskSubtasks draft={draft} disabled={disabled} onChange={onChange} existing={edit?.subtasks} />
    </>
  );
}

function ScheduleActivityType({ tabId, panelId }: { tabId: string; panelId: string }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-12 text-secondary">Activity Type</p>
      <div role="tablist" aria-label="Activity Type" className="flex rounded-lg bg-layer-1 p-1 text-13">
        <button
          type="button"
          role="tab"
          id={tabId}
          aria-controls={panelId}
          aria-selected="true"
          className="flex-1 rounded bg-surface-1 py-1 text-[#135DDD]"
        >
          PMS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          disabled
          title="Coming soon"
          className="flex-1 py-1 text-placeholder"
        >
          Appointment
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          disabled
          title="Coming soon"
          className="flex-1 py-1 text-placeholder"
        >
          Other
        </button>
      </div>
    </div>
  );
}

function PrivateTaskFields({
  draft,
  disabled,
  onChange,
  onChooseProject,
  dueDateField,
  projectPicker,
  priorityField,
  attachmentsField,
  schedule,
  advanced,
  advancedToggle,
}: {
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
  onChooseProject: () => void;
  dueDateField: ReactNode;
  projectPicker: ReactNode;
  priorityField: ReactNode;
  attachmentsField: ReactNode;
  schedule: boolean;
  advanced: boolean;
  advancedToggle: ReactNode;
}) {
  return (
    <>
      <PrivateProjectFields disabled={disabled} onChooseProject={onChooseProject} />
      {dueDateField}
      {schedule && projectPicker}
      {schedule && advancedToggle}
      {(!schedule || advanced) && (
        <>
          {priorityField}
          <TaskProperty label="Stage">
            <PersonalTaskStageSelect
              className={taskValueClass}
              value={draft.stage ?? "todo"}
              disabled={disabled}
              onChange={(stage) => onChange({ stage })}
            />
          </TaskProperty>
          <TaskProperty label="Status">
            <span className="rounded-full bg-layer-1 px-2 py-1 text-12 text-secondary">No status</span>
          </TaskProperty>
          {attachmentsField}
          {!schedule && projectPicker}
          <TaskProperty label="Dependencies">
            <button type="button" disabled className="py-1 text-13 text-placeholder">
              Add dependencies
            </button>
          </TaskProperty>
        </>
      )}
    </>
  );
}

function TaskAttachments({
  draft,
  disabled,
  onChange,
  existing,
}: {
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
  existing?: { id: string; name: string }[];
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
      {existing?.map(({ id, name }) => (
        <p key={id} className="truncate text-12">
          {name}
        </p>
      ))}
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
  existing,
}: {
  draft: TNewTaskDraft;
  disabled: boolean;
  onChange: (patch: Partial<TNewTaskDraft>) => void;
  existing?: { id: string; name: string }[];
}) {
  return (
    <section aria-label="Subtasks" className="border-b border-subtle pb-4">
      <h3 className="mb-3 text-13 font-semibold">Subtasks</h3>
      {existing?.map(({ id, name }) => (
        <p key={id} className="mb-2 truncate text-13">
          {name}
        </p>
      ))}
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

function TaskProjectPicker({
  selectRef,
  draft,
  projects,
  disabled,
  locked,
  personalAllowed,
  onChange,
}: {
  selectRef: RefObject<HTMLSelectElement | null>;
  draft: TNewTaskDraft;
  projects: ReturnType<typeof useNewTaskForm>["projects"];
  disabled: boolean;
  locked: boolean;
  personalAllowed: boolean;
  onChange: (projectId: string) => void;
}) {
  const emptyLabel = personalAllowed ? "No project (Private to you)" : draft.projectId ? "" : "Choose a project";
  return (
    <TaskProperty label="Link to Project">
      <select
        ref={selectRef}
        aria-label="Link to Project"
        className={taskValueClass}
        value={draft.projectId}
        disabled={disabled || locked}
        onChange={(event) => onChange(event.target.value)}
      >
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {projects.map(
          (project) =>
            project && (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            )
        )}
      </select>
      {draft.projectId && !locked && (
        <p className="text-11 text-secondary">Changing projects clears project-specific selections.</p>
      )}
    </TaskProperty>
  );
}
