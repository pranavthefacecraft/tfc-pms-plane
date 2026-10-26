/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { makeAutoObservable, runInAction } from "mobx";
import { orderBy } from "lodash-es";
import type { TProjectSection } from "@/services/project/project-section.service";
import { ProjectSectionService } from "@/services/project/project-section.service";
import type { TIssue } from "@plane/types";

type TSectionIssueCache = {
  issues: { issuesMap: Record<string, TIssue>; updateIssue: (id: string, data: Partial<TIssue>) => void };
  projectIssues: { clear: (clearPagination?: boolean) => void };
  cycleIssues: { clear: (clearPagination?: boolean) => void };
  moduleIssues: { clear: (clearPagination?: boolean) => void };
  projectViewIssues: { clear: (clearPagination?: boolean) => void };
};

export class SectionStore {
  sections: Record<string, TProjectSection[]> = {};
  service: ProjectSectionService;
  issueCache: TSectionIssueCache;

  constructor(issueCache: TSectionIssueCache, service = new ProjectSectionService()) {
    this.issueCache = issueCache;
    this.service = service;
    makeAutoObservable(this, { service: false, issueCache: false }, { autoBind: true });
  }

  key(workspaceSlug: string, projectId: string) {
    return `${workspaceSlug}:${projectId}`;
  }

  getSections(workspaceSlug: string, projectId: string) {
    return this.sections[this.key(workspaceSlug, projectId)] ?? [];
  }

  async fetch(workspaceSlug: string, projectId: string) {
    const sections = await this.service.list(workspaceSlug, projectId);
    runInAction(() => {
      this.sections[this.key(workspaceSlug, projectId)] = sections;
    });
    return sections;
  }

  private save(workspaceSlug: string, projectId: string, section: TProjectSection) {
    const key = this.key(workspaceSlug, projectId);
    const sections = this.getSections(workspaceSlug, projectId).filter((item) => item.id !== section.id);
    this.sections[key] = orderBy([...sections, section], ["sort_order", "id"], ["asc", "asc"]);
  }

  async create(workspaceSlug: string, projectId: string, name: string) {
    const section = await this.service.create(workspaceSlug, projectId, name);
    runInAction(() => this.save(workspaceSlug, projectId, section));
    return section;
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    id: string,
    data: Partial<Pick<TProjectSection, "name" | "sort_order">>
  ) {
    const section = await this.service.update(workspaceSlug, projectId, id, data);
    runInAction(() => this.save(workspaceSlug, projectId, section));
    return section;
  }

  async remove(workspaceSlug: string, projectId: string, id: string) {
    await this.service.remove(workspaceSlug, projectId, id);
    runInAction(() => {
      for (const issue of Object.values(this.issueCache.issues.issuesMap)) {
        if (issue.section_id === id) this.issueCache.issues.updateIssue(issue.id, { section_id: null });
      }
      for (const scope of [
        this.issueCache.projectIssues,
        this.issueCache.cycleIssues,
        this.issueCache.moduleIssues,
        this.issueCache.projectViewIssues,
      ])
        scope.clear(false);
      this.sections[this.key(workspaceSlug, projectId)] = this.getSections(workspaceSlug, projectId).filter(
        (item) => item.id !== id
      );
    });
  }

  async move(workspaceSlug: string, projectId: string, id: string, direction: -1 | 1) {
    const sections = this.getSections(workspaceSlug, projectId);
    const index = sections.findIndex((section) => section.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sections.length)
      throw new Error("Section cannot be moved further.");
    const neighbor = sections[targetIndex];
    const outside = sections[targetIndex + direction];
    const sortOrder = outside
      ? (neighbor.sort_order + outside.sort_order) / 2
      : neighbor.sort_order + direction * 10000;
    await this.update(workspaceSlug, projectId, id, { sort_order: sortOrder });
  }
}
