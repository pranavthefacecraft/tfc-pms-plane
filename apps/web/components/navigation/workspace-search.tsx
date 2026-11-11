import { Command } from "cmdk";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { CheckCircle2, Folder, Users, FileText, Paperclip, ArrowRight } from "lucide-react";
import type { TActivityEntityData } from "@plane/types";
import { generateWorkItemLink } from "@plane/utils";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { useAppRouter } from "@/hooks/use-app-router";
import { useUser } from "@/hooks/store/user";
import useDebounce from "@/hooks/use-debounce";
import { WorkspaceService } from "@/services/workspace.service";
import { pmsSearchService } from "@/services/pms-search.service";
import type { TPMSSearchResponse, TPMSSearchResult, TPMSSearchKind } from "@/services/pms-search.service";

const workspaceService = new WorkspaceService();
export type SearchCategory = "all" | "tasks" | "projects" | "people" | "documents" | "files";
const groups = {
  navigation: { title: "Go to", icon: ArrowRight },
  tasks: { title: "Tasks", icon: CheckCircle2 },
  projects: { title: "Projects", icon: Folder },
  people: { title: "People", icon: Users },
  documents: { title: "Notepad, Whiteboards and more", icon: FileText },
  files: { title: "Files and links", icon: Paperclip },
};

function recentSearchItems(recents: TActivityEntityData[], workspaceSlug: string): TPMSSearchResult[] {
  return recents.flatMap((recent): TPMSSearchResult[] => {
    const item = recent.entity_data;
    if (!item) return [];
    const scope = { workspace_slug: workspaceSlug, workspace_name: workspaceSlug };
    if (recent.entity_name === "issue" && "sequence_id" in item)
      return [
        {
          ...scope,
          id: item.id,
          kind: "tasks",
          name: item.name,
          detail: `${item.project_identifier}-${item.sequence_id}`,
          href: generateWorkItemLink({
            workspaceSlug,
            projectId: item.project_id,
            issueId: item.id,
            projectIdentifier: item.project_identifier,
            sequenceId: item.sequence_id,
            isEpic: item.is_epic,
          }),
        },
      ];
    if (recent.entity_name === "project" && "identifier" in item)
      return [
        {
          ...scope,
          id: item.id,
          kind: "projects",
          name: item.name,
          detail: item.identifier,
          href: `/${workspaceSlug}/projects/${item.id}/overview`,
        },
      ];
    if (recent.entity_name === "page" && "owned_by" in item)
      return [
        {
          ...scope,
          id: item.id,
          kind: "documents",
          name: item.name,
          detail: "Notepad",
          href: item.project_id
            ? `/${workspaceSlug}/projects/${item.project_id}/pages/${item.id}`
            : `/${workspaceSlug}/tool/pages/${item.id}`,
        },
      ];
    return [];
  });
}

type Props = { workspaceSlug: string; searchTerm: string; category: SearchCategory; onClose: () => void };
type SearchKey = readonly ["PMS_SEARCH", string, string, SearchCategory, number];

function usePMSSearch({ workspaceSlug, searchTerm, category }: Omit<Props, "onClose">) {
  const { data: user } = useUser();
  const query = searchTerm.trim();
  const debouncedQuery = useDebounce(query, 300);
  const searching = query.length > 0;
  const search = useSWRInfinite<TPMSSearchResponse>(
    (_index: number, previous: TPMSSearchResponse | null): SearchKey | null => {
      if (!user || !debouncedQuery || !searching || previous?.next_offset === null) return null;
      return ["PMS_SEARCH", user.id, debouncedQuery, category, previous?.next_offset ?? 0];
    },
    ([, , term, kind, offset]: SearchKey) => pmsSearchService.search(term, kind, offset),
    { revalidateOnFocus: false, persistSize: false }
  );
  const recents = useSWR(
    user && workspaceSlug && !searching ? ["TOP_NAV_RECENTS", user.id, workspaceSlug] : null,
    () => workspaceService.fetchWorkspaceRecents(workspaceSlug),
    { revalidateOnFocus: false }
  );
  const pages = search.data ?? [];
  const results = query === debouncedQuery ? pages.flatMap((page) => page.results) : [];
  const items = searching
    ? results
    : recentSearchItems(recents.data ?? [], workspaceSlug).filter(
        (item) => category === "all" || item.kind === category
      );
  const loading = searching ? query !== debouncedQuery || search.isLoading : recents.isLoading;
  const error = searching ? search.error : recents.error;
  const lastPage = pages.at(-1);
  return {
    items,
    loading,
    error,
    searching,
    hasMore: searching && query === debouncedQuery && lastPage?.has_more,
    loadingMore: search.isValidating,
    loadMore: async () => {
      try {
        await search.setSize(search.size + 1);
      } catch (error) {
        console.error("Unable to load more PMS search results.", error);
      }
    },
    retry: () =>
      searching
        ? search.mutate(undefined, { throwOnError: false })
        : recents.mutate(undefined, { throwOnError: false }),
  };
}

function SearchResultGroup({
  kind,
  items,
  onSelect,
}: {
  kind: TPMSSearchKind;
  items: TPMSSearchResult[];
  onSelect: (href: string) => void;
}) {
  const group = groups[kind];
  if (items.length === 0) return null;
  return (
    <Command.Group heading={group.title}>
      {items.map((item) => (
        <PowerKModalCommandItem
          key={`${item.workspace_slug}-${item.kind}-${item.id}`}
          value={`${item.workspace_slug}-${item.kind}-${item.id}`}
          icon={group.icon}
          label={
            <span className="flex min-w-0 flex-col gap-0.5 py-1">
              <span className="truncate text-13 font-medium text-primary">{item.name}</span>
              <span className="truncate text-11 text-tertiary">
                {item.workspace_name} - {item.detail}
              </span>
            </span>
          }
          onSelect={() => onSelect(item.href)}
        />
      ))}
    </Command.Group>
  );
}

export function WorkspaceSearch(props: Props) {
  const router = useAppRouter();
  const state = usePMSSearch(props);
  const select = (href: string) => {
    props.onClose();
    router.push(href);
  };
  return (
    <>
      {state.error && (
        <div role="alert" className="px-3 py-3 text-13 text-danger-primary">
          Unable to load search results.{" "}
          <button type="button" className="underline" onClick={() => void state.retry()}>
            Retry
          </button>
        </div>
      )}
      {state.loading && (
        <p role="status" className="px-3 py-3 text-13 text-tertiary">
          Loading...
        </p>
      )}
      {!state.loading && !state.error && state.items.length === 0 && (
        <p className="px-3 py-6 text-13 text-tertiary">
          {state.searching ? "No matching results." : "No recent items. Search across all your workspaces."}
        </p>
      )}
      {(Object.keys(groups) as TPMSSearchKind[]).map((kind) => (
        <SearchResultGroup
          key={kind}
          kind={kind}
          items={state.items.filter((item) => item.kind === kind)}
          onSelect={select}
        />
      ))}
      {state.hasMore && (
        <button
          type="button"
          disabled={state.loadingMore}
          className="mx-2 my-2 rounded px-3 py-2 text-13 text-accent-primary hover:bg-layer-2 disabled:opacity-50"
          onClick={() => void state.loadMore()}
        >
          {state.loadingMore ? "Loading more..." : "Show more results"}
        </button>
      )}
    </>
  );
}
