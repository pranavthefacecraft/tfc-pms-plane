import { useEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Input } from "@makeplane/propel/components/input";
import type { RecordingMode } from "./cap/stream-manager";
import { recordingService } from "@/services/recording.service";
import type { TRecordingUpload } from "@/services/recording.service";
import { useRecorder } from "./use-recorder";

export function CapturePanel({ workspaceSlug, onSaved }: { workspaceSlug: string; onSaved: () => void }) {
  const capture = useRecorder();
  const [name, setName] = useState("Screen recording");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const upload = useRef<TRecordingUpload | null>(null);
  const pauseUpload = useRef(false);
  const errorMessage = capture.error || error;
  useEffect(() => {
    if (!capture.blob) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(capture.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [capture.blob]);
  const save = async () => {
    if (!capture.blob || busy) return;
    setBusy(true);
    setError("");
    pauseUpload.current = false;
    try {
      if (!upload.current)
        upload.current = {
          ...(await recordingService.startUpload(
            workspaceSlug,
            name.trim(),
            capture.blob,
            Math.min(capture.durationMs, 3600000)
          )),
          next: 1,
        };
      const current = upload.current;
      const finished = await recordingService.uploadRemainingParts(
        workspaceSlug,
        current,
        capture.blob,
        () => pauseUpload.current,
        setProgress
      );
      if (!finished) return;
      await recordingService.complete(workspaceSlug, current.id);
      upload.current = null;
      setProgress(0);
      capture.discard();
      onSaved();
    } catch (cause) {
      console.error("Recording upload failed", cause);
      setError("Could not save the recording. Your local recording is preserved. Retry or download it before leaving.");
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    setBusy(true);
    setError("");
    try {
      if (upload.current) await recordingService.remove(workspaceSlug, upload.current.id);
      upload.current = null;
      setProgress(0);
      capture.discard();
    } catch (cause) {
      console.error("Could not discard recording upload", cause);
      setError("Could not remove the pending upload. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="New recording" className="space-y-4 rounded-xl border border-subtle-1 bg-surface-1 p-6">
      <h2 className="text-18 font-semibold">Record your screen</h2>
      <p className="text-13 text-secondary">
        Powered by Cap capture code. Private until you share. Up to 500 MB / 60 minutes.
      </p>
      <p className="text-12 text-secondary">
        The browser lets you choose a screen, window or tab. System audio depends on browser support and sharing
        consent.
      </p>
      <CaptureControls capture={capture} />
      {preview && capture.blob && (
        <div className="space-y-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Captions require the deferred local transcript phase. */}
          <video controls aria-label="Recording preview" src={preview} className="max-h-96 w-full rounded bg-black" />
          <Input
            size="lg"
            aria-label="Recording name"
            value={name}
            maxLength={255}
            disabled={busy || !!upload.current}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="md"
              stretch="auto"
              variant="primary"
              label={busy ? `Saving ${progress}%` : upload.current ? "Resume / retry save" : "Save recording"}
              disabled={busy || !name.trim() || capture.blob.size > 500 * 1024 * 1024}
              onClick={() => void save()}
            />
            {busy && (
              <Button
                size="md"
                stretch="auto"
                variant="secondary"
                label="Pause upload"
                onClick={() => {
                  pauseUpload.current = true;
                }}
              />
            )}
            <a
              className="text-13 text-accent-primary underline"
              href={preview}
              download={`${name.trim() || "recording"}.${capture.blob.type.startsWith("video/mp4") ? "mp4" : "webm"}`}
            >
              Download locally
            </a>
            <Button
              size="md"
              stretch="auto"
              label="Discard"
              variant="secondary"
              disabled={busy}
              onClick={() => void discard()}
            />
          </div>
        </div>
      )}
      {capture.warning && (
        <p role="status" className="text-13 text-secondary">
          {capture.warning}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="text-13 text-danger-primary">
          {errorMessage}
        </p>
      )}
      <p className="text-12 text-tertiary">Webcam overlay, editing and AI transcripts are planned for a later phase.</p>
      {capture.blocker.state === "blocked" && (
        <div role="alert" className="space-y-2 rounded border border-subtle-1 p-3">
          <p>Your recording is not saved. Stay to save or download it before leaving.</p>
          <Button
            size="md"
            stretch="auto"
            variant="secondary"
            label="Stay here"
            onClick={() => capture.blocker.reset?.()}
          />
          <Button
            size="md"
            stretch="auto"
            variant="secondary"
            label="Leave and discard local recording"
            disabled={busy}
            onClick={() => capture.blocker.proceed?.()}
          />
        </div>
      )}
    </section>
  );
}

function CaptureControls({ capture }: { capture: ReturnType<typeof useRecorder> }) {
  const [mode, setMode] = useState<RecordingMode>("fullscreen");
  const [microphone, setMicrophone] = useState(true);
  const [systemAudio, setSystemAudio] = useState(false);
  const seconds = Math.floor(capture.durationMs / 1000);
  return (
    <>
      {capture.phase === "idle" && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-13">
            Capture preference{" "}
            <select
              aria-label="Capture preference"
              value={mode}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "fullscreen" || value === "window" || value === "tab") setMode(value);
              }}
              className="rounded border border-subtle-1 bg-surface-1 p-2"
            >
              <option value="fullscreen">Screen</option>
              <option value="window">Window</option>
              <option value="tab">Browser tab</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-13">
            <input type="checkbox" checked={microphone} onChange={(event) => setMicrophone(event.target.checked)} />
            Microphone
          </label>
          <label className="flex items-center gap-2 text-13">
            <input type="checkbox" checked={systemAudio} onChange={(event) => setSystemAudio(event.target.checked)} />
            System audio
          </label>
          <Button
            size="md"
            stretch="auto"
            variant="primary"
            label="Start recording"
            onClick={() => void capture.start(mode, microphone, systemAudio)}
          />
        </div>
      )}
      {capture.phase === "starting" && (
        <>
          <p role="status">Choose what to share in your browser...</p>
          <Button size="md" stretch="auto" label="Cancel" variant="secondary" onClick={capture.discard} />
        </>
      )}
      {["recording", "paused", "stopping"].includes(capture.phase) && (
        <div className="flex items-center gap-3">
          <span className="font-mono">
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")}
          </span>
          {capture.phase === "recording" && (
            <Button size="md" stretch="auto" variant="secondary" label="Pause" onClick={capture.pause} />
          )}
          {capture.phase === "paused" && (
            <Button size="md" stretch="auto" variant="secondary" label="Resume" onClick={capture.resume} />
          )}
          <Button
            size="md"
            stretch="auto"
            variant="primary"
            label={capture.phase === "stopping" ? "Stopping..." : "Stop recording"}
            disabled={capture.phase === "stopping"}
            onClick={capture.stop}
          />
        </div>
      )}
    </>
  );
}
