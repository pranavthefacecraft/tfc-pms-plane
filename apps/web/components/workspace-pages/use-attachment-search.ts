import { useEffect, useMemo, useState } from "react";
import type { TIssueSearchResponse } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { WorkspaceService } from "@/services/workspace.service";

const service = new WorkspaceService();

export function useAttachmentSearch(workspaceSlug: string, query: string, enabled: boolean) {
  const [issues, setIssues] = useState<TIssueSearchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { joinedProjectIds, getPartialProjectById } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setIssues([]);
    const timer = setTimeout(() => {
      service
        .searchEntity(workspaceSlug, { count: 20, query_type: ["issue"], query })
        .then((response) => {
          if (!cancelled) setIssues(response.issue ?? []);
        })
        .catch((cause) => {
          if (!cancelled) {
            console.error("Notepad task search failed", cause);
            setError("Could not search tasks. Please retry.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, workspaceSlug, query, attempt]);
  const projects = useMemo(() => {
    const search = query.trim().toLowerCase();
    return joinedProjectIds
      .map((id) => getPartialProjectById(id))
      .filter((project): project is NonNullable<typeof project> => !!project)
      .filter((project) =>
        typeof project.workspace === "string"
          ? project.workspace === workspaceId
          : project.workspace.slug === workspaceSlug
      )
      .filter(
        (project) =>
          !search || project.name.toLowerCase().includes(search) || project.identifier.toLowerCase().includes(search)
      );
  }, [joinedProjectIds, getPartialProjectById, query, workspaceSlug, workspaceId]);
  return { issues, projects, loading, error, retry: () => setAttempt((value) => value + 1) };
}
