import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TWorkspacePage } from "@/services/page/workspace-page.service";
import { WorkspacePagesListRoot, notepadCollaborators, notepadUpdatedLabel } from "./pages-list-root";

const state = vi.hoisted(() => ({
  pages: [] as TWorkspacePage[],
  loading: false,
  error: undefined as Error | undefined,
  mutate: vi.fn(),
  destroy: vi.fn(),
  create: vi.fn(),
  creating: false,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("swr", () => ({
  default: () => ({ data: state.pages, isLoading: state.loading, error: state.error, mutate: state.mutate }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "owner" } }) }));
vi.mock("./use-create-page", () => ({
  useCreateWorkspacePage: () => ({ createPage: state.create, isCreating: state.creating }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/services/page/workspace-page.service", () => ({
  WORKSPACE_PAGE_ACCESS: { PUBLIC: 0, PRIVATE: 1 },
  WorkspacePageService: class {
    destroy = state.destroy;
  },
}));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <>{children}</>,
  MenuTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  MenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  MenuItem: ({ label, onClick, render }: { label: string; onClick?: () => void; render?: ReactNode }) => (
    <>
      {render}
      <button onClick={onClick}>{label}</button>
    </>
  ),
}));

const owner = { id: "owner", display_name: "Ima", first_name: "Ima", last_name: "", avatar_url: null };
const page: TWorkspacePage = {
  id: "note",
  name: "Project Brief",
  tool_type: "page",
  access: 0,
  logo_props: {},
  owned_by: "owner",
  owner,
  updated_by: { ...owner, id: "editor", display_name: "Pranav" },
  workspace: "workspace",
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-05T12:00:00Z",
  attachment: {
    entity_type: "issue",
    project_id: "project",
    project_name: "Website Redesign",
    issue_id: "task",
    issue_sequence_id: 8,
    project_identifier: "WEB",
    issue_name: "Draft brief",
    is_accessible: true,
  },
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.pages = [page];
  state.loading = false;
  state.error = undefined;
  state.creating = false;
  state.destroy.mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function render(toolType: "page" | "whiteboard" = "page") {
  await act(() =>
    root.render(
      <MemoryRouter>
        <WorkspacePagesListRoot workspaceSlug="team" toolType={toolType} />
      </MemoryRouter>
    )
  );
}
async function click(text: string) {
  await act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click());
}
it("matches Notepads columns and uses actual project and editor data", async () => {
  await render();
  expect(host.querySelector("h1")?.textContent).toBe("Notepads");
  expect([...host.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual([
    "NAME",
    "PROJECT",
    "COLLABORATORS",
    "UPDATED",
    "",
  ]);
  expect(host.querySelector('a[href="/team/tool/pages/note/"]')?.textContent).toBe("Project Brief");
  expect(host.querySelector('a[href="/team/projects/project/overview/"]')?.textContent).toBe("Website Redesign");
  expect(host.textContent).toContain("Ima, Pranav");
  expect(host.textContent).toContain("WEB-8 Draft brief");
  expect(host.querySelector('[aria-label="Actions for Project Brief"]')).not.toBeNull();
  await click("Create Notepad");
  expect(state.create).toHaveBeenCalledOnce();
});
it("filters names and handles no matches without offering another empty-state create action", async () => {
  await render();
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Search notepads"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(() => {
    setter.call(input, "  project  ");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).toContain("Project Brief");
  await act(() => {
    setter.call(input, "missing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).toContain("No notepads match your search");
  expect(host.querySelectorAll("tbody a")).toHaveLength(0);
});
it("does not expose restricted attachment details or delete controls for non-owners", async () => {
  state.pages = [
    { ...page, owned_by: "someone-else", access: 1, attachment: { ...page.attachment!, is_accessible: false } },
  ];
  await render();
  expect(host.textContent).toContain("Restricted project");
  expect(host.textContent).not.toContain("Website Redesign");
  expect(host.textContent).not.toContain("Draft brief");
  expect(host.querySelector('a[href*="/projects/"]')).toBeNull();
  expect(host.textContent).toContain("Private");
  expect(host.textContent).not.toContain("Delete notepad");
});
it("confirms owner deletion and preserves cancellation", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await render();
  await click("Delete notepad");
  expect(state.destroy).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await click("Delete notepad");
  expect(state.destroy).toHaveBeenCalledWith("team", "note");
  expect(state.mutate).toHaveBeenCalled();
});
it("shows loading, error/retry and honest empty states", async () => {
  state.pages = [];
  state.loading = true;
  await render();
  expect(host.textContent).toContain("Loading notepads...");
  expect(host.textContent).not.toContain("No notepads yet");
  state.loading = false;
  state.error = new Error("offline");
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load notepads");
  expect(host.textContent).not.toContain("No notepads yet");
  await click("Retry");
  expect(state.mutate).toHaveBeenCalledOnce();
  state.error = undefined;
  await render();
  expect(host.textContent).toContain("No notepads yet");
});
it("disables creation while creating and keeps unattached notes visible", async () => {
  state.creating = true;
  state.pages = [{ ...page, name: "", attachment: null, owner: null, updated_by: null }];
  await render();
  expect(host.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
  expect(host.textContent).toContain("Untitled");
  expect(host.textContent).not.toContain("Website Redesign");
});
it("retains the existing Whiteboards list columns and search", async () => {
  await render("whiteboard");
  expect(host.querySelector("h1")).toBeNull();
  expect([...host.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual([
    "Name",
    "Created by",
    "Attached to",
    "Last modified",
    "Access",
    "Members",
    "",
  ]);
  expect(host.querySelector('input[aria-label="Search whiteboards"]')).not.toBeNull();
});
it("deduplicates owner and latest editor and formats Today/Yesterday and older years", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 5, 14));
  expect(notepadUpdatedLabel(new Date(2026, 10, 5, 10).toISOString())).toBe("Today");
  expect(notepadUpdatedLabel(new Date(2026, 10, 4, 10).toISOString())).toBe("Yesterday");
  expect(notepadUpdatedLabel(new Date(2026, 9, 26, 10).toISOString())).toBe("Oct 26");
  expect(notepadUpdatedLabel(new Date(2025, 9, 26, 10).toISOString())).toBe("Oct 26, 2025");
  expect(notepadCollaborators({ ...page, updated_by: owner })).toBe("Ima");
  expect(notepadCollaborators({ ...page, updated_by: null, owner: null })).toBe("");
});
