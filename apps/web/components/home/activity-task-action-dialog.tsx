import { useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
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
import { generateWorkItemLink } from "@plane/utils";
import { IssueService } from "@/services/issue/issue.service";
import { personalTaskService, personalTaskError } from "@/services/personal-task.service";
import type { TOverviewTask } from "./activity-overview.helpers";

const issueService = new IssueService();
const subscribeOrigin = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";

function SharingStatus({
  token,
  loaded,
  error,
  onRetry,
}: {
  token?: string | null;
  loaded: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const origin = useSyncExternalStore(subscribeOrigin, browserOrigin, serverOrigin);
  if (error)
    return (
      <p role="alert">
        Could not load sharing settings.{" "}
        <button type="button" className="underline" onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  if (!loaded) return <p role="status">Checking sharing...</p>;
  return token ? (
    <label className="flex flex-col gap-2">
      Public task link
      <input
        readOnly
        className="rounded border border-subtle bg-surface-1 p-2"
        value={`${origin}/shared/personal-tasks/${token}/`}
        onFocus={(event) => event.target.select()}
      />
    </label>
  ) : null;
}

function actionDescription(sharing: boolean, personal: boolean) {
  if (!sharing) return "This deletes the task and disables any shared personal-task link. This cannot be undone.";
  return personal
    ? "Anyone with the link can view the task name, description, priority, dates, and completion status without signing in. The link does not allow editing."
    : "Copy a link to this project task. Existing project permissions still apply.";
}

function taskActionLabel(sharing: boolean, needsEnable: boolean) {
  if (!sharing) return "Delete task";
  return needsEnable ? "Enable sharing & copy link" : "Copy link";
}

type Props = {
  task: TOverviewTask;
  action: "share" | "delete";
  workspaceSlug: string;
  onClose: () => void;
  onDeleted: () => void;
};

function useTaskAction({ task, action, workspaceSlug, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const sharing = action === "share";
  const status = useSWR(
    sharing && task.personal ? ["personal-task-share", workspaceSlug, task.personal.id] : null,
    () => personalTaskService.shareStatus(workspaceSlug, task.personal!.id),
    { shouldRetryOnError: false }
  );
  const perform = async (operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      console.error("Activity task action failed", cause);
      const message = personalTaskError(cause, "Could not complete the task action. Please retry.");
      setError(message);
      setToast({ type: "error", title: "Task action failed", message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const copyLink = () =>
    perform(async () => {
      let url: string;
      if (task.personal) {
        const { token } = await personalTaskService.share(workspaceSlug, task.personal.id);
        await status.mutate({ token }, { revalidate: false });
        url = `${window.location.origin}/shared/personal-tasks/${token}/`;
      } else {
        url = `${window.location.origin}${generateWorkItemLink({ workspaceSlug, projectId: task.project.project_id, issueId: task.project.id, projectIdentifier: task.project.project_identifier, sequenceId: task.project.sequence_id })}`;
      }
      await navigator.clipboard.writeText(url);
      setToast({
        type: "success",
        title: "Link copied",
        message: task.personal
          ? "Anyone with this link can view this task. Stop sharing to revoke access."
          : "Only people with project access can open this link.",
      });
    });
  const remove = () =>
    perform(async () => {
      if (task.personal) await personalTaskService.remove(workspaceSlug, task.personal.id);
      else await issueService.deleteIssue(workspaceSlug, task.project.project_id, task.project.id);
      onDeleted();
      setToast({ type: "success", title: "Task deleted", message: `"${task.name}" was deleted.` });
      onClose();
    });
  const revoke = () =>
    perform(async () => {
      await personalTaskService.revokeShare(workspaceSlug, task.personal!.id);
      await status.mutate({ token: null }, { revalidate: false });
      setToast({ type: "success", title: "Sharing stopped", message: "The previous link no longer works." });
    });
  return { busy, error, pending, sharing, status, copyLink, remove, revoke };
}

export function ActivityTaskActionDialog(props: Props) {
  const { task, onClose } = props;
  const { busy, error, pending, sharing, status, copyLink, remove, revoke } = useTaskAction(props);
  const description = actionDescription(sharing, Boolean(task.personal));
  const actionLabel = taskActionLabel(sharing, Boolean(task.personal && !status.data?.token));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{sharing ? "Share task" : "Delete task"}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 text-13">
              <p className="font-medium break-words">{task.name}</p>
              <p>{description}</p>
              {sharing && task.personal && (
                <SharingStatus
                  token={status.data?.token}
                  loaded={Boolean(status.data)}
                  error={Boolean(status.error)}
                  onRetry={() => void status.mutate()}
                />
              )}
              {error && (
                <p role="alert" className="text-danger-primary">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="md" stretch="auto" label="Cancel" disabled={busy} onClick={onClose} />
                {sharing && status.data?.token && (
                  <Button
                    variant="secondary"
                    size="md"
                    stretch="auto"
                    label="Stop sharing"
                    disabled={busy}
                    onClick={() => void revoke()}
                  />
                )}
                <Button
                  variant={sharing ? "primary" : "danger"}
                  size="md"
                  stretch="auto"
                  label={actionLabel}
                  loading={busy}
                  disabled={busy || Boolean(sharing && task.personal && (!status.data || status.error))}
                  onClick={() => void (sharing ? copyLink() : remove())}
                />
              </div>
            </div>
          </DialogBody>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
