/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel, PROJECT_DETAILS } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { Avatar } from "@makeplane/propel/components/avatar";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { Field } from "@makeplane/propel/components/field";
import { setToast } from "@plane/blocks/toast";
import type { IProject } from "@plane/types";
import { getFileURL, renderFormattedDate } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { ProjectOverviewResources } from "./overview-resources";
import { ProjectPageHeader } from "./project-page-header";
import { initials } from "./projects-browse.helpers";

const HEALTH_OPTIONS = [
  { value: "", label: "Not set", color: "#9ca3af" },
  { value: "on_track", label: "On track", color: "#22c55e" },
  { value: "at_risk", label: "At risk", color: "#f59e0b" },
  { value: "off_track", label: "Off track", color: "#ef4444" },
] as const;
const cardClass = "rounded-xl border border-subtle bg-surface-1 p-6";
const figmaCardClass = "rounded-lg border border-subtle bg-surface-1 p-5";
const AVATAR_TINTS = ["bg-[#EAF1FD] text-[#135DDD]", "bg-[#E8F0FE] text-[#1D4ED8]", "bg-[#FDECF3] text-[#C0266D]"];
const selectClass = "w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13";

type SectionProps = {
  project: IProject;
  canEdit: boolean;
  saving: boolean;
  save: (payload: Partial<IProject>) => Promise<boolean>;
};

function OverviewDescription({ project, canEdit, saving, save }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  return (
    <section className={figmaCardClass} aria-labelledby="overview-description">
      <h2 id="overview-description" className="mb-3 text-15 font-semibold text-primary">
        Project Description
      </h2>
      {editing && canEdit ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await save({ description })) setEditing(false);
          }}
        >
          <Field name="overview-description" disabled={saving}>
            <TextAreaGroup>
              <TextArea
                size="lg"
                surface="field"
                aria-label="Project description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={8}
                disabled={saving}
              />
            </TextAreaGroup>
          </Field>
          <div className="mt-3 flex gap-2">
            <Button
              label="Save description"
              variant="primary"
              size="sm"
              stretch="auto"
              type="submit"
              disabled={saving}
            />
            <Button
              label="Cancel"
              size="sm"
              stretch="auto"
              variant="secondary"
              disabled={saving}
              onClick={() => setEditing(false)}
            />
          </div>
        </form>
      ) : (
        <>
          <p className="text-13 leading-6 break-words whitespace-pre-wrap text-secondary">
            {project.description || "Describe the goals, scope, and expectations for this project."}
          </p>
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              className="mt-3 text-12 font-medium text-[#135DDD] hover:underline disabled:opacity-60"
              onClick={() => {
                setDescription(project.description ?? "");
                setEditing(true);
              }}
            >
              Edit description
            </button>
          )}
        </>
      )}
    </section>
  );
}

const OverviewPeople = observer(function OverviewPeople({
  project,
  workspaceSlug,
  canEdit,
  saving,
  save,
}: SectionProps & { workspaceSlug: string }) {
  const { getUserDetails, project: projectMembers } = useMember();
  const { error, isLoading, mutate } = useSWR(["overview-members", workspaceSlug, project.id], () =>
    projectMembers.fetchProjectMembers(workspaceSlug, project.id)
  );
  const memberIds = projectMembers.getProjectMemberIds(project.id, true) ?? [];
  const members = memberIds.flatMap((id) => {
    const member = getUserDetails(id);
    return member && !member.is_bot ? [member] : [];
  });
  const leadId = typeof project.project_lead === "string" ? project.project_lead : project.project_lead?.id;
  const lead = leadId ? getUserDetails(leadId) : undefined;
  const roleLabels: Record<number, string> = { 20: "Admin", 15: "Member", 5: "Guest" };
  return (
    <section className={cardClass} aria-labelledby="overview-people">
      <h2 id="overview-people" className="mb-4 text-16 font-semibold">
        Project roles
      </h2>
      <div className="mb-5 rounded-lg border border-subtle p-4">
        <p className="mb-2 text-12 font-medium text-tertiary">Project owner</p>
        <p className="text-14 font-medium">{lead?.display_name ?? (leadId ? "Current owner" : "No owner assigned")}</p>
        {canEdit && (
          <select
            className={`${selectClass} mt-3`}
            aria-label="Project owner"
            value={leadId ?? ""}
            disabled={saving || !!error || isLoading}
            onChange={(event) => void save({ project_lead: event.target.value || null })}
          >
            <option value="">No owner assigned</option>
            {leadId && !members.some((member) => member.id === leadId) && (
              <option value={leadId}>{lead?.display_name ?? "Current owner"}</option>
            )}
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        )}
      </div>
      <h3 className="mb-3 text-13 font-medium">Members ({members.length})</h3>
      {error ? (
        <p role="alert" className="text-13">
          Could not load project members.{" "}
          <Button label="Retry" variant="secondary" size="sm" stretch="auto" onClick={() => void mutate()} />
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => {
            const role = projectMembers.getProjectMemberDetails(member.id, project.id)?.role;
            const label = member.id === leadId ? "Project owner" : roleLabels[role ?? 15];
            return (
              <div key={member.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-subtle p-3">
                <Avatar
                  alt={member.display_name}
                  fallback={member.display_name?.[0]?.toUpperCase()}
                  src={getFileURL(member.avatar_url)}
                />
                <div className="min-w-0">
                  <p className="truncate text-13 font-medium">{member.display_name}</p>
                  <p className="text-12 text-tertiary">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <Link
          href={`/${workspaceSlug}/settings/projects/${project.id}/members`}
          className="mt-4 inline-block text-13 text-accent-primary"
        >
          Manage members
        </Link>
      )}
    </section>
  );
});

const OverviewTeammates = observer(function OverviewTeammates({
  project,
  workspaceSlug,
  canEdit,
}: {
  project: IProject;
  workspaceSlug: string;
  canEdit: boolean;
}) {
  const { getUserDetails, project: projectMembers } = useMember();
  const { error, mutate } = useSWR(["overview-members", workspaceSlug, project.id], () =>
    projectMembers.fetchProjectMembers(workspaceSlug, project.id)
  );
  const leadId = typeof project.project_lead === "string" ? project.project_lead : project.project_lead?.id;
  const ownerId = leadId ?? project.created_by;
  const teammates = (projectMembers.getProjectMemberIds(project.id, true) ?? []).flatMap((id) => {
    const member = getUserDetails(id);
    return member && !member.is_bot ? [member] : [];
  });
  const members = [
    ...teammates.filter((member) => member.id === ownerId),
    ...teammates.filter((member) => member.id !== ownerId),
  ];
  return (
    <section className={figmaCardClass} aria-labelledby="overview-teammates">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="overview-teammates" className="text-15 font-semibold text-primary">
          Project Teammates
        </h2>
        {canEdit && (
          <Link
            href={`/${workspaceSlug}/settings/projects/${project.id}/members`}
            className="inline-flex items-center gap-1 text-12 font-medium text-[#135DDD] hover:underline"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Teammate
          </Link>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-13">
          Could not load project teammates.{" "}
          <button type="button" className="text-[#135DDD] underline" onClick={() => void mutate()}>
            Retry
          </button>
        </p>
      ) : members.length ? (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member, index) => {
            const avatar = getFileURL(member.avatar_url);
            return (
              <li key={member.id} className="flex min-w-0 items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-11 font-semibold ${AVATAR_TINTS[index % AVATAR_TINTS.length]}`}
                  >
                    {initials(member.display_name ?? "")}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-13 font-medium text-primary">{member.display_name}</p>
                  <p className="text-12 text-tertiary">{member.id === ownerId ? "Project owner" : "Teammate"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-13 text-tertiary">No teammates yet.</p>
      )}
    </section>
  );
});

function OverviewHealth({ project, canEdit, saving, save }: SectionProps) {
  const health = HEALTH_OPTIONS.find((option) => option.value === project.health) ?? HEALTH_OPTIONS[0];
  return (
    <section className={cardClass} aria-labelledby="overview-health">
      <h2 id="overview-health" className="mb-4 text-16 font-semibold">
        Project health
      </h2>
      <div className="mb-4 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: health.color }} />
        <span className="text-14 font-medium">{health.label}</span>
      </div>
      {canEdit && (
        <select
          className={selectClass}
          aria-label="Project health"
          disabled={saving}
          value={project.health ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "" || value === "on_track" || value === "at_risk" || value === "off_track")
              void save({ health: value });
          }}
        >
          {HEALTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      <p className="mt-3 text-12 text-tertiary">Set by a project admin, independently of task completion.</p>
      <OverviewDates project={project} canEdit={canEdit} saving={saving} save={save} />
    </section>
  );
}

const formatProjectDate = (value: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Not set";

function OverviewDates({ project, canEdit, saving, save }: SectionProps) {
  const start = project.start_date ?? "";
  const due = project.target_date ?? "";
  if (!canEdit)
    return (
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-subtle pt-4 text-13">
        <div>
          <dt className="text-secondary">Start date</dt>
          <dd>{formatProjectDate(start)}</dd>
        </div>
        <div>
          <dt className="text-secondary">Due date</dt>
          <dd>{formatProjectDate(due)}</dd>
        </div>
      </dl>
    );
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-subtle pt-4 text-13">
      <label className="flex flex-col gap-1 text-secondary">
        Start date
        <input
          type="date"
          className={selectClass}
          disabled={saving}
          value={start}
          max={due || undefined}
          onChange={(event) => void save({ start_date: event.target.value || null })}
        />
      </label>
      <label className="flex flex-col gap-1 text-secondary">
        Due date
        <input
          type="date"
          className={selectClass}
          disabled={saving}
          value={due}
          min={start || undefined}
          onChange={(event) => void save({ target_date: event.target.value || null })}
        />
      </label>
    </div>
  );
}

function OverviewProgress({
  project,
  workspaceSlug,
  retry,
}: {
  project: IProject;
  workspaceSlug: string;
  retry: () => void;
}) {
  const summary = project.task_summary;
  const percentage = summary && summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  return (
    <section className={cardClass} aria-labelledby="overview-progress">
      <h2 id="overview-progress" className="mb-4 text-16 font-semibold">
        Task progress
      </h2>
      {summary ? (
        <>
          <div className="flex justify-between text-13">
            <span>Completed</span>
            <strong>{percentage}%</strong>
          </div>
          <progress
            className="accent-green-500 mt-3 h-2 w-full"
            aria-label="Completed tasks"
            max={summary.total || 1}
            value={summary.completed}
          />
          <dl className="mt-4 space-y-3 text-13">
            {[
              ["Total tasks", summary.total],
              ["Completed", summary.completed],
              ["In progress", summary.started],
              ["Cancelled", summary.cancelled],
              ["Overdue", summary.overdue],
            ].map(([label, count]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-secondary">{label}</dt>
                <dd className="font-medium">{count}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-12 text-tertiary">
            Active tasks only; excludes archived tasks, drafts, and Intake. Refreshes every 30 seconds.
          </p>
        </>
      ) : (
        <p role="alert" className="text-13">
          Task progress is unavailable.{" "}
          <Button label="Retry" variant="secondary" size="sm" stretch="auto" onClick={retry} />
        </p>
      )}
      <Link
        href={`/${workspaceSlug}/projects/${project.id}/issues`}
        className="mt-4 inline-block text-13 text-accent-primary"
      >
        View work items
      </Link>
    </section>
  );
}

export const ProjectOverview = observer(function ProjectOverview({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const { fetchProjectDetails, updateProject } = useProject();
  const { allowPermissions } = useUserPermissions();
  const {
    data: project,
    error,
    mutate,
  } = useSWR(PROJECT_DETAILS(workspaceSlug, projectId), () => fetchProjectDetails(workspaceSlug, projectId), {
    refreshInterval: 30_000,
  });
  const [saving, setSaving] = useState(false);
  const classic = useSearchParams().get("view") === "classic";
  const canEdit =
    !project?.archived_at &&
    (allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId) ||
      allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug));
  async function retry() {
    try {
      await mutate();
    } catch (refreshError) {
      console.error("Project overview refresh failed", refreshError);
    }
  }
  async function save(payload: Partial<IProject>): Promise<boolean> {
    setSaving(true);
    try {
      const updated = await updateProject(workspaceSlug, projectId, payload);
      await mutate((current) => (current ? { ...current, ...updated } : updated), { revalidate: false });
      setToast({ type: "success", title: "Project overview updated" });
      return true;
    } catch (saveError) {
      console.error("Project overview update failed", saveError);
      setToast({
        type: "error",
        title: "Could not update project overview",
        message: "Check your connection and permissions, then retry. Your draft has been retained.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }
  if (!project)
    return (
      <div className="p-8" role={error ? "alert" : "status"}>
        {error ? (
          <>
            Could not load the project overview.{" "}
            <Button label="Retry" variant="secondary" size="sm" stretch="auto" onClick={() => void retry()} />
          </>
        ) : (
          "Loading project overview..."
        )}
      </div>
    );

  const sectionProps = { project, canEdit, saving, save };
  const resources = (
    <ProjectOverviewResources
      resources={project.overview_resources ?? []}
      canEdit={canEdit}
      saving={saving}
      save={save}
    />
  );
  const refreshError = error && (
    <div role="alert" className={figmaCardClass}>
      Could not refresh the overview. The last loaded data is shown.{" "}
      <Button label="Retry" variant="secondary" size="sm" stretch="auto" onClick={() => void retry()} />
    </div>
  );
  const archivedNote = project.archived_at && (
    <p className="text-13 text-secondary">This project is archived and read-only.</p>
  );
  if (!classic)
    return (
      <div className="min-h-full bg-surface-1">
        <PageHead title={`${project.name} - Overview`} />
        <ProjectPageHeader workspaceSlug={workspaceSlug} projectId={projectId} name={project.name} active="overview" />
        <main className="px-6 py-6 md:px-8">
          <div className="max-w-[720px] space-y-4">
            {refreshError}
            {archivedNote}
            <OverviewDescription {...sectionProps} />
            <OverviewTeammates project={project} workspaceSlug={workspaceSlug} canEdit={canEdit} />
            {resources}
          </div>
        </main>
      </div>
    );
  // The previous layout (health, task progress, dates and owner picker) stays reachable at ?view=classic.
  return (
    <div className="min-h-full bg-surface-2">
      <PageHead title={`${project.name} - Overview`} />
      <header className="border-b border-subtle bg-surface-1 px-6 py-5 md:px-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-24 font-semibold break-words">{project.name}</h1>
          <p className="mt-1 text-13 text-secondary">
            Your project at a glance: purpose, people, resources, and progress.
          </p>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 p-6 md:p-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {refreshError}
          {archivedNote}
          <OverviewDescription {...sectionProps} />
          <OverviewPeople {...sectionProps} workspaceSlug={workspaceSlug} />
          {resources}
        </div>
        <aside className="space-y-6">
          <OverviewHealth {...sectionProps} />
          <OverviewProgress project={project} workspaceSlug={workspaceSlug} retry={() => void retry()} />
          {project.created_at && (
            <p className="px-1 text-12 text-tertiary">Project created {renderFormattedDate(project.created_at)}</p>
          )}
        </aside>
      </main>
    </div>
  );
});
