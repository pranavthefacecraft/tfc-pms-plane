import { createContext, useContext, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useRecorder } from "./use-recorder";

type RecorderSession = ReturnType<typeof useRecorder>;
const RecorderContext = createContext<RecorderSession | null>(null);

export function RecorderProvider({ workspaceSlug, children }: { workspaceSlug: string; children: ReactNode }) {
  const recorder = useRecorder();

  return (
    <RecorderContext.Provider value={recorder}>
      {children}
      <RecorderFloatingControls workspaceSlug={workspaceSlug} recorder={recorder} />
    </RecorderContext.Provider>
  );
}

export function useRecorderSession() {
  const recorder = useContext(RecorderContext);
  if (!recorder) throw new Error("useRecorderSession must be used within RecorderProvider.");
  return recorder;
}

function RecorderFloatingControls({ workspaceSlug, recorder }: { workspaceSlug: string; recorder: RecorderSession }) {
  const { pathname } = useLocation();
  if (pathname.startsWith(`/${workspaceSlug}/tool/recorder`) || recorder.phase === "idle") return null;

  const active = recorder.phase === "recording" || recorder.phase === "paused";
  const seconds = Math.floor(recorder.durationMs / 1000);
  const destination = `/${workspaceSlug}/tool/recorder/`;

  return (
    <aside
      aria-label="Screen recording controls"
      className="shadow-lg fixed right-4 bottom-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-3 rounded-lg border border-subtle-1 bg-surface-1 p-3"
    >
      <p role="status" className="text-13">
        {recorder.phase === "starting" && "Starting recording..."}
        {recorder.phase === "recording" &&
          `Recording ${Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`}
        {recorder.phase === "paused" && "Recording paused"}
        {recorder.phase === "stopping" && "Finishing recording..."}
        {recorder.phase === "recorded" && "Recording ready to save"}
      </p>
      {active && recorder.phase === "recording" && (
        <button type="button" className="text-13 text-accent-primary underline" onClick={recorder.pause}>
          Pause
        </button>
      )}
      {active && recorder.phase === "paused" && (
        <button type="button" className="text-13 text-accent-primary underline" onClick={recorder.resume}>
          Resume
        </button>
      )}
      {active && (
        <button type="button" className="text-13 text-accent-primary underline" onClick={recorder.stop}>
          Stop
        </button>
      )}
      <Link className="text-13 text-accent-primary underline" to={destination}>
        {recorder.phase === "recorded" ? "Return to save" : "Open recorder"}
      </Link>
    </aside>
  );
}
