import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IssueParentSelect } from "./parent-select";

const state = vi.hoisted(() => ({
  parentId: "banner" as string | null,
  projectLoaded: true,
  toggle: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => <span title={label}>{children}</span>,
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: {
      getIssueById: (id: string) =>
        id === "logo"
          ? { id, parent_id: state.parentId }
          : { id: "banner", name: "Create banner", project_id: "project", sequence_id: 4 },
    },
    isParentIssueModalOpen: null,
    toggleParentIssueModal: state.toggle,
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getProjectById: () => (state.projectLoaded ? { identifier: "MICROSOFT" } : undefined),
  }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("../parent-issues-list-modal", () => ({ ParentIssuesListModal: () => null }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const remove = vi.fn().mockResolvedValue(undefined);
const assign = vi.fn().mockResolvedValue(undefined);
const render = (disabled = false) =>
  root.render(
    <IssueParentSelect
      workspaceSlug="workspace"
      projectId="project"
      issueId="logo"
      workItemLink="/workspace/projects/project/issues/banner"
      handleRemoveSubIssue={remove}
      handleParentIssue={assign}
      disabled={disabled}
    />
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.parentId = "banner";
  state.projectLoaded = true;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it.each([true, false])("shows the parent name with project metadata loaded=%s", async (loaded) => {
  state.projectLoaded = loaded;
  await act(() => render());
  const link = host.querySelector("a")!;
  expect(link.textContent).toBe("Create banner");
  expect(link.getAttribute("href")).toBe("/workspace/projects/project/issues/banner");
  expect(link.parentElement?.title).toBe(loaded ? "MICROSOFT-4: Create banner" : "Create banner");
  await act(() => link.click());
  expect(state.toggle).not.toHaveBeenCalled();
});

it("preserves removing the parent without opening the selection dialog", async () => {
  await act(() => render());
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="common.remove"]')!.click());
  expect(remove).toHaveBeenCalledWith("workspace", "project", "banner", "logo");
  expect(state.toggle).not.toHaveBeenCalled();
});

it("uses separate native buttons for selecting and removing the parent", async () => {
  await act(() => render());
  const control = host.querySelector<HTMLButtonElement>('button[aria-label="common.remove"]')!;
  expect(control.type).toBe("button");
  expect(control.closest("button button")).toBeNull();
  expect(host.querySelector("button a")).toBeNull();
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="issue.add.parent"]')!.click());
  expect(state.toggle).toHaveBeenCalledWith("logo");
});

it("preserves the empty parent prompt", async () => {
  state.parentId = null;
  await act(() => render());
  expect(host.textContent).toContain("issue.add.parent");
  expect(host.querySelector("a")).toBeNull();
  await act(() => host.querySelector("button")!.click());
  expect(state.toggle).toHaveBeenCalledWith("logo");
});

it("shows the parent name in read-only mode without removal controls", async () => {
  await act(() => render(true));
  expect(host.querySelector("a")!.textContent).toBe("Create banner");
  expect(host.querySelector("button")!.disabled).toBe(true);
  expect(host.querySelector('span[title="common.remove"]')).toBeNull();
});
