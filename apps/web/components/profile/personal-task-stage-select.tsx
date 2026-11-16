import type { TPersonalTask } from "@/services/personal-task.service";

const stages = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export function PersonalTaskStageSelect({
  id,
  className,
  value,
  disabled,
  onChange,
}: {
  id?: string;
  className: string;
  value: TPersonalTask["stage"];
  disabled: boolean;
  onChange: (value: TPersonalTask["stage"]) => void;
}) {
  return (
    <select
      id={id}
      aria-label="Stage"
      className={className}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const stage = stages.find((option) => option.value === event.target.value);
        if (stage) onChange(stage.value);
      }}
    >
      {stages.map((stage) => (
        <option key={stage.value} value={stage.value}>
          {stage.label}
        </option>
      ))}
    </select>
  );
}
