import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { observer } from "mobx-react";
import { setToast } from "@plane/blocks/toast";
import { useProjectState } from "@/hooks/store/use-project-state";

export const TaskCompletion = observer(function TaskCompletion({
  projectId,
  stateId,
  disabled,
  onChange,
}: {
  projectId: string;
  stateId: string;
  disabled: boolean;
  onChange: (stateId: string) => Promise<void>;
}) {
  const { getProjectStates } = useProjectState();
  const [saving, setSaving] = useState(false);
  const states = getProjectStates(projectId);
  const current = states?.find((state) => state.id === stateId);
  const done = current?.group === "completed";
  const next = done
    ? states?.find((state) => state.default && state.group !== "completed")
    : states?.find((state) => state.group === "completed");
  const change = async () => {
    if (!next || disabled || saving || !current) return;
    setSaving(true);
    try {
      await onChange(next.id);
    } catch (error) {
      setToast({
        type: "error",
        title: "Could not update task",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded px-1 py-1 text-[14px] leading-5 font-medium text-[#135DDD] hover:bg-[#EAF2FF] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || saving || !current || !next}
      onClick={() => void change()}
    >
      {done ? <Check aria-hidden="true" className="size-4" /> : <Circle aria-hidden="true" className="size-4" />}
      {done ? "Mark as Incomplete" : "Mark as Complete"}
    </button>
  );
});
