import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { Folder, Link2, Search, SquareCheck } from "lucide-react";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { setToast } from "@plane/blocks/toast";
import { WorkspacePageService } from "@/services/page/workspace-page.service";
import type { TWorkspacePage, TWorkspacePageEntityType } from "@/services/page/workspace-page.service";
import { useAttachmentSearch } from "./use-attachment-search";

const service = new WorkspacePageService();

const AttachmentSearchResults = observer(function AttachmentSearchResults({
  search,
  disabled,
  onAttach,
}: {
  search: ReturnType<typeof useAttachmentSearch>;
  disabled: boolean;
  onAttach: (entityType: TWorkspacePageEntityType, id: string) => Promise<void>;
}) {
  const { projects, issues, loading, error, retry } = search;
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto" aria-busy={loading || disabled}>
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          disabled={disabled}
          onClick={() => void onAttach("project", project.id)}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-12 hover:bg-layer-1 disabled:opacity-50"
        >
          <Folder size={14} className="shrink-0 text-[#135DDD]" />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-11 text-tertiary">Project</span>
        </button>
      ))}
      {loading ? (
        <p role="status" className="p-2 text-12 text-tertiary">
          Searching tasks...
        </p>
      ) : (
        issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            disabled={disabled}
            onClick={() => void onAttach("issue", issue.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-12 hover:bg-layer-1 disabled:opacity-50"
          >
            <SquareCheck size={14} className="shrink-0 text-[#135DDD]" />
            <span className="truncate">{issue.name}</span>
            <span className="ml-auto shrink-0 text-11 text-tertiary">
              {issue.project__identifier}-{issue.sequence_id}
            </span>
          </button>
        ))
      )}
      {error && (
        <p role="alert" className="p-2 text-12 text-danger-primary">
          {error}{" "}
          <button type="button" onClick={retry} className="underline">
            Retry
          </button>
        </p>
      )}
      {!loading && !error && !projects.length && !issues.length && (
        <p className="p-2 text-12 text-tertiary">No tasks or projects found</p>
      )}
    </div>
  );
});

export const LinkWorkspacePagePopover = observer(function LinkWorkspacePagePopover({
  workspaceSlug,
  page,
  onAttached,
  disabled = false,
}: {
  workspaceSlug: string;
  page: TWorkspacePage;
  onAttached: (page: TWorkspacePage) => void | Promise<void>;
  disabled?: boolean;
}) {
  const label = page.tool_type === "whiteboard" ? "Whiteboard" : "Notepad";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const unavailable = busy || disabled;
  const search = useAttachmentSearch(workspaceSlug, query, open && !disabled);
  const attach = useCallback(
    async (entityType: TWorkspacePageEntityType, id: string) => {
      setBusy(true);
      setSaveError("");
      try {
        await onAttached(await service.attach(workspaceSlug, page.id, { entity_type: entityType, entity_id: id }));
        setToast({ type: "success", title: `${label} linked` });
        setOpen(false);
      } catch (cause) {
        console.error(`Could not link ${label.toLowerCase()}`, cause);
        setSaveError(`Could not link this ${label.toLowerCase()}. Please try again.`);
      } finally {
        setBusy(false);
      }
    },
    [workspaceSlug, page.id, onAttached, label]
  );
  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(value) => {
        if (!busy && (!value || !disabled)) {
          setOpen(value);
          setQuery("");
          setSaveError("");
        }
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            disabled={disabled}
            className={`flex items-center justify-center gap-1 rounded-md bg-surface-1 px-2 py-1 text-12 hover:bg-layer-1 disabled:opacity-50 ${page.tool_type === "whiteboard" ? "min-h-9 min-w-44 border border-[#E2E6EF] px-4 dark:border-subtle" : ""}`}
          />
        }
      >
        <Link2 size={16} className="text-[#135DDD]" />{" "}
        {page.tool_type === "whiteboard" ? "Link to Task or Project" : "Link Task / Project"}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" sideOffset={8}>
        <PopoverBody>
          <div className="w-80 max-w-[calc(100vw-32px)] space-y-3 p-1">
            <h2 className="text-13 font-semibold text-primary">Link {label}</h2>
            <label className="flex items-center gap-2 rounded border border-subtle px-2 py-1.5">
              <Search size={14} className="text-tertiary" />
              <input
                aria-label="Search tasks or projects"
                placeholder="Search task or project"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={unavailable}
                className="min-w-0 flex-1 bg-transparent text-12 outline-none"
              />
            </label>
            <AttachmentSearchResults search={search} disabled={unavailable} onAttach={attach} />
            {busy && (
              <p role="status" className="text-12 text-tertiary">
                Linking...
              </p>
            )}
            {saveError && (
              <p role="alert" className="text-12 text-danger-primary">
                {saveError}
              </p>
            )}
          </div>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
});
