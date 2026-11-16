import { CalendarDays } from "lucide-react";
import { DateSelect } from "@plane/blocks/property-select";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
import { useUserProfile } from "@/hooks/store/user";

export function TaskDateField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  min?: string | null;
  max?: string | null;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const { data: profile } = useUserProfile();
  return (
    <div role="group" aria-label={label} className="w-fit max-w-full">
      <DateSelect
        variant="select-ghost-md"
        value={getDate(value) ?? null}
        minDate={getDate(min) ?? undefined}
        maxDate={getDate(max) ?? undefined}
        onChange={(date) => onChange(date ? (renderFormattedPayloadDate(date) ?? null) : null)}
        disabled={disabled}
        icon={<CalendarDays />}
        placeholder="Choose date"
        formatToken="dd MMM yyyy"
        weekStartsOn={profile?.start_of_the_week}
        clearable
        clearLabel={`Clear ${label.toLowerCase()}`}
        className="gap-2 px-0"
      />
    </div>
  );
}
