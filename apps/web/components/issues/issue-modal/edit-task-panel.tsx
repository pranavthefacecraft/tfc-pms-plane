import { useId, useRef, useState } from "react";
import { isEqual } from "lodash-es";
import useSWR, { useSWRConfig } from "swr";
import { Dialog, DialogTitle } from "@makeplane/propel/components/dialog";
import type { EditorRefApi } from "@plane/editor";
import { EFileAssetType, EIssuesStoreType } from "@plane/types";
import type { TIssue } from "@plane/types";
import { TaskFormContent } from "@/components/common/task-form-content";
import { RichTextEditor } from "@/components/editor/rich-text";
import { NewTaskPanel } from "@/components/profile/new-task-panel";
import { saveProjectTaskDetails } from "@/components/profile/new-task.helpers";
import type { TNewTaskDraft } from "@/components/profile/new-task.helpers";
import { customFields } from "@/components/projects/custom-fields/service";
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { FileService } from "@/services/file.service";
import { IssueService } from "@/services/issue/issue.service";
import { IssueAttachmentService } from "@/services/issue/issue_attachment.service";
import { IssueRelationService } from "@/services/issue/issue_relation.service";
import { WorkspaceService } from "@/services/workspace.service";

const issues = new IssueService();
const attachments = new IssueAttachmentService();
const relations = new IssueRelationService();
const workspaces = new WorkspaceService();
const files = new FileService();

function refreshTaskData(promise: Promise<unknown>) {
  void promise.catch((error: unknown) => console.error("Could not refresh task data after saving", error));
}

async function loadTask(slug: string, projectId: string, issueId: string) {
  const [issue, values, related, attached, children] = await Promise.all([
    issues.retrieve(slug, projectId, issueId),
    customFields.values(slug, projectId, issueId),
    relations.listIssueRelations(slug, projectId, issueId),
    attachments.getIssueAttachments(slug, projectId, issueId),
    issues.subIssues(slug, projectId, issueId),
  ]);
  return {
    issue,
    defaults: {
      projectId,
      name: issue.name,
      priority: issue.priority ?? "none",
      start_date: issue.start_date ?? null,
      target_date: issue.target_date ?? null,
      assignees: issue.assignee_ids,
      stateId: issue.state_id ?? "",
      fieldValues: Object.fromEntries(
        Object.entries(values).flatMap(([id, value]) => (typeof value === "string" ? [[id, value]] : []))
      ),
      dependencies: related.blocked_by.map(({ id, name }) => ({ id, name })),
    } satisfies Partial<TNewTaskDraft>,
    attachments: attached.map(({ id, attributes }) => ({ id, name: attributes.name })),
    subtasks: Array.isArray(children.sub_issues) ? children.sub_issues : Object.values(children.sub_issues).flat(),
  };
}

type Props = {
  slug: string;
  projectId: string;
  issueId: string;
  onClose: () => void;
};

export function EditTaskPanel(props: Props) {
  const { slug, projectId, issueId, onClose } = props;
  const task = useSWR(["edit-task", slug, projectId, issueId], () => loadTask(slug, projectId, issueId), {
    dedupingInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
  if (task.data && !task.isValidating && !task.error) return <EditTaskForm {...props} task={task.data} />;

  return (
    <Dialog open modal={false} disablePointerDismissal onOpenChange={(open) => !open && onClose()}>
      <TaskFormContent size="md" presentation="side-panel">
        <div className="space-y-3 p-5">
          <DialogTitle>Edit Task</DialogTitle>
          {task.error ? (
            <p role="alert">
              Could not load the task.{" "}
              <button type="button" className="underline" onClick={() => void task.mutate()}>
                Retry
              </button>
            </p>
          ) : (
            <p role="status">Loading task...</p>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </TaskFormContent>
    </Dialog>
  );
}

function EditTaskForm({
  slug,
  projectId,
  issueId,
  onClose,
  task,
}: Props & { task: Awaited<ReturnType<typeof loadTask>> }) {
  const [initial] = useState(() => task);
  const { defaults } = initial;
  const { mutate } = useSWRConfig();
  const { updateIssue } = useIssuesActions(EIssuesStoreType.PROJECT);
  const { fetchRelations, fetchAttachments, fetchSubIssues, fetchActivities } = useIssueDetail();
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  const editor = useRef<EditorRefApi>(null);
  const editorId = useId();
  const originalHTML = initial.issue.description_html || "<p></p>";
  const description = useRef<string | undefined>(undefined);
  const uploaded = useRef<string[]>([]);
  const refresh = (draft: TNewTaskDraft) => {
    refreshTaskData(
      mutate(
        (key) =>
          Array.isArray(key) &&
          key[1] === slug &&
          (["project-task-list", "my-tasks-list", "activity-schedule"].includes(String(key[0])) ||
            (key[0] === "task-custom-field-values" && key[2] === projectId && key[3] === issueId))
      )
    );
    refreshTaskData(fetchActivities(slug, projectId, issueId));
    if (!isEqual(defaults.dependencies, draft.dependencies)) refreshTaskData(fetchRelations(slug, projectId, issueId));
    if (draft.files.length) refreshTaskData(fetchAttachments(slug, projectId, issueId));
    if (draft.subtasks.length) refreshTaskData(fetchSubIssues(slug, projectId, issueId));
  };
  return (
    <NewTaskPanel
      workspaceSlug={slug}
      defaults={defaults}
      projectLocked
      onClose={onClose}
      onSaved={() => {}}
      edit={{
        issueId,
        attachments: initial.attachments,
        subtasks: initial.subtasks,
        descriptionEditor: (disabled) => (
          <RichTextEditor
            ref={editor}
            id={editorId}
            initialValue={originalHTML}
            editable={!disabled}
            placeholder="Add a description..."
            containerClassName="min-h-24"
            workspaceId={getWorkspaceBySlug(slug)?.id ?? ""}
            workspaceSlug={slug}
            projectId={projectId}
            onChange={(_, html, meta) => {
              if (!meta?.isMigrationUpdate) description.current = html;
            }}
            searchMentionCallback={(payload) => workspaces.searchEntity(slug, { ...payload, project_id: projectId })}
            uploadFile={async (blockId, file) => {
              const { asset_id } = await uploadEditorAsset({
                blockId,
                data: { entity_identifier: issueId, entity_type: EFileAssetType.ISSUE_DESCRIPTION },
                file,
                projectId,
                workspaceSlug: slug,
              });
              uploaded.current.push(asset_id);
              return asset_id;
            }}
            duplicateFile={async (assetId) => {
              const { asset_id } = await duplicateEditorAsset({
                assetId,
                entityId: issueId,
                entityType: EFileAssetType.ISSUE_DESCRIPTION,
                projectId,
                workspaceSlug: slug,
              });
              uploaded.current.push(asset_id);
              return asset_id;
            }}
          />
        ),
        save: async (draft, progress) => {
          if (editor.current && !editor.current.isEditorReadyToDiscard()) {
            throw { description: "Wait for the description upload to finish, then save again." };
          }
          if (!progress.completed.has("issue-update")) {
            const name = draft.name.trim();
            const payload: Partial<TIssue> = {
              ...(name !== defaults.name ? { name } : {}),
              ...(draft.priority !== defaults.priority ? { priority: draft.priority } : {}),
              ...(draft.target_date !== defaults.target_date ? { target_date: draft.target_date } : {}),
              ...(draft.stateId && draft.stateId !== defaults.stateId ? { state_id: draft.stateId } : {}),
              ...(!isEqual(draft.assignees, defaults.assignees) ? { assignee_ids: draft.assignees } : {}),
              ...(description.current !== undefined && description.current !== originalHTML
                ? { description_html: description.current }
                : {}),
            };
            if (Object.keys(payload).length) {
              if (!updateIssue) throw { task: "This task cannot be updated here." };
              await updateIssue(projectId, issueId, payload);
            }
            progress.completed.add("issue-update");
          }
          try {
            if (uploaded.current.length && !progress.completed.has("description-assets")) {
              await files.updateBulkProjectAssetsUploadStatus(slug, projectId, issueId, {
                asset_ids: uploaded.current,
              });
              progress.completed.add("description-assets");
            }
            await saveProjectTaskDetails(slug, draft, issueId, progress, defaults);
          } finally {
            refresh(draft);
          }
        },
      }}
    />
  );
}
