/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import type { TProject } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { JoinProjectModal } from "@/components/project/join-project-modal";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useCurrentTime } from "@/hooks/use-current-time";
import { browseProjects, initials, lastModifiedLabel } from "./projects-browse.helpers";
import type { TSortDirection } from "./projects-browse.helpers";

const MAX_AVATARS = 2;
const NO_MEMBERS: string[] = [];

function ProjectIcon({ project }: { project: TProject }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#E0F4F1] text-[#0F8B7E]">
      {project.logo_props?.in_use ? (
        <Logo logo={project.logo_props} size={18} />
      ) : (
        <span className="text-12 font-semibold">{project.identifier.slice(0, 2)}</span>
      )}
    </span>
  );
}

const ProjectCollaborators = observer(function ProjectCollaborators({
  ids,
  manageHref,
  projectName,
}: {
  ids: string[];
  manageHref?: string;
  projectName: string;
}) {
  const { getUserDetails } = useMember();
  const hidden = ids.length - MAX_AVATARS;
  return (
    <div className="flex items-center -space-x-1">
      {ids.slice(0, MAX_AVATARS).map((id) => {
        const person = getUserDetails(id);
        const name =
          person?.display_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Team member";
        return (
          <span
            key={id}
            title={name}
            aria-label={name}
            className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#1764E8] text-10 font-medium text-white"
          >
            {initials(name)}
          </span>
        );
      })}
      {hidden > 0 && (
        <span
          className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#E8DFFD] text-10 font-medium text-[#7955BE]"
          aria-label={`${hidden} more collaborators`}
        >
          +{hidden}
        </span>
      )}
      {manageHref && (
        <Link
          href={manageHref}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Add collaborators to ${projectName}`}
          title="Add collaborators"
          className="!ml-1 grid size-7 place-items-center rounded-full border border-dashed border-[#A8B5C9] text-secondary hover:border-[#135DDD] hover:text-[#135DDD]"
        >
          <Plus className="size-3.5" />
        </Link>
      )}
    </div>
  );
});

function ProjectRow({
  project,
  workspaceSlug,
  now,
  canManage,
  onOpen,
}: {
  project: TProject;
  workspaceSlug: string;
  now: Date;
  canManage: boolean;
  onOpen: (project: TProject) => void;
}) {
  const joined = !!project.member_role;
  return (
    <tr
      className="cursor-pointer border-b border-subtle hover:bg-layer-1"
      onClick={() => onOpen(project)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(project);
      }}
      tabIndex={0}
      aria-label={`Open ${project.name}`}
    >
      <td className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectIcon project={project} />
          <div className="min-w-0">
            <p className="truncate font-medium text-primary">{project.name}</p>
            {joined ? (
              <p className="text-11 font-medium text-[#009E79]">Joined</p>
            ) : (
              <p className="text-11 font-medium text-[#135DDD]">Join project</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <ProjectCollaborators
          ids={project.members ?? NO_MEMBERS}
          projectName={project.name}
          manageHref={joined && canManage ? `/${workspaceSlug}/settings/projects/${project.id}/members` : undefined}
        />
      </td>
      <td className="px-3 py-3 text-secondary">{lastModifiedLabel(project.updated_at, now)}</td>
    </tr>
  );
}

export const ProjectsBrowse = observer(function ProjectsBrowse({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useAppRouter();
  const { currentTime } = useCurrentTime();
  const { workspaceProjectIds, getProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<TSortDirection>("desc");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [joining, setJoining] = useState<TProject | null>(null);

  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const projects = useMemo(
    () =>
      (workspaceProjectIds ?? []).map((id) => getProjectById(id)).filter((project): project is TProject => !!project),
    [workspaceProjectIds, getProjectById]
  );
  const rows = browseProjects(projects, query, direction);

  const openProject = (project: TProject) => {
    if (project.member_role) router.push(`/${workspaceSlug}/projects/${project.id}/issues`);
    else setJoining(project);
  };

  return (
    <main className="h-full overflow-y-auto bg-surface-1 px-5 py-6 md:px-8" aria-label="Projects">
      <PageHead title="Projects" />
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-5 text-24 font-semibold">Projects</h1>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {canCreate ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#135DDD] px-4 py-2 text-13 font-medium text-white hover:bg-[#0F4FC0]"
            >
              <Plus className="size-4" />
              Create Project
            </button>
          ) : (
            <span />
          )}
          <label className="flex h-9 w-full items-center gap-2 rounded-full border border-subtle bg-surface-1 px-3 sm:w-64">
            <Search className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="w-full bg-transparent text-13 outline-none placeholder:text-placeholder"
            />
          </label>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-13">
            <thead className="border-y border-subtle text-10 text-secondary uppercase">
              <tr>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Collaborators</th>
                <th className="px-3 py-3 font-medium" aria-sort={direction === "asc" ? "ascending" : "descending"}>
                  <button
                    type="button"
                    onClick={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-1 uppercase hover:text-primary"
                  >
                    Last modified
                    {direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  workspaceSlug={workspaceSlug}
                  now={currentTime}
                  canManage={canCreate}
                  onOpen={openProject}
                />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="py-10 text-center text-13 text-secondary">
              {query.trim() ? `No projects match “${query.trim()}”.` : "No projects yet."}
            </p>
          )}
        </div>
      </div>
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        setToFavorite={false}
        workspaceSlug={workspaceSlug}
      />
      {joining && (
        <JoinProjectModal isOpen workspaceSlug={workspaceSlug} project={joining} handleClose={() => setJoining(null)} />
      )}
    </main>
  );
});
