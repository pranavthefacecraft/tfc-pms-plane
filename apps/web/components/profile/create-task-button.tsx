import { useState } from "react";
import { observer } from "mobx-react";
import { useSWRConfig } from "swr";
import { AddOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { personalTasksKey } from "@/services/personal-task.service";
import type { TPersonalTask } from "@/services/personal-task.service";
import { NewTaskPanel } from "./new-task-panel";

export const ProfileCreateTaskButton = observer(function ProfileCreateTaskButton({
  workspaceSlug,
  userId,
  label,
  className,
  variant = "primary",
  ariaLabel,
}: {
  workspaceSlug: string;
  userId: string;
  label?: string;
  className?: string;
  variant?: "primary" | "ghost";
  ariaLabel?: string;
}) {
  const [personalTaskOpen, setPersonalTaskOpen] = useState(false);
  const { mutate } = useSWRConfig();
  const { t } = useTranslation();
  const refreshTasks = () =>
    void mutate(
      (key) =>
        (Array.isArray(key) &&
          ["activity-schedule", "my-tasks-list"].includes(String(key[0])) &&
          key[1] === workspaceSlug) ||
        (typeof key === "string" &&
          (key.startsWith(`HOME_MY_TASKS_${workspaceSlug}_`) ||
            key.startsWith(`CURRENT_WORKSPACE_PROFILE_ISSUES_${workspaceSlug}_`)))
    );
  return (
    <>
      <Button
        variant={variant}
        size="md"
        stretch="auto"
        label={label ?? t("add_work_item")}
        aria-label={ariaLabel}
        render={className ? <button className={className} /> : undefined}
        icon={<AddOutline className="size-4" />}
        onClick={() => setPersonalTaskOpen(true)}
      />
      {personalTaskOpen && (
        <NewTaskPanel
          workspaceSlug={workspaceSlug}
          onClose={() => setPersonalTaskOpen(false)}
          onSaved={(task) => {
            if (task)
              void mutate(
                personalTasksKey(workspaceSlug, userId),
                (existing: TPersonalTask[] | undefined) => [task, ...(existing ?? [])],
                { revalidate: false }
              );
            refreshTasks();
          }}
        />
      )}
    </>
  );
});
