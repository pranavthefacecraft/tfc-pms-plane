import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { acquireStreams, buildCompositeStream, releaseStreams } from "./cap/stream-manager";
import type { ManagedStreams, RecordingMode } from "./cap/stream-manager";
import { getSupportedMimeType } from "./cap/mime-types";

type Phase = "idle" | "starting" | "recording" | "paused" | "stopping" | "recorded";
const MAX_SIZE = 500 * 1024 * 1024;
const MAX_DURATION = 60 * 60 * 1000;

export function useRecorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [session, setSession] = useState<{ recorder: MediaRecorder; streams: ManagedStreams } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const streams = useRef<ManagedStreams | null>(null);
  const startup = useRef<AbortController | null>(null);
  const listeners = useRef<AbortController | null>(null);
  const chunks = useRef<Blob[]>([]);
  const elapsed = useRef(0);
  const resumedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const blocker = useBlocker(phase !== "idle");
  const cleanup = useCallback(() => {
    listeners.current?.abort();
    listeners.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (streams.current) releaseStreams(streams.current);
    streams.current = null;
  }, []);
  const currentDuration = () => elapsed.current + (resumedAt.current === null ? 0 : Date.now() - resumedAt.current);
  const stop = useCallback(() => {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    elapsed.current += resumedAt.current === null ? 0 : Date.now() - resumedAt.current;
    resumedAt.current = null;
    setDurationMs(elapsed.current);
    setPhase("stopping");
    active.stop();
  }, []);
  const discard = useCallback(() => {
    startup.current?.abort();
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.stop();
    }
    recorder.current = null;
    cleanup();
    chunks.current = [];
    elapsed.current = 0;
    resumedAt.current = null;
    setBlob(null);
    setDurationMs(0);
    setPhase("idle");
    setSession(null);
    setError("");
    setWarning("");
  }, [cleanup]);
  const start = async (mode: RecordingMode, microphone: boolean, systemAudio: boolean) => {
    if (phase !== "idle") return;
    setError("");
    setWarning("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setError("Screen recording requires HTTPS (or localhost) and a supported desktop browser.");
      return;
    }
    const controller = new AbortController();
    startup.current = controller;
    setPhase("starting");
    let acquired: ManagedStreams | null = null;
    try {
      acquired = await acquireStreams(
        { mode, microphone: { enabled: microphone }, camera: { enabled: false }, systemAudio },
        controller.signal
      );
      controller.signal.throwIfAborted();
      streams.current = acquired;
      if (systemAudio && acquired.display?.getAudioTracks().length === 0)
        setWarning("System audio was not shared by your browser. This recording will not include it.");
      const composite = await buildCompositeStream(acquired);
      controller.signal.throwIfAborted();
      const mimeType = getSupportedMimeType();
      if (!mimeType) throw new Error("This browser has no supported recording format.");
      const active = new MediaRecorder(composite, { mimeType });
      recorder.current = active;
      setSession({ recorder: active, streams: acquired });
    } catch (cause) {
      if (acquired) releaseStreams(acquired);
      if (controller.signal.aborted) return;
      cleanup();
      console.error("Unable to start Cap-based recorder", cause);
      setError(cause instanceof Error ? cause.message : "Could not start recording.");
      setPhase("idle");
    }
  };
  const pause = () => {
    if (recorder.current?.state !== "recording") return;
    elapsed.current = currentDuration();
    resumedAt.current = null;
    recorder.current.pause();
    setPhase("paused");
  };
  const resume = () => {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    resumedAt.current = Date.now();
    setPhase("recording");
  };
  // eslint-disable-next-line react-doctor/effect-needs-cleanup -- Returned teardown removes every listener/timer; stop and unmount are regression-tested.
  useEffect(() => {
    if (!session) return;
    const active = session.recorder;
    const subscriptions = new AbortController();
    listeners.current = subscriptions;
    const options = { signal: subscriptions.signal };
    chunks.current = [];
    elapsed.current = 0;
    resumedAt.current = Date.now();
    let size = 0;
    const onDataAvailable = (event: BlobEvent) => {
      if (recorder.current !== active || event.data.size === 0) return;
      chunks.current.push(event.data);
      size += event.data.size;
      if (size > MAX_SIZE) {
        setError("Recording exceeded 500 MB. Download it locally; it cannot be saved to PMS.");
        stop();
      }
    };
    const onStop = () => {
      if (recorder.current !== active) return;
      cleanup();
      if (!mounted.current) return;
      setBlob(new Blob(chunks.current, { type: active.mimeType }));
      chunks.current = [];
      setPhase("recorded");
    };
    const onError = (event: Event) => {
      console.error("Cap-based recording failed", event);
      setError("Recording failed. Any captured content is available to download after stopping.");
      stop();
    };
    active.addEventListener("dataavailable", onDataAvailable, options);
    active.addEventListener("stop", onStop, options);
    active.addEventListener("error", onError, options);
    const displayTrack = session.streams.display?.getVideoTracks()[0];
    displayTrack?.addEventListener("ended", stop, { ...options, once: true });
    try {
      active.start(1000);
      setPhase("recording");
    } catch (cause) {
      console.error("Could not start MediaRecorder", cause);
      setError(cause instanceof Error ? cause.message : "Could not start recording.");
      cleanup();
      setPhase("idle");
      setSession(null);
    }
    const interval = setInterval(() => {
      const duration = currentDuration();
      setDurationMs(duration);
      if (duration >= MAX_DURATION) stop();
    }, 250);
    timer.current = interval;
    return () => {
      active.removeEventListener("dataavailable", onDataAvailable);
      active.removeEventListener("stop", onStop);
      active.removeEventListener("error", onError);
      displayTrack?.removeEventListener("ended", stop);
      clearInterval(interval);
      if (active.state !== "inactive") active.stop();
      cleanup();
    };
  }, [session, cleanup, stop]);
  useEffect(() => {
    if (phase === "idle") return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [phase]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      startup.current?.abort();
      if (recorder.current && recorder.current.state !== "inactive") {
        const active = recorder.current;
        recorder.current = null;
        active.stop();
      }
      cleanup();
    };
  }, [cleanup]);
  return { phase, blob, durationMs, error, warning, start, stop, pause, resume, discard, blocker };
}
