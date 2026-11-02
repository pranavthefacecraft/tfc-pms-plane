import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR, { useSWRConfig } from "swr";
import { CalendarDays, Check, Filter, KanbanSquare, List, Search } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { setToast } from "@plane/blocks/toast";
import { renderFormattedDate } from "@plane/utils";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useMember } from "@/hooks/store/use-member";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useCurrentTime } from "@/hooks/use-current-time";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { PageHead } from "@/components/core/page-title";
import { zonedDateKey } from "@/components/home/activity-overview.helpers";
import { IssueService } from "@/services/issue/issue.service";
import { MyTasksService } from "@/services/workspace-my-tasks.service";
import { ProjectSectionService } from "@/services/project/project-section.service";
import { personalTaskError, personalTaskService, personalTasksKey } from "@/services/personal-task.service";
import type { TPersonalTask } from "@/services/personal-task.service";
import { ProfileCreateTaskButton } from "./create-task-button";
import { PersonalTaskDialog } from "./personal-task-dialog";
import { MyTasksBoard } from "./my-tasks-board";
import { MyTasksCalendar } from "./my-tasks-calendar";
import { boardColumnLabel, projectMovePatch } from "./my-tasks-board.helpers";
import type { TBoardColumn, TaskRow } from "./my-tasks-board.helpers";

const taskService = new MyTasksService();
const issueService = new IssueService();
const sectionService = new ProjectSectionService();

function Collaborators({ ids }: { ids: string[] }) {
  const { getUserDetails } = useMember();
  return (
    <div className="flex items-center -space-x-1">
      {ids.slice(0, 3).map((id) => {
        const person = getUserDetails(id);
        const name =
          person?.display_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Team member";
        return (
          <span
            key={id}
            title={name}
            aria-label={name}
            className="grid size-6 place-items-center rounded-full border-2 border-white bg-[#1764E8] text-10 font-medium text-white"
          >
            {name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
        );
      })}
      {ids.length > 3 && <span className="pl-2 text-11 text-secondary">+{ids.length - 3}</span>}
    </div>
  );
}

function taskRowDetails(row: TaskRow, today: string, userId?: string) {
  return {
    collaborators: row.project?.assignee_ids ?? (userId ? [userId] : []),
    stateName: row.project?.state_name ?? (row.completed ? "Completed" : "Not completed"),
    stateColor: row.project?.state_color ?? (row.completed ? "#009E79" : "#94A3B8"),
    dueLabel: row.due === today ? "Today" : row.due ? renderFormattedDate(row.due) : "No due date",
  };
}

function MyTaskRow({
  row,
  today,
  userId,
  busy,
  onToggle,
  onOpen,
}: {
  row: TaskRow;
  today: string;
  userId?: string;
  busy: boolean;
  onToggle: (row: TaskRow) => Promise<void>;
  onOpen: (row: TaskRow) => void;
}) {
  const { collaborators, stateName, stateColor, dueLabel } = taskRowDetails(row, today, userId);
  return (
    <tr className="border-b border-subtle hover:bg-layer-transparent-hover">
      <td className="max-w-[450px] px-2 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${row.completed ? "Reopen" : "Complete"} ${row.name}`}
            disabled={busy}
            onClick={() => void onToggle(row)}
            className={`grid size-4 shrink-0 place-items-center rounded-full border disabled:opacity-50 ${row.completed ? "border-[#009E79] bg-[#009E79] text-white" : "border-[#A8B5C9]"}`}
          >
            {row.completed && <Check className="size-3" />}
          </button>
          <button
            type="button"
            onClick={() => onOpen(row)}
            className={`truncate text-left hover:underline ${row.completed ? "text-secondary" : ""}`}
          >
            {row.name}
          </button>
        </div>
      </td>
      <td className={`px-2 py-3 text-12 whitespace-nowrap ${row.due === today ? "text-[#009E79]" : "text-secondary"}`}>
        {dueLabel}
      </td>
      <td className="px-2 py-3">
        <Collaborators ids={collaborators} />
      </td>
      <td className="px-2 py-3">
        <span className="inline-flex items-center gap-1.5 rounded bg-layer-1 px-2 py-1 text-11">
          <span className={`size-2 rounded-sm ${row.personal ? "bg-[#C4ADF2]" : "bg-[#009E79]"}`} />
          {row.project?.project_name ?? "Personal task"}
        </span>
      </td>
      <td className="px-2 py-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-layer-1 px-2 py-1 text-11">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: stateColor }} />
          {stateName}
        </span>
      </td>
    </tr>
  );
}

function useMyTasks(workspaceSlug: string) {
  const { data: user } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { currentTime } = useCurrentTime();
  const { peekIssue, setPeekIssue } = useIssueDetail();
  const { mutate: globalMutate } = useSWRConfig();
  const canEditPersonal = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const personal = useSWR(user && canEditPersonal ? personalTasksKey(workspaceSlug, user.id) : null, () =>
    personalTaskService.list(workspaceSlug)
  );
  const assigned = useSWR(user ? ["my-tasks-list", workspaceSlug, user.id] : null, () =>
    taskService.all(workspaceSlug)
  );
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("all");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<TPersonalTask | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const { mutate: refreshAssigned } = assigned;
  const wasPeekOpen = useRef(false);
  useEffect(() => {
    if (peekIssue) wasPeekOpen.current = true;
    else if (wasPeekOpen.current) {
      wasPeekOpen.current = false;
      void refreshAssigned();
    }
  }, [peekIssue, refreshAssigned]);
  const rows: TaskRow[] = [
    ...(personal.data ?? []).map((task) => ({
      key: `personal-${task.id}`,
      name: task.name,
      due: task.target_date,
      completed: Boolean(task.completed_at),
      personal: task,
    })),
    ...(assigned.data ?? []).map((task) => ({
      key: `project-${task.id}`,
      name: task.name,
      due: task.target_date,
      completed: task.state_group === "completed",
      project: task,
    })),
  ];
  const projects = Array.from(
    new Map((assigned.data ?? []).map((task) => [task.project_id, task.project_name])).entries()
  );
  const visible = rows.filter(
    (row) =>
      row.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (account === "all" || (account === "personal" ? Boolean(row.personal) : Boolean(row.project))) &&
      (!projectId || row.project?.project_id === projectId) &&
      (status === "all" || (status === "completed" ? row.completed : !row.completed))
  );
  const failed = Boolean(personal.error || assigned.error);
  const loading = !user || assigned.isLoading || (canEditPersonal && personal.isLoading);
  const today = zonedDateKey(currentTime, user?.user_timezone);
  const filtered = Boolean(query || account !== "all" || projectId || status !== "all");
  const reset = () => {
    setQuery("");
    setAccount("all");
    setProjectId("");
    setStatus("all");
  };
  const refresh = async () => {
    await globalMutate((key) =>
      Array.isArray(key)
        ? ["personal-tasks", "my-tasks-list", "activity-schedule"].includes(String(key[0])) && key[1] === workspaceSlug
        : typeof key === "string" &&
          (key.startsWith(`HOME_MY_TASKS_${workspaceSlug}_`) ||
            key.startsWith(`CURRENT_WORKSPACE_PROFILE_ISSUES_${workspaceSlug}_`))
    );
  };
  const runUpdate = async (row: TaskRow, success: string, update: () => Promise<void>) => {
    setBusy((previous) => new Set(previous).add(row.key));
    try {
      await update();
      await refresh();
      setToast({ type: "success", title: success });
    } catch (error) {
      setToast({
        type: "error",
        title: "Could not update task",
        message: error instanceof Error ? error.message : personalTaskError(error, "Please try again."),
      });
    } finally {
      setBusy((previous) => {
        const next = new Set(previous);
        next.delete(row.key);
        return next;
      });
    }
  };
  const toggle = (row: TaskRow) =>
    runUpdate(row, row.completed ? "Task reopened" : "Task completed", async () => {
      if (row.personal)
        await personalTaskService.update(workspaceSlug, row.personal.id, { is_completed: !row.completed });
      else {
        const stateId = row.completed ? row.project.default_state_id : row.project.completed_state_id;
        if (!stateId) throw new Error(`This project has no ${row.completed ? "default" : "completed"} state.`);
        await issueService.patchIssue(workspaceSlug, row.project.project_id, row.project.id, { state_id: stateId });
      }
    });
  const move = (row: TaskRow, column: TBoardColumn) =>
    runUpdate(row, `Moved to ${boardColumnLabel(column)}`, async () => {
      if (row.personal) {
        if (column !== "todo" && column !== "done")
          throw new Error("Personal tasks can only move between To Do and Done.");
        await personalTaskService.update(workspaceSlug, row.personal.id, { is_completed: column === "done" });
        return;
      }
      const { project_id: id } = row.project;
      const sections = await sectionService.list(workspaceSlug, id);
      await issueService.patchIssue(workspaceSlug, id, row.project.id, projectMovePatch(row, column, sections));
    });
  const open = (row: TaskRow) => {
    if (row.personal) setEditing(row.personal);
    else setPeekIssue({ workspaceSlug, projectId: row.project.project_id, issueId: row.project.id });
  };
  return {
    user,
    canEditPersonal,
    personal,
    assigned,
    query,
    setQuery,
    account,
    setAccount,
    projectId,
    setProjectId,
    status,
    setStatus,
    editing,
    setEditing,
    busy,
    projects,
    visible,
    failed,
    loading,
    today,
    filtered,
    reset,
    refresh,
    toggle,
    move,
    open,
  };
}

function TaskFilters({
  filtered,
  account,
  setAccount,
  projectId,
  setProjectId,
  projects,
  status,
  setStatus,
  reset,
}: {
  filtered: boolean;
  account: string;
  setAccount: (value: string) => void;
  projectId: string;
  setProjectId: (value: string) => void;
  projects: [string, string][];
  status: string;
  setStatus: (value: string) => void;
  reset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className="flex items-center gap-2 rounded border border-subtle px-3 py-1.5 text-12" />
        }
      >
        <Filter className="size-3.5" />
        {filtered ? "Filter (active)" : "Filter"}
      </PopoverTrigger>
      <PopoverContent variant="text" align="end" sideOffset={8} aria-label="Filter My Tasks">
        <div className="flex flex-col gap-3 text-13">
          <label>
            Account
            <select
              aria-label="Account"
              className="mt-1 w-full rounded border border-subtle bg-surface-1 p-2"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            >
              <option value="all">All accounts</option>
              <option value="personal">Personal</option>
              <option value="company">Company</option>
            </select>
          </label>
          <label>
            Project
            <select
              aria-label="Project"
              className="mt-1 w-full rounded border border-subtle bg-surface-1 p-2"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">All projects</option>
              {projects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              className="mt-1 w-full rounded border border-subtle bg-surface-1 p-2"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="open">Not completed</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <button type="button" className="text-[#135DDD] underline" onClick={reset}>
            Reset filters
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BoardView({
  workspaceSlug,
  userId,
  rows,
  filtered,
  reset,
  today,
  busy,
  onOpen,
  onMove,
}: {
  workspaceSlug: string;
  userId?: string;
  rows: TaskRow[];
  filtered: boolean;
  reset: () => void;
  today: string;
  busy: Set<string>;
  onOpen: (row: TaskRow) => void;
  onMove: (row: TaskRow, column: TBoardColumn) => Promise<void>;
}) {
  return (
    <>
      {filtered && !rows.length && (
        <p className="mb-3 text-13 text-secondary">
          No matching tasks.
          <button type="button" className="ml-2 text-[#135DDD] underline" onClick={reset}>
            Clear filters
          </button>
        </p>
      )}
      <MyTasksBoard
        rows={rows}
        today={today}
        busy={busy}
        onOpen={onOpen}
        onMove={onMove}
        renderAddTask={
          userId
            ? (column) => (
                <ProfileCreateTaskButton
                  workspaceSlug={workspaceSlug}
                  userId={userId}
                  label="Add task"
                  appearance="inline"
                  ariaLabel={`Add task to ${boardColumnLabel(column)}`}
                />
              )
            : undefined
        }
      />
    </>
  );
}
function ListView({
  rows,
  filtered,
  reset,
  today,
  userId,
  busy,
  onToggle,
  onOpen,
}: {
  rows: TaskRow[];
  filtered: boolean;
  reset: () => void;
  today: string;
  userId?: string;
  busy: Set<string>;
  onToggle: (row: TaskRow) => Promise<void>;
  onOpen: (row: TaskRow) => void;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-13">
        <thead className="border-y border-subtle text-10 text-secondary uppercase">
          <tr>
            {["Name", "Due date", "Collaborators", "Projects", "Status"].map((label) => (
              <th key={label} className="px-2 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <MyTaskRow
              key={row.key}
              row={row}
              today={today}
              userId={userId}
              busy={busy.has(row.key)}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="py-10 text-center text-13 text-secondary">
          {filtered ? "No matching tasks." : "No tasks yet."}
          {filtered && (
            <button type="button" className="ml-2 text-[#135DDD] underline" onClick={reset}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const VIEW_TABS = [
  { id: "list", label: "List", Icon: List },
  { id: "board", label: "Board", Icon: KanbanSquare },
  { id: "calendar", label: "Task Calendar", Icon: CalendarDays },
] as const;
type TLayout = (typeof VIEW_TABS)[number]["id"];

function ViewTabs({ layout, onChange }: { layout: TLayout; onChange: (layout: TLayout) => void }) {
  return (
    <div className="mb-5 flex border-b border-subtle" role="tablist" aria-label="My Tasks views">
      {VIEW_TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={layout === id}
          onClick={() => onChange(id)}
          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-13 ${layout === id ? "border-[#135DDD] text-[#135DDD]" : "border-transparent text-secondary hover:text-primary"}`}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function TaskLoadState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return failed ? (
    <div role="alert" className="py-8 text-13">
      Could not load your tasks.{" "}
      <button type="button" className="text-[#135DDD] underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  ) : (
    <p role="status" className="py-8 text-13 text-secondary">
      Loading tasks...
    </p>
  );
}

function TaskViews({
  layout,
  canEditPersonal,
  userId,
  ...props
}: {
  layout: TLayout;
  workspaceSlug: string;
  userId?: string;
  canEditPersonal: boolean;
  rows: TaskRow[];
  filtered: boolean;
  reset: () => void;
  today: string;
  busy: Set<string>;
  onOpen: (row: TaskRow) => void;
  onMove: (row: TaskRow, column: TBoardColumn) => Promise<void>;
  onToggle: (row: TaskRow) => Promise<void>;
}) {
  if (layout === "calendar") return <MyTasksCalendar rows={props.rows} today={props.today} onOpen={props.onOpen} />;
  if (layout === "board") return <BoardView {...props} userId={canEditPersonal ? userId : undefined} />;
  return <ListView {...props} userId={userId} />;
}
export const MyTasksPage = observer(function MyTasksPage({ workspaceSlug }: { workspaceSlug: string }) {
  const {
    user,
    canEditPersonal,
    personal,
    assigned,
    query,
    setQuery,
    account,
    setAccount,
    projectId,
    setProjectId,
    status,
    setStatus,
    editing,
    setEditing,
    busy,
    projects,
    visible,
    failed,
    loading,
    today,
    filtered,
    reset,
    refresh,
    toggle,
    move,
    open,
  } = useMyTasks(workspaceSlug);
  const [layout, setLayout] = useState<TLayout>("list");
  return (
    <main className="h-full overflow-y-auto bg-surface-1 px-5 py-6 md:px-8" aria-label="My Tasks">
      <PageHead title="My Tasks" />
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-5 flex items-center gap-3">
          <span
            className="grid size-8 place-items-center rounded-full bg-[#E8DFFD] text-12 text-[#7955BE]"
            aria-hidden="true"
          >
            {(user?.display_name || user?.first_name || "My").slice(0, 2).toUpperCase()}
          </span>
          <h1 className="text-24 font-semibold">My Tasks</h1>
        </header>
        <ViewTabs layout={layout} onChange={setLayout} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {user && canEditPersonal ? (
            <ProfileCreateTaskButton
              workspaceSlug={workspaceSlug}
              userId={user.id}
              label="Add task"
              className="rounded-full! bg-[#135DDD]!"
            />
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <TaskFilters
              filtered={filtered}
              account={account}
              setAccount={setAccount}
              projectId={projectId}
              setProjectId={setProjectId}
              projects={projects}
              status={status}
              setStatus={setStatus}
              reset={reset}
            />
            <label className="flex items-center gap-2 rounded border border-subtle px-2 py-1.5">
              <Search className="size-3.5" />
              <input
                aria-label="Search tasks"
                placeholder="Search tasks..."
                className="w-36 bg-transparent text-12 outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>
        {layout === "list" && <h2 className="mb-3 text-16 font-semibold">Recently Assigned</h2>}
        {failed || loading ? (
          <TaskLoadState
            failed={failed}
            onRetry={() => {
              void assigned.mutate();
              void personal.mutate();
            }}
          />
        ) : (
          <TaskViews
            layout={layout}
            workspaceSlug={workspaceSlug}
            userId={user?.id}
            canEditPersonal={canEditPersonal}
            rows={visible}
            filtered={filtered}
            reset={reset}
            today={today}
            busy={busy}
            onOpen={open}
            onMove={move}
            onToggle={toggle}
          />
        )}
      </div>
      <IssuePeekOverview />
      {editing && (
        <PersonalTaskDialog
          workspaceSlug={workspaceSlug}
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </main>
  );
});
