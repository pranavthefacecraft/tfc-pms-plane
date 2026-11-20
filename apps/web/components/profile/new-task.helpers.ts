import { isAxiosError } from "axios";
import type { TIssue } from "@plane/types";
import { customFields } from "@/components/projects/custom-fields/service";
import { IssueService } from "@/services/issue/issue.service";
import { IssueAttachmentService } from "@/services/issue/issue_attachment.service";
import { IssueRelationService } from "@/services/issue/issue_relation.service";
import type { TPersonalTaskData } from "@/services/personal-task.service";
import { ProjectCollaboratorsService } from "@/services/project-collaborators.service";

export type TNewTaskDraft = TPersonalTaskData & {
  projectId: string;
  /** Project section to create the task in; omitted means the project's default section. */
  sectionId?: string | null;
  assignees: string[];
  stateId: string;
  fieldValues: Record<string, string>;
  dependencies: { id: string; name: string }[];
  files: File[];
  subtasks: { id: string; name: string }[];
  inviteEmails?: string[];
};
export type TTaskSaveProgress = { issue?: TIssue; completed: Set<string> };
/** Creates the main work item; layouts pass their store action so the new task shows up immediately. */
export type TCreateTaskIssue = (projectId: string, data: Partial<TIssue>) => Promise<TIssue | undefined>;

export const taskFileKey = (file: File) => JSON.stringify([file.name, file.size, file.type, file.lastModified]);
export const taskValueClass =
  "min-w-0 w-full rounded border-0 bg-transparent px-0 py-1 text-13 text-primary outline-none focus:ring-1 focus:ring-accent-primary disabled:cursor-not-allowed disabled:text-placeholder";
const issues = new IssueService();
const attachments = new IssueAttachmentService();
const relations = new IssueRelationService();
const collaborators = new ProjectCollaboratorsService();

export function taskDescriptionHTML(description: string) {
  const content = document.createElement("div");
  content.textContent = description;
  return `<p>${content.innerHTML.replaceAll("\n", "<br>")}</p>`;
}

export function newTaskValidationError(draft: TNewTaskDraft, personalAllowed: boolean, projectReady: boolean) {
  if (!draft.name.trim()) return "Enter a task name.";
  if (!draft.projectId && !personalAllowed) return "Choose a project.";
  if (draft.subtasks.some((task) => !task.name.trim())) return "Enter a name for every subtask.";
  if (draft.projectId && !projectReady) return "Project fields are not ready. Wait for them to load or use Retry.";
  return "";
}

export function newTaskHints(hasProject: boolean, personalAllowed: boolean) {
  const choose =
    "Choose a project to assign or invite teammates and enable dependencies, project workflow, status, files, and subtasks.";
  return {
    choose: personalAllowed ? `Private to you. ${choose}` : choose,
    saved:
      hasProject || !personalAllowed
        ? "Saved to the selected project. Project members can see this task."
        : "Saved in My tasks under Personal tasks. If both dates are empty, the due date defaults to today.",
  };
}

export function newTaskError(error: unknown) {
  const data: unknown = isAxiosError(error) ? error.response?.data : error;
  if (data && typeof data === "object" && !(data instanceof Error)) {
    const message = Object.entries(data)
      .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join("; ");
    if (message) return message;
  }
  return "Could not finish saving your task. Check your connection and retry.";
}

export async function saveProjectTask(
  slug: string,
  draft: TNewTaskDraft,
  progress: TTaskSaveProgress,
  create: TCreateTaskIssue = (projectId, data) => issues.createIssue(slug, projectId, data)
) {
  if (!draft.projectId || !draft.name.trim()) throw new Error("A project and task name are required.");
  if (draft.subtasks.some((task) => !task.name.trim())) throw new Error("Enter a name for every subtask.");
  if (!progress.issue) {
    const created = await create(draft.projectId, {
      project_id: draft.projectId,
      name: draft.name.trim(),
      description_html: taskDescriptionHTML(draft.description),
      priority: draft.priority,
      start_date: draft.start_date,
      target_date: draft.target_date,
      assignee_ids: draft.assignees,
      ...(draft.stateId ? { state_id: draft.stateId } : {}),
      ...(draft.sectionId !== undefined ? { section_id: draft.sectionId } : {}),
    });
    if (!created) throw new Error("The task could not be created.");
    progress.issue = created;
  }
  await saveProjectTaskDetails(slug, draft, progress.issue.id, progress);
  return progress.issue;
}

export async function saveProjectTaskDetails(
  slug: string,
  draft: TNewTaskDraft,
  issueId: string,
  progress: TTaskSaveProgress,
  initial?: Pick<TNewTaskDraft, "fieldValues" | "dependencies">
) {
  const step = async (key: string, run: () => Promise<unknown>) => {
    if (progress.completed.has(key)) return;
    await run();
    progress.completed.add(key);
  };
  const operations = Object.entries(draft.fieldValues)
    .filter(([fieldId, value]) => value !== (initial?.fieldValues[fieldId] ?? ""))
    .map(([fieldId, value]) =>
      step(`field-${fieldId}`, () => customFields.setValue(slug, draft.projectId, issueId, fieldId, value || null))
    );
  const inviteEmails = draft.inviteEmails;
  if (inviteEmails?.length) {
    operations.push(
      step("assignee-invitations", () =>
        collaborators.invite(
          slug,
          draft.projectId,
          inviteEmails.map((email) => ({ email, role: 15 })),
          issueId
        )
      )
    );
  }
  const previousDependencies = new Set(initial?.dependencies.map(({ id }) => id));
  const nextDependencies = new Set(draft.dependencies.map(({ id }) => id));
  const added = draft.dependencies.filter(({ id }) => !previousDependencies.has(id));
  if (added.length) {
    operations.push(
      step("dependencies", () =>
        issues.createIssueRelation(slug, draft.projectId, issueId, {
          related_list: added.map((task) => ({ relation_type: "blocked_by", related_issue: task.id })),
        })
      )
    );
  }
  for (const id of previousDependencies) {
    if (!nextDependencies.has(id)) {
      operations.push(
        step(`remove-dependency-${id}`, () =>
          relations.deleteIssueRelation(slug, draft.projectId, issueId, {
            relation_type: "blocked_by",
            related_issue: id,
          })
        )
      );
    }
  }
  operations.push(
    ...draft.files.map((file) =>
      step(`file-${taskFileKey(file)}`, () => attachments.uploadIssueAttachment(slug, draft.projectId, issueId, file))
    )
  );
  operations.push(
    ...draft.subtasks.map((subtask) =>
      step(`subtask-${subtask.id}`, () =>
        issues.createIssue(slug, draft.projectId, {
          name: subtask.name.trim(),
          parent_id: issueId,
          assignee_ids: draft.assignees,
          priority: draft.priority,
          ...(draft.stateId ? { state_id: draft.stateId } : {}),
        })
      )
    )
  );
  // Wait for every write before allowing a retry; retain checkpoints for successful details.
  const results = await Promise.allSettled(operations);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}
