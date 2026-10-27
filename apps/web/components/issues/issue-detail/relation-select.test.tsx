import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IssueRelationSelect } from "./relation-select";

const state = vi.hoisted(() => ({
  remove: vi.fn().mockResolvedValue(undefined),
  toggle: vi.fn(),
  setKey: vi.fn(),
  disabledMobile: false,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => <span title={label}>{children}</span>,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/core/modals/existing-issues-list-modal", () => ({ ExistingIssuesListModal: () => null }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    createRelation: vi.fn(),
    removeRelation: state.remove,
    relation: { getRelationByIssueIdRelationType: () => ["related"] },
    isRelationModalOpen: null,
    toggleRelationModal: state.toggle,
    setRelationKey: state.setKey,
  }),
}));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issueMap: {
      related: { id: "related", project_id: "project", name: "Create logo", sequence_id: 3 },
    },
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ id: "project", identifier: "MICROSOFT" }) }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: state.disabledMobile }) }));
vi.mock("@/components/relations", () => ({ useTimeLineRelationOptions: () => ({}) }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
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

it.each(["blocked_by", "blocking"] as const)(
  "shows task names for %s and preserves removal and links",
  async (relationKey) => {
    await act(() =>
      root.render(
        <IssueRelationSelect workspaceSlug="workspace" projectId="project" issueId="banner" relationKey={relationKey} />
      )
    );
    const link = host.querySelector("a")!;
    expect(link.textContent).toBe("Create logo");
    expect(link.getAttribute("href")).toBe("/workspace/browse/MICROSOFT-3/");
    expect(link.parentElement?.title).toBe("MICROSOFT-3: Create logo");
    await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="common.remove Create logo"]')!.click());
    expect(state.remove).toHaveBeenCalledWith("workspace", "project", "banner", relationKey, "related");
  }
);

it("keeps dependency names visible for read-only users without removal controls", async () => {
  await act(() =>
    root.render(
      <IssueRelationSelect
        workspaceSlug="workspace"
        projectId="project"
        issueId="banner"
        relationKey="blocked_by"
        disabled
      />
    )
  );
  expect(host.querySelector("a")!.textContent).toBe("Create logo");
  expect(host.querySelector("button")).toBeNull();
});
