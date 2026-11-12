import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Link } from "react-router";
import { Button } from "@makeplane/propel/components/button";
import { Input } from "@makeplane/propel/components/input";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { recordingService } from "@/services/recording.service";
import type { TRecording } from "@/services/recording.service";
import { CapturePanel } from "./capture-panel";
import { RecordingActions } from "./recording-actions";

export function RecorderRoot({ workspaceSlug, recordingId }: { workspaceSlug: string; recordingId?: string }) {
  return (
    <div className="h-full overflow-y-auto bg-surface-1 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-24 font-semibold">Recorder</h1>
          {recordingId && (
            <Link className="text-13 text-accent-primary underline" to={`/${workspaceSlug}/tool/recorder/`}>
              Back to recordings
            </Link>
          )}
        </header>
        {recordingId ? (
          <RecordingDetail workspaceSlug={workspaceSlug} recordingId={recordingId} />
        ) : (
          <RecordingLibrary workspaceSlug={workspaceSlug} />
        )}
      </div>
    </div>
  );
}

const RecordingLibrary = observer(function RecordingLibrary({ workspaceSlug }: { workspaceSlug: string }) {
  const { data: user } = useUser();
  const { getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();
  const canRecord = (getWorkspaceRoleByWorkspaceSlug(workspaceSlug) ?? 0) >= 15 && !user?.is_bot;
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const list = useSWR(["recordings", workspaceSlug, offset, query], () =>
    recordingService.list(workspaceSlug, offset, query)
  );
  const changed = () => {
    void list.mutate();
  };
  return (
    <>
      {canRecord && <CapturePanel workspaceSlug={workspaceSlug} onSaved={changed} />}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setQuery(draftQuery.trim());
        }}
      >
        <Input
          size="lg"
          aria-label="Search recordings"
          placeholder="Search your recordings"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
        />
        <Button size="md" stretch="auto" type="submit" variant="secondary" label="Search" />
      </form>
      {list.isLoading && <p role="status">Loading recordings...</p>}
      {list.error && (
        <p role="alert">
          Could not load recordings.{" "}
          <button className="underline" onClick={changed}>
            Retry
          </button>
        </p>
      )}
      {list.data?.results.map((recording) => (
        <RecordingCard
          key={recording.id}
          workspaceSlug={workspaceSlug}
          recording={recording}
          owner={recording.owner_id === user?.id}
          onChanged={changed}
        />
      ))}
      {list.data && !list.data.results.length && <p className="text-14 text-secondary">No recordings found.</p>}
      <div className="flex gap-2">
        {offset > 0 && (
          <Button
            size="md"
            stretch="auto"
            variant="secondary"
            label="Previous"
            onClick={() => setOffset(Math.max(0, offset - 20))}
          />
        )}
        {list.data?.next_offset != null && (
          <Button
            size="md"
            stretch="auto"
            variant="secondary"
            label="Next"
            onClick={() => {
              if (list.data?.next_offset != null) setOffset(list.data.next_offset);
            }}
          />
        )}
      </div>
    </>
  );
});

function RecordingCard({
  workspaceSlug,
  recording,
  owner,
  onChanged,
}: {
  workspaceSlug: string;
  recording: TRecording;
  owner: boolean;
  onChanged: () => void;
}) {
  const access = recording.shared ? "Shared with teammates" : "Private";
  return (
    <article className="space-y-3 rounded-xl border border-subtle-1 p-4">
      <Link
        className="text-16 font-semibold text-accent-primary"
        to={`/${workspaceSlug}/tool/recorder/${recording.id}/`}
      >
        {recording.name}
      </Link>
      <p className="text-13 text-secondary">
        {recording.owner_name} · {(recording.size / 1024 / 1024).toFixed(1)} MB ·{" "}
        {Math.floor(recording.duration_ms / 60000)}m {Math.floor(recording.duration_ms / 1000) % 60}s ·{" "}
        {recording.ready ? access : "Unfinished upload"}
      </p>
      {owner && <RecordingActions workspaceSlug={workspaceSlug} recording={recording} onChanged={onChanged} />}
    </article>
  );
}

const RecordingDetail = observer(function RecordingDetail({
  workspaceSlug,
  recordingId,
}: {
  workspaceSlug: string;
  recordingId: string;
}) {
  const { data: user } = useUser();
  const detail = useSWR(["recording", workspaceSlug, recordingId], () =>
    recordingService.detail(workspaceSlug, recordingId)
  );
  const changed = () => {
    void detail.mutate();
  };
  return (
    <>
      {detail.isLoading && <p role="status">Loading recording...</p>}
      {detail.error && (
        <p role="alert">
          Recording unavailable, deleted or not shared with you.{" "}
          <button className="underline" onClick={changed}>
            Retry
          </button>
        </p>
      )}
      {detail.data && (
        <section className="space-y-4">
          <h2 className="text-20 font-semibold">{detail.data.name}</h2>
          {detail.data.ready ? (
            <PrivatePlayer key={recordingId} workspaceSlug={workspaceSlug} recordingId={recordingId} />
          ) : (
            <p>This recording has not finished uploading.</p>
          )}
          {detail.data.owner_id === user?.id && (
            <RecordingActions workspaceSlug={workspaceSlug} recording={detail.data} onChanged={changed} />
          )}
        </section>
      )}
    </>
  );
});

function PrivatePlayer({ workspaceSlug, recordingId }: { workspaceSlug: string; recordingId: string }) {
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Captions require the deferred local transcript phase. */}
      <video
        aria-label="Private recording playback"
        key={attempt}
        crossOrigin="use-credentials"
        controls
        src={recordingService.playback(workspaceSlug, recordingId)}
        className="max-h-[65vh] w-full rounded-lg bg-black"
        onError={(event) => {
          console.error("Private recording playback failed", event.currentTarget.error);
          setError(true);
        }}
      />
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          Could not play this recording. Check your access or browser format support.{" "}
          <button
            className="underline"
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </p>
      )}
    </>
  );
}
