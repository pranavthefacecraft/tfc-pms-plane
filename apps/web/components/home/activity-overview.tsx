import { useEffect, useRef, useState } from "react";
import { addDays, addMonths, parseISO } from "date-fns";
import { observer } from "mobx-react";
import useSWR, { useSWRConfig } from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { IUser } from "@plane/types";
import { ProfileCreateTaskButton } from "@/components/profile/create-task-button";
import { PersonalTaskDialog } from "@/components/profile/personal-task-dialog";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useCurrentTime } from "@/hooks/use-current-time";
import type { TPersonalTask } from "@/services/personal-task.service";
import { personalTaskService, personalTasksKey } from "@/services/personal-task.service";
import { MyTasksService } from "@/services/workspace-my-tasks.service";
import type { TCalendarView, TOverviewTask } from "./activity-overview.helpers";
import { calendarDays, dateKey, overviewTasks, taskActiveToday, zonedDateKey } from "./activity-overview.helpers";
import { ActivityCalendar, TodayActivity } from "./activity-sections";
import { ActivityTaskActionDialog } from "./activity-task-action-dialog";

const taskService = new MyTasksService();
function useActivityTasks(workspaceSlug: string, user: IUser, canCreate: boolean, days: Date[], today: string) {
  const start = dateKey(days[0]);
  const end = dateKey(days[days.length - 1]);
  const personal = useSWR(canCreate ? personalTasksKey(workspaceSlug, user.id) : null, () =>
    personalTaskService.list(workspaceSlug)
  );
  const schedule = useSWR(["activity-schedule", workspaceSlug, user.id, start, end], () =>
    taskService.schedule(workspaceSlug, start, end)
  );
  const activity = useSWR(["activity-schedule", workspaceSlug, user.id, today, today], () =>
    taskService.schedule(workspaceSlug, today, today)
  );
  const personalTasks = canCreate ? (personal.data ?? []) : [];
  const personalPending = canCreate && !personal.data && !personal.error;
  const personalError = canCreate && Boolean(personal.error);
  return {
    personal,
    schedule,
    activity,
    calendarTasks: overviewTasks(personalTasks, schedule.data?.results ?? [], user.user_timezone),
    todayTasks: overviewTasks(personalTasks, activity.data?.results ?? [], user.user_timezone).filter((task) =>
      taskActiveToday(task, today, user.user_timezone)
    ),
    activityLoading: personalPending || !activity.data,
    scheduleLoading: personalPending || !schedule.data,
    activityError: personalError || Boolean(activity.error),
    scheduleError: personalError || Boolean(schedule.error),
  };
}

const ActivityOverviewContent = observer(function ActivityOverviewContent({
  workspaceSlug,
  user,
}: {
  workspaceSlug: string;
  user: IUser;
}) {
  const { allowPermissions } = useUserPermissions();
  const { mutate } = useSWRConfig();
  const { getUserDetails } = useMember();
  const { currentTime } = useCurrentTime();
  const { peekIssue, setPeekIssue } = useIssueDetail();
  const today = zonedDateKey(currentTime, user.user_timezone);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [view, setView] = useState<TCalendarView>("week");
  const [editing, setEditing] = useState<TPersonalTask | null>(null);
  const [taskAction, setTaskAction] = useState<{ task: TOverviewTask; action: "share" | "delete" } | null>(null);
  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const calendarAnchor = anchor ?? parseISO(today);
  const days = calendarDays(calendarAnchor, view);
  const data = useActivityTasks(workspaceSlug, user, canCreate, days, today);
  const { personal, schedule, activity } = data;
  const { mutate: refreshSchedule } = schedule;
  const { mutate: refreshActivity } = activity;
  const wasPeekOpen = useRef(false);
  useEffect(() => {
    if (peekIssue) wasPeekOpen.current = true;
    else if (wasPeekOpen.current) {
      wasPeekOpen.current = false;
      void refreshSchedule();
      void refreshActivity();
    }
  }, [peekIssue, refreshSchedule, refreshActivity]);

  const openTask = (task: TOverviewTask) => {
    if (task.personal) setEditing(task.personal);
    else setPeekIssue({ workspaceSlug, projectId: task.project.project_id, issueId: task.project.id });
  };

  return (
    <section aria-label="Overview" className="mt-6 flex w-full flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-24 font-semibold">Overview</h1>
        {canCreate && (
          <ProfileCreateTaskButton
            workspaceSlug={workspaceSlug}
            userId={user.id}
            label="Add task"
            className="rounded-full! bg-[#135DDD]!"
          />
        )}
      </div>
      <TodayActivity
        tasks={data.todayTasks}
        onShareTask={(task) => setTaskAction({ task, action: "share" })}
        onDeleteTask={(task) => setTaskAction({ task, action: "delete" })}
        canDeleteTask={(task) =>
          Boolean(
            task.personal ||
            task.project.created_by === user.id ||
            allowPermissions(
              [EUserPermissions.ADMIN],
              EUserPermissionsLevel.PROJECT,
              workspaceSlug,
              task.project.project_id
            )
          )
        }
        assignees={Object.fromEntries(
          data.todayTasks.map((task) => [
            task.key,
            (task.personal ? [user.id] : task.project.assignee_ids).map((id) => {
              const person = id === user.id ? user : getUserDetails(id);
              return {
                id,
                name: person?.display_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim(),
              };
            }),
          ])
        )}
        loading={data.activityLoading}
        error={data.activityError}
        onOpenTask={openTask}
        onRetry={() => {
          void activity.mutate();
          void personal.mutate();
        }}
      />
      <ActivityCalendar
        days={days}
        anchor={calendarAnchor}
        view={view}
        today={today}
        tasks={data.calendarTasks}
        loading={data.scheduleLoading}
        error={data.scheduleError}
        onOpenTask={openTask}
        createAction={
          canCreate ? (
            <ProfileCreateTaskButton
              workspaceSlug={workspaceSlug}
              userId={user.id}
              label="New task"
              className="rounded-full! bg-[#135DDD]!"
            />
          ) : undefined
        }
        onRetry={() => {
          void schedule.mutate();
          void personal.mutate();
        }}
        onNavigate={(direction) =>
          setAnchor(
            view === "month"
              ? addMonths(calendarAnchor, direction)
              : addDays(days[0], direction * (view === "week" ? 7 : 1))
          )
        }
        onToday={() => {
          setAnchor(null);
          setView("day");
        }}
        onViewChange={setView}
      />
      {editing && (
        <PersonalTaskDialog
          key={editing.id}
          workspaceSlug={workspaceSlug}
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            void personal.mutate((tasks) => tasks?.map((task) => (task.id === saved.id ? saved : task)));
          }}
        />
      )}
      {taskAction && (
        <ActivityTaskActionDialog
          key={`${taskAction.action}-${taskAction.task.key}`}
          task={taskAction.task}
          action={taskAction.action}
          workspaceSlug={workspaceSlug}
          onClose={() => setTaskAction(null)}
          onDeleted={() => {
            void personal.mutate();
            void schedule.mutate();
            void activity.mutate();
            void mutate(
              (key) =>
                typeof key === "string" &&
                (key.startsWith(`HOME_MY_TASKS_${workspaceSlug}_`) ||
                  key.startsWith(`CURRENT_WORKSPACE_PROFILE_ISSUES_${workspaceSlug}_`))
            );
          }}
        />
      )}
    </section>
  );
});

export const ActivityOverview = observer(function ActivityOverview({ workspaceSlug }: { workspaceSlug: string }) {
  const { data: user } = useUser();
  return user ? <ActivityOverviewContent key={user.id} workspaceSlug={workspaceSlug} user={user} /> : null;
});
