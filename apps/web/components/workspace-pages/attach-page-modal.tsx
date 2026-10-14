/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { ProjectsOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import type { TIssueSearchResponse } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useProject } from "@/hooks/store/use-project";
// services
import type { TWorkspacePage, TWorkspacePageEntityType } from "@/services/page/workspace-page.service";
import { WorkspacePageService } from "@/services/page/workspace-page.service";
import { WorkspaceService } from "@/services/workspace.service";

const workspacePageService = new WorkspacePageService();
const workspaceService = new WorkspaceService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  page: TWorkspacePage;
  onAttached: (page: TWorkspacePage) => void;
};

type TSelection = { entityType: TWorkspacePageEntityType; id: string } | null;

const TABS: { key: TWorkspacePageEntityType; label: string }[] = [
  { key: "issue", label: "Task" },
  { key: "project", label: "Project" },
];

export const AttachWorkspacePageModal = observer(function AttachWorkspacePageModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, page, onAttached } = props;
  // states
  const [activeTab, setActiveTab] = useState<TWorkspacePageEntityType>("issue");
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<TIssueSearchResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selection, setSelection] = useState<TSelection>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { joinedProjectIds, getPartialProjectById } = useProject();

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelection(null);
    setActiveTab(page.attachment?.entity_type ?? "issue");
  }, [isOpen, page.attachment?.entity_type]);

  useEffect(() => {
    if (!isOpen || activeTab !== "issue") return;
    let isCancelled = false;
    setIsSearching(true);
    const timer = setTimeout(() => {
      workspaceService
        .searchEntity(workspaceSlug, { count: 20, query_type: ["issue"], query })
        .then((response) => {
          if (!isCancelled) setIssues(response.issue ?? []);
        })
        .catch(() => {
          if (!isCancelled) setIssues([]);
        })
        .finally(() => {
          if (!isCancelled) setIsSearching(false);
        });
    }, 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, isOpen, query, workspaceSlug]);

  const projects = useMemo(() => {
    const search = query.trim().toLowerCase();
    return joinedProjectIds
      .map((projectId) => getPartialProjectById(projectId))
      .filter((project): project is NonNullable<typeof project> => !!project)
      .filter(
        (project) =>
          !search || project.name.toLowerCase().includes(search) || project.identifier.toLowerCase().includes(search)
      );
  }, [getPartialProjectById, joinedProjectIds, query]);

  const handleAttach = async () => {
    if (!selection) return;
    setIsSubmitting(true);
    try {
      const updatedPage = await workspacePageService.attach(workspaceSlug, page.id, {
        entity_type: selection.entityType,
        entity_id: selection.id,
      });
      onAttached(updatedPage);
      setToast({ type: "success", title: "Page attached", message: "The page was attached successfully." });
      onClose();
    } catch (error: unknown) {
      const message = (error as { error?: string } | undefined)?.error ?? "Could not attach the page.";
      setToast({ type: "error", title: "Error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOption = (key: string, isSelected: boolean, onSelect: () => void, content: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-13 text-secondary hover:bg-layer-1-hover",
        { "bg-layer-1-selected text-primary": isSelected }
      )}
    >
      {content}
    </button>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Attach page</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1 rounded-md bg-layer-1 p-0.5">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      setSelection(null);
                    }}
                    className={cn("flex-1 rounded px-3 py-1 text-13 font-medium text-tertiary", {
                      "shadow-sm bg-surface-1 text-primary": activeTab === tab.key,
                    })}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <InputGroup size="lg">
                <Input
                  size="lg"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeTab === "issue" ? "Search tasks by name or ID" : "Search projects"}
                  aria-label="Search"
                />
              </InputGroup>
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {activeTab === "issue" &&
                  (isSearching && issues.length === 0 ? (
                    <p className="px-2 py-3 text-13 text-placeholder">Searching...</p>
                  ) : issues.length === 0 ? (
                    <p className="px-2 py-3 text-13 text-placeholder">No tasks found</p>
                  ) : (
                    issues.map((issue) =>
                      renderOption(
                        issue.id,
                        selection?.entityType === "issue" && selection.id === issue.id,
                        () => setSelection({ entityType: "issue", id: issue.id }),
                        <>
                          <WorkItemsOutline className="size-4 flex-shrink-0 text-tertiary" />
                          <span className="flex-shrink-0 text-11 text-tertiary">
                            {issue.project__identifier}-{issue.sequence_id}
                          </span>
                          <span className="truncate">{issue.name}</span>
                        </>
                      )
                    )
                  ))}
                {activeTab === "project" &&
                  (projects.length === 0 ? (
                    <p className="px-2 py-3 text-13 text-placeholder">No projects found</p>
                  ) : (
                    projects.map((project) =>
                      renderOption(
                        project.id,
                        selection?.entityType === "project" && selection.id === project.id,
                        () => setSelection({ entityType: "project", id: project.id }),
                        <>
                          <ProjectsOutline className="size-4 flex-shrink-0 text-tertiary" />
                          <span className="truncate">{project.name}</span>
                          <span className="ml-auto flex-shrink-0 text-11 text-tertiary">{project.identifier}</span>
                        </>
                      )
                    )
                  ))}
              </div>
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" onClick={onClose} label="Cancel" />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            onClick={() => void handleAttach()}
            loading={isSubmitting}
            disabled={!selection}
            label="Attach"
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
