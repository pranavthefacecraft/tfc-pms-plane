import { useState } from "react";
import { observer } from "mobx-react";
import { useSWRConfig } from "swr";
import { AddOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
import { personalTasksKey } from "@/services/personal-task.service";
import type { TPersonalTask } from "@/services/personal-task.service";
import { PersonalTaskDialog } from "./personal-task-dialog";

export const ProfileCreateTaskButton = observer(function ProfileCreateTaskButton({
  workspaceSlug,
  userId,
}: {
  workspaceSlug: string;
  userId: string;
}) {
  const [personalTaskOpen, setPersonalTaskOpen] = useState(false);
  const [projectTaskData, setProjectTaskData] = useState<Partial<TIssue> | null>(null);
  const { mutate } = useSWRConfig();
  const { joinedProjectIds } = useProject();
  const { t } = useTranslation();
  return (
    <>
      <Button
        variant="primary"
        size="md"
        stretch="auto"
        label={t("add_work_item")}
        icon={<AddOutline className="size-4" />}
        onClick={() => setPersonalTaskOpen(true)}
      />
      {personalTaskOpen && (
        <PersonalTaskDialog
          workspaceSlug={workspaceSlug}
          onClose={() => setPersonalTaskOpen(false)}
          onSaved={(task) => {
            void mutate(
              personalTasksKey(workspaceSlug, userId),
              (existing: TPersonalTask[] | undefined) => [task, ...(existing ?? [])],
              { revalidate: false }
            );
          }}
          canCreateProjectTask={joinedProjectIds.length > 0}
          onProjectTask={(draft) => {
            const content = document.createElement("div");
            content.textContent = draft.description;
            setProjectTaskData({
              name: draft.name,
              priority: draft.priority,
              start_date: draft.start_date,
              target_date: draft.target_date,
              description_html: `<p>${content.innerHTML.replaceAll("\n", "<br>")}</p>`,
              assignee_ids: [userId],
            });
            setPersonalTaskOpen(false);
          }}
        />
      )}
      {projectTaskData && (
        <CreateUpdateIssueModal isOpen data={projectTaskData} onClose={() => setProjectTaskData(null)} />
      )}
    </>
  );
});
