import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions } from "@plane/constants";
import { UserProfileHeader } from "@/app/(all)/[workspaceSlug]/(projects)/profile/[userId]/header";

const state = vi.hoisted(() => ({
  role: 20,
  userId: "me",
  currentUserId: "me" as string | undefined,
  projects: ["project"],
  permissionLoaded: true,
  mutate: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", userId: state.userId }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate: state.mutate }) }));
vi.mock("@/components/profile/personal-task-dialog", () => ({
  PersonalTaskDialog: ({
    canCreateProjectTask,
    onProjectTask,
  }: {
    canCreateProjectTask: boolean;
    onProjectTask: (data: {
      name: string;
      description: string;
      priority: "none";
      start_date: null;
      target_date: null;
    }) => void;
  }) => (
    <div data-testid="personal-dialog">
      No project · Private to you
      <button
        disabled={!canCreateProjectTask}
        onClick={() =>
          onProjectTask({
            name: "Keep title",
            description: "<script>unsafe</script>",
            priority: "none",
            start_date: null,
            target_date: null,
          })
        }
      >
        Create in a project instead
      </button>
    </div>
  ),
}));
vi.mock("@/components/issues/issue-modal/modal", () => ({
  CreateUpdateIssueModal: ({ data }: { data: { name: string; description_html: string } }) => (
    <div data-testid="project-dialog">
      {data.name}
      {data.description_html}
    </div>
  ),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleProfileSidebar: vi.fn(), profileSidebarCollapsed: true }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ joinedProjectIds: state.projects }) }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: state.currentUserId ? { id: state.currentUserId } : undefined }),
  useUserPermissions: () => ({
    workspaceUserInfo: state.permissionLoaded ? {} : undefined,
    allowPermissions: (roles: number[]) => roles.includes(state.role),
  }),
}));
vi.mock("@/components/profile/profile-issues-filter", () => ({
  ProfileIssuesFilter: () => <div data-testid="profile-filters" />,
}));
vi.mock("@/components/common/breadcrumb-link", () => ({
  BreadcrumbLink: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("@plane/blocks/layout", () => ({
  Header: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    LeftItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    RightItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
}));
vi.mock("@plane/blocks/breadcrumb", () => ({
  Breadcrumbs: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Item: ({ component }: { component: ReactNode }) => component,
  }),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.role = EUserPermissions.MEMBER;
  state.userId = "me";
  state.currentUserId = "me";
  state.projects = ["project"];
  state.permissionLoaded = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = (showProfileIssuesFilter = true) =>
  act(() =>
    root.render(<UserProfileHeader userProjectsData={undefined} showProfileIssuesFilter={showProfileIssuesFilter} />)
  );
const addButton = () =>
  Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("add_work_item"));

it.each([EUserPermissions.ADMIN, EUserPermissions.MEMBER])(
  "opens private task creation for role %s on Your work",
  async (role) => {
    state.role = role;
    await render();
    expect(addButton()).toBeDefined();
    expect(addButton()!.disabled).toBe(false);
    await act(() => addButton()!.click());
    expect(host.querySelector('[data-testid="personal-dialog"]')?.textContent).toContain("No project");
    expect(host.querySelector('[data-testid="profile-filters"]')).not.toBeNull();
  }
);

it("allows personal tasks without joined projects but disables project creation", async () => {
  state.projects = [];
  await render();
  expect(addButton()!.disabled).toBe(false);
  await act(() => addButton()!.click());
  expect(host.querySelector<HTMLButtonElement>('[data-testid="personal-dialog"] button')!.disabled).toBe(true);
});

it("switches to project creation without losing text or injecting HTML", async () => {
  await render();
  await act(() => addButton()!.click());
  await act(() => host.querySelector<HTMLButtonElement>('[data-testid="personal-dialog"] button')!.click());
  expect(host.querySelector('[data-testid="personal-dialog"]')).toBeNull();
  expect(host.querySelector('[data-testid="project-dialog"]')?.textContent).toContain("Keep title");
  expect(host.querySelector('[data-testid="project-dialog"]')?.textContent).toContain("&lt;script&gt;");
});

it.each([EUserPermissions.GUEST, -1])("hides task creation for unauthorized role %s", async (role) => {
  state.role = role;
  await render();
  expect(addButton()).toBeUndefined();
});

it("does not show Your work creation on another user's profile", async () => {
  state.userId = "someone-else";
  await render();
  expect(addButton()).toBeUndefined();
});

it("does not show task creation on Summary or Activity", async () => {
  await render(false);
  expect(addButton()).toBeUndefined();
  expect(host.querySelector('[data-testid="profile-filters"]')).toBeNull();
});

it("does not show task creation before the current user loads", async () => {
  state.currentUserId = undefined;
  await render();
  expect(addButton()).toBeUndefined();
});

it("does not render the header before workspace permissions load", async () => {
  state.permissionLoaded = false;
  await render();
  expect(host.textContent).toBe("");
  expect(addButton()).toBeUndefined();
});
