import { useState } from "react";
import useSWR from "swr";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { Input } from "@makeplane/propel/components/input";
import { setToast } from "@plane/blocks/toast";
import { WorkspaceService } from "@/services/workspace.service";
import { recordingService } from "@/services/recording.service";
import type { TRecording } from "@/services/recording.service";
import { useAttachmentSearch } from "@/components/workspace-pages/use-attachment-search";

const workspaceService = new WorkspaceService();
type ActionProps = {
  workspaceSlug: string;
  recording: TRecording;
  busy: boolean;
  submit: (action: () => Promise<unknown>, message: string) => Promise<void>;
};

export const RecordingActions = observer(function RecordingActions({
  workspaceSlug,
  recording,
  onChanged,
}: {
  workspaceSlug: string;
  recording: TRecording;
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<"share" | "attach" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setToast({ type: "success", title: "Recorder", message });
      setPanel(null);
      onChanged();
    } catch (cause) {
      console.error("Recorder action failed", cause);
      setError("Could not complete this action. Check your permissions and retry.");
    } finally {
      setBusy(false);
    }
  };
  const props = { workspaceSlug, recording, busy, submit };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {recording.ready && (
          <>
            <Button
              size="md"
              stretch="auto"
              variant="secondary"
              label="Share"
              disabled={busy}
              onClick={() => {
                setPanel("share");
                setError("");
              }}
            />
            <Button
              size="md"
              stretch="auto"
              variant="secondary"
              label="Attach to task"
              disabled={busy}
              onClick={() => {
                setPanel("attach");
                setError("");
              }}
            />
          </>
        )}
        <Button
          size="md"
          stretch="auto"
          variant="secondary"
          label="Delete"
          disabled={busy}
          onClick={() => {
            setPanel("delete");
            setError("");
          }}
        />
      </div>
      {panel === "share" && <SharePanel {...props} />}
      {panel === "attach" && <AttachPanel {...props} />}
      {panel === "delete" && (
        <div className="space-y-2">
          <p className="text-13">Permanently delete this recording and its task links?</p>
          <Button
            size="md"
            stretch="auto"
            variant="primary"
            label="Confirm delete"
            disabled={busy}
            onClick={() =>
              void submit(() => recordingService.remove(workspaceSlug, recording.id), "Recording deleted.")
            }
          />
        </div>
      )}
      {panel && (
        <Button
          size="md"
          stretch="auto"
          variant="secondary"
          label="Cancel"
          disabled={busy}
          onClick={() => setPanel(null)}
        />
      )}
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
});

function SharePanel({ workspaceSlug, recording, busy, submit }: ActionProps) {
  const [draft, setSelected] = useState<string[] | null>(null);
  const selected = draft ?? recording.viewer_ids;
  const selectedIds = new Set(selected);
  const members = useSWR(["recorder-members", workspaceSlug], () =>
    workspaceService.fetchWorkspaceMembers(workspaceSlug)
  );
  return (
    <div className="space-y-3">
      <p className="text-13">
        Only selected active teammates can play this recording. Clear all to make it private again.
      </p>
      {members.isLoading && <p role="status">Loading teammates...</p>}
      {members.error && (
        <p role="alert">
          Could not load teammates.{" "}
          <button className="underline" onClick={() => void members.mutate()}>
            Retry
          </button>
        </p>
      )}
      <div className="max-h-48 space-y-2 overflow-auto">
        {members.data
          ?.filter(
            (member) => member.member.id !== recording.owner_id && member.is_active !== false && !member.member.is_bot
          )
          .map(({ member }) => (
            <label key={member.id} className="flex items-center gap-2 text-13">
              <input
                type="checkbox"
                disabled={busy}
                checked={selectedIds.has(member.id)}
                onChange={(event) =>
                  setSelected((value) =>
                    event.target.checked
                      ? [...(value ?? recording.viewer_ids), member.id]
                      : (value ?? recording.viewer_ids).filter((id) => id !== member.id)
                  )
                }
              />
              {member.display_name || member.first_name || member.email}
            </label>
          ))}
      </div>
      <Button
        size="md"
        stretch="auto"
        variant="primary"
        label="Save sharing"
        disabled={busy || !members.data || !!members.error}
        onClick={() =>
          void submit(() => recordingService.share(workspaceSlug, recording.id, selected), "Sharing updated.")
        }
      />
    </div>
  );
}

const AttachPanel = observer(function AttachPanel({ workspaceSlug, recording, busy, submit }: ActionProps) {
  const [query, setQuery] = useState("");
  const search = useAttachmentSearch(workspaceSlug, query, true);
  return (
    <div className="space-y-3">
      <p className="text-13">Adding a task link does not grant access. Share with the relevant teammates separately.</p>
      <Input
        size="lg"
        aria-label="Search tasks"
        placeholder="Search tasks"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {search.loading && <p role="status">Searching...</p>}
      {search.error && (
        <p role="alert">
          {search.error}{" "}
          <button className="underline" onClick={search.retry}>
            Retry
          </button>
        </p>
      )}
      <div className="max-h-48 space-y-2 overflow-auto">
        {search.issues.map((issue) => (
          <button
            key={issue.id}
            disabled={busy}
            className="block w-full rounded border border-subtle-1 p-2 text-left text-13 hover:bg-layer-1"
            onClick={() =>
              void submit(
                () => recordingService.attach(workspaceSlug, recording.id, issue.id),
                "Recording linked to task."
              )
            }
          >
            {issue.project__identifier}-{issue.sequence_id} {issue.name}
          </button>
        ))}
        {!search.loading && !search.error && !search.issues.length && <p className="text-13">No tasks found.</p>}
      </div>
    </div>
  );
});
