/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlanUpgradeCardProps } from "@/components/license/modal/card/plan-upgrade";
import { PMSSettings } from "./settings";
import { InviteTeammateDialog } from "./invite-teammate-dialog";
import { PMSSettingsLink } from "@/components/workspace/sidebar/pms-settings-link";
import PMSSettingsPage from "@/app/(all)/[workspaceSlug]/(projects)/pms-settings/page";

const mocks = vi.hoisted(() => ({
  role: 20,
  infoLoaded: true,
  workspace: {
    name: "Test Company",
    website: "https://example.com",
    billing_email: "billing@example.com",
    timezone: "UTC",
    currency: "USD",
  },
  workspaceLoaded: true,
  updateWorkspace: vi.fn(),
  invite: vi.fn(),
  projectInvite: vi.fn(),
  refresh: vi.fn(),
  onClose: vi.fn(),
  pathname: "/team/pms-settings/account",
  error: undefined as Error | undefined,
  updateUser: vi.fn(),
  updateProfile: vi.fn(),
  profile: { start_of_the_week: 1 },
  profileLoading: false,
  profileError: undefined as { status: string; message: string } | undefined,
  user: { first_name: "Test", last_name: "Person", email: "test@example.com", user_timezone: "UTC" },
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "team" }),
  usePathname: () => mocks.pathname,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/core/content-wrapper", () => ({
  ContentWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({
    getWorkspaceBySlug: () => (mocks.workspaceLoaded ? mocks.workspace : null),
    updateWorkspace: mocks.updateWorkspace,
  }),
}));
vi.mock("@/components/global/timezone-select", () => ({
  TimezoneSelect: ({
    value,
    onChange,
    disabled,
    label,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    label: string;
  }) => (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      <option value="UTC">UTC</option>
      <option value="Asia/Makassar">Asia/Makassar</option>
    </select>
  ),
}));
vi.mock("@/components/license", () => ({
  FreePlanCard: ({ isOnFreePlan }: { isOnFreePlan: boolean }) => <div>{isOnFreePlan ? "Your plan: Free" : "Free"}</div>,
  PlanUpgradeCard: ({ planVariant, product, handleCheckout, extraFeatures }: PlanUpgradeCardProps) => (
    <div data-plan={planVariant}>
      {product?.prices.map((price) => (
        <button
          key={price.id}
          type="button"
          onClick={() => handleCheckout({ planVariant, productId: product.id, priceId: price.id })}
        >
          {`${planVariant} ${price.recurring}`}
        </button>
      ))}
      {extraFeatures}
    </div>
  ),
}));
vi.mock("@/components/settings/profile/content/pages/general", () => ({
  GeneralProfileSettings: () => <div>Existing profile form</div>,
}));
vi.mock("@/components/settings/profile/content/pages/security", () => ({
  SecurityProfileSettings: () => <div>Existing password form</div>,
}));
vi.mock("@/components/workspace/settings/members-list", () => ({
  WorkspaceMembersList: () => <div>Existing teammate list</div>,
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: mocks.user, updateCurrentUser: mocks.updateUser }),
  useUserProfile: () => ({
    data: mocks.profile,
    isLoading: mocks.profileLoading,
    error: mocks.profileError,
    updateUserProfile: mocks.updateProfile,
  }),
  useUserPermissions: () => ({
    workspaceInfoBySlug: () => (mocks.infoLoaded ? { role: mocks.role } : undefined),
    allowPermissions: (roles: number[]) => roles.includes(mocks.role),
  }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: { is_smtp_configured: true } }) }));
vi.mock("@/components/core/modals/change-email-modal", () => ({
  ChangeEmailModal: () => <div role="dialog">Verified email change</div>,
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    workspace: {
      inviteMembersToWorkspace: mocks.invite,
      fetchWorkspaceMembers: vi.fn(),
      fetchWorkspaceMemberInvitations: vi.fn(),
      getWorkspaceMemberIds: () => ["admin", "editor", "viewer", "inactive"],
      getWorkspaceMemberDetails: (id: string) => ({
        id,
        member: { first_name: id, last_name: "Person", email: `${id}@example.com` },
        role: id === "admin" ? 20 : id === "editor" ? 15 : 5,
        is_active: id !== "inactive",
      }),
    },
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    workspaceProjectIds: ["p1", "p2"],
    getPartialProjectById: (id: string) => ({
      id,
      name: id === "p1" ? "Website" : "Restricted",
      member_role: id === "p1" ? 20 : 15,
    }),
  }),
}));
vi.mock("@/services/project-collaborators.service", () => ({
  ProjectCollaboratorsService: class {
    invite = mocks.projectInvite;
  },
}));
vi.mock("swr", () => ({
  default: () => ({ data: [], isLoading: false, error: mocks.error, mutate: mocks.refresh }),
}));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({
    children,
    open = true,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" onClick={() => onOpenChange?.(false)}>
          Close dialog
        </button>
      </div>
    ) : null,
  DialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogMain: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.role = 20;
  mocks.infoLoaded = true;
  mocks.workspaceLoaded = true;
  mocks.workspace = {
    name: "Test Company",
    website: "https://example.com",
    billing_email: "billing@example.com",
    timezone: "UTC",
    currency: "USD",
  };
  mocks.updateWorkspace.mockImplementation(async (_slug, data) => {
    mocks.workspace = { ...mocks.workspace, ...data };
    return mocks.workspace;
  });
  mocks.error = undefined;
  mocks.pathname = "/team/pms-settings/account";
  mocks.invite.mockResolvedValue({});
  mocks.projectInvite.mockResolvedValue({ added: [], invited: ["test@example.com"] });
  mocks.refresh.mockResolvedValue([]);
  mocks.user = { first_name: "Test", last_name: "Person", email: "test@example.com", user_timezone: "UTC" };
  mocks.profile = { start_of_the_week: 1 };
  mocks.profileLoading = false;
  mocks.profileError = undefined;
  mocks.updateProfile.mockImplementation(async (data) => {
    mocks.profile = { ...mocks.profile, ...data };
    return mocks.profile;
  });
  mocks.updateUser.mockResolvedValue(mocks.user);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = (node: ReactNode) => act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
const button = (text: string) => [...host.querySelectorAll("button")].find((item) => item.textContent === text);
async function enter(selector: string, value: string) {
  const node = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  await act(() => {
    const prototype = node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLInputElement ? "input" : "change", { bubbles: true }));
  });
}
const submit = () =>
  act(() => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
const inviteDialog = () =>
  render(<InviteTeammateDialog workspaceSlug="team" onClose={mocks.onClose} onInvited={mocks.refresh} />);

it.each([20, 15])("shows unavailable connections and existing API access for role %s", async (role) => {
  mocks.role = role;
  await render(<PMSSettings workspaceSlug="team" tab="integrations" />);
  expect([...host.querySelectorAll("dt")].map((row) => row.textContent)).toEqual([
    "Google Calendar",
    "Microsoft Outlook",
    "Google Drive",
    "Microsoft OneDrive",
    "API access",
  ]);
  expect(
    [...host.querySelectorAll("dd")].slice(0, 4).every((row) => row.textContent === "Not available in this edition")
  ).toBe(true);
  expect(host.querySelector("button")).toBeNull();
  expect(host.querySelector('a[href="/settings/profile/api-tokens/"]')).not.toBeNull();
  expect(host.querySelector('a[href="/team/settings/integrations/"]') !== null).toBe(role === 20);
});
it("does not expose integrations to Guests and waits for workspace permissions", async () => {
  mocks.infoLoaded = false;
  await render(<PMSSettings workspaceSlug="team" tab="integrations" />);
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  mocks.infoLoaded = true;
  mocks.role = 5;
  await render(<PMSSettings workspaceSlug="team" tab="integrations" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Only workspace admins and members");
  expect(host.querySelector("dl")).toBeNull();
});
it("shows real preferences and links to existing personal settings", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  expect(host.textContent).toContain("Workspace-wide task defaults are not available");
  expect(host.textContent).toContain("Monday");
  expect(host.textContent).toContain("UTC");
  expect(host.querySelector('a[href="/settings/profile/notifications/"]')).not.toBeNull();
  expect(host.querySelector('a[href="/settings/profile/preferences/"]')).not.toBeNull();
  expect(host.querySelectorAll("button")).toHaveLength(2);
});
it("saves week start through the existing user-profile API", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Week starts on"]')!.click());
  await enter('select[aria-label="Week starts on"]', "0");
  await submit();
  expect(mocks.updateProfile).toHaveBeenCalledWith({ start_of_the_week: 0 });
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("Sunday");
});
it("saves personal time zone without changing the Company time zone", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Time zone"]')!.click());
  await enter('select[aria-label="Personal time zone"]', "Asia/Makassar");
  await submit();
  expect(mocks.updateUser).toHaveBeenCalledWith({ user_timezone: "Asia/Makassar" });
  expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  expect(mocks.updateProfile).not.toHaveBeenCalled();
});
it("cancels preference changes without saving", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Week starts on"]')!.click());
  await enter("select", "0");
  await act(() => button("Cancel")!.click());
  expect(mocks.updateProfile).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Monday");
});
it("retains the draft when the profile store silently returns an unsuccessful update", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.updateProfile.mockResolvedValueOnce(undefined);
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Week starts on"]')!.click());
  await enter("select", "0");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save preferences");
  expect(host.querySelector<HTMLSelectElement>("select")?.value).toBe("0");
  await submit();
  expect(host.querySelector("form")).toBeNull();
  log.mockRestore();
});
it("reports time-zone save errors and loading failures", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.updateUser.mockRejectedValueOnce(new Error("offline"));
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Time zone"]')!.click());
  await enter("select", "Asia/Makassar");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save preferences");
  mocks.profileError = { status: "user-profile-fetch-error", message: "offline" };
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load preferences");
  log.mockRestore();
});
it("shows explicit preference loading state", async () => {
  mocks.profileLoading = true;
  await render(<PMSSettings workspaceSlug="team" tab="preferences" />);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading preferences...");
});

it("renders full-page account settings with real profile and password surfaces and URL tabs", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  expect(host.querySelector("h1")?.textContent).toBe("Settings");
  expect(host.querySelector<HTMLInputElement>("#pms-account-name")?.value).toBe("Test Person");
  expect(host.querySelector<HTMLInputElement>("#pms-account-email")?.readOnly).toBe(true);
  expect(host.textContent).not.toContain("Existing profile form");
  expect(host.textContent).toContain("Two-step verification");
  expect(host.textContent).toContain("Login history unavailable");
  expect(host.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/team/pms-settings/account/");
  expect(host.querySelector('a[href="/team/pms-settings/teammates/"]')).not.toBeNull();
  expect(host.querySelector('a[href="/team/pms-settings/billing/"]')).not.toBeNull();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it("saves the name and cancels unsaved changes without writing email", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  await enter("#pms-account-name", "Updated Person");
  await submit();
  expect(mocks.updateUser).toHaveBeenCalledWith({ first_name: "Updated", last_name: "Person" });
  await enter("#pms-account-name", "Discard This");
  await act(() => button("Cancel")!.click());
  expect(host.querySelector<HTMLInputElement>("#pms-account-name")?.value).toBe("Test Person");
});
it("preserves multi-word first names and exposes the existing security and verified email controls", async () => {
  mocks.user = { first_name: "Test First", last_name: "Person", email: "test@example.com", user_timezone: "UTC" };
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  await enter("#pms-account-name", "New First Person");
  await submit();
  expect(mocks.updateUser).toHaveBeenCalledWith({ first_name: "New First", last_name: "Person" });
  await act(() => button("Change Password")!.click());
  expect(host.textContent).toContain("Existing password form");
  await act(() => button("Change email")!.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("Verified email change");
});
it("reports save failures and retains the unsaved name", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.updateUser.mockRejectedValueOnce(new Error("offline"));
  await render(<PMSSettings workspaceSlug="team" tab="account" />);
  await enter("#pms-account-name", "Updated Person");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
  expect(host.querySelector<HTMLInputElement>("#pms-account-name")?.value).toBe("Updated Person");
  log.mockRestore();
});
it.each(["account", "teammates", "billing", "company", "integrations", "preferences"])(
  "links the sidebar to settings and highlights %s",
  async (tab) => {
    mocks.pathname = `/team/pms-settings/${tab}`;
    await render(<PMSSettingsLink />);
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/team/pms-settings/account/");
    expect(host.querySelector("a")?.getAttribute("aria-current")).toBe("page");
  }
);
it.each([
  ["/team/pms-settings/billing", "Billing"],
  ["/team/pms-settings/company", "Company"],
  ["/team/pms-settings/integrations", "Integrations"],
  ["/team/pms-settings/preferences", "PMS Preferences"],
  ["/team/pms-settings", "Account"],
  ["/team/pms-settings/invalid", "Account"],
])("renders the settings route %s as %s", async (path, heading) => {
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:workspaceSlug/pms-settings/:settingsTab?" element={<PMSSettingsPage />} />
        </Routes>
      </MemoryRouter>
    )
  );
  expect(host.querySelector("h2")?.textContent).toBe(heading);
  expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe(heading);
});
it("shows saved company profile and regional details", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  expect(host.querySelector("h2")?.textContent).toBe("Company");
  expect(host.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/team/pms-settings/company/");
  expect([...host.querySelectorAll("dd")].map((row) => row.textContent)).toEqual([
    "Test CompanyChange",
    "https://example.comChange",
    "billing@example.comEdit",
    "UTCChange",
    "USDChange",
  ]);
});
it.each([
  ["name", "Change Company name", 'input[aria-label="Company name"]', "Updated Company"],
  ["website", "Change Website", 'input[aria-label="Website"]', "https://updated.example.com"],
  ["billing_email", "Edit Billing contact", 'input[aria-label="Billing contact"]', "updated@example.com"],
  ["timezone", "Change Time zone", 'select[aria-label="Company time zone"]', "Asia/Makassar"],
  ["currency", "Change Currency", 'input[aria-label="Currency"]', "idr"],
])("persists only the edited company %s field", async (field, action, selector, value) => {
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  await act(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${action}"]`)!.click());
  await enter(selector, value);
  await submit();
  const saved = field === "currency" ? "IDR" : value;
  expect(mocks.updateWorkspace).toHaveBeenCalledWith("team", { [field]: saved });
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain(saved);
});
it("cancels company edits without saving", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Company name"]')!.click());
  await enter('input[aria-label="Company name"]', "Unsaved");
  await act(() => button("Cancel")!.click());
  expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Test Company");
  expect(host.querySelector("form")).toBeNull();
});
it("retains company drafts and reports failed saves", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.updateWorkspace.mockRejectedValueOnce(new Error("offline"));
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Change Company name"]')!.click());
  await enter('input[aria-label="Company name"]', "Unsaved Company");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save company details");
  expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Unsaved Company");
  await submit();
  expect(host.querySelector("form")).toBeNull();
  log.mockRestore();
});
it("lets Editors view company details without edit controls and excludes Guests", async () => {
  mocks.role = 15;
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  expect(host.textContent).toContain("Test Company");
  expect(host.querySelector("button")).toBeNull();
  mocks.role = 5;
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Only workspace admins and members");
  expect(host.querySelector("dl")).toBeNull();
});
it("reports missing company data and waits for permissions", async () => {
  mocks.infoLoaded = false;
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Loading workspace permissions");
  mocks.infoLoaded = true;
  mocks.workspaceLoaded = false;
  await render(<PMSSettings workspaceSlug="team" tab="company" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
});
it.each([20, 15])("keeps Manage Plan disabled for billing with workspace role %s", async (role) => {
  mocks.role = role;
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  await render(<PMSSettings workspaceSlug="team" tab="billing" />);
  expect(host.querySelector("h2")?.textContent).toBe("Billing");
  expect(host.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/team/pms-settings/billing/");
  expect(host.textContent).toContain("Community");
  expect(host.textContent).toContain("No scheduled payment for Community");
  expect(host.querySelectorAll("dd")).toHaveLength(4);
  expect(
    [...host.querySelectorAll("dd")].slice(1, 3).every((row) => row.textContent === "Not available in Community")
  ).toBe(true);
  expect(host.querySelectorAll("dd")[3]?.textContent).toBe("billing@example.com");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  const managePlan = button("Manage Plan");
  expect(managePlan).toBeDefined();
  expect(managePlan?.disabled).toBe(true);
  await act(() => managePlan!.click());
  expect(open).not.toHaveBeenCalled();
  expect(host.querySelectorAll("[data-plan]")).toHaveLength(0);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  open.mockRestore();
});
it("does not expose billing plan actions while permissions load or to guests", async () => {
  mocks.infoLoaded = false;
  await render(<PMSSettings workspaceSlug="team" tab="billing" />);
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Loading workspace permissions");
  expect(button("Manage Plan")).toBeUndefined();
  mocks.infoLoaded = true;
  mocks.role = 5;
  await render(<PMSSettings workspaceSlug="team" tab="billing" />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Only workspace admins and members");
  expect(button("Manage Plan")).toBeUndefined();
});
it("shows teammates and opens the invite form for admins", async () => {
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  expect(host.textContent).toContain("Existing teammate list");
  const list = host.querySelector('ul[aria-label="People with access"]');
  expect(list?.querySelectorAll("li")).toHaveLength(3);
  expect(list?.textContent).toContain("admin@example.com");
  expect(list?.textContent).toContain("Admin");
  expect(list?.textContent).toContain("Editor");
  expect(list?.textContent).toContain("Viewer");
  expect(list?.textContent).not.toContain("inactive@example.com");
  expect(host.querySelector('input[aria-label="Search teammates"]')?.closest("details")).not.toBeNull();
  await act(() => button("Invite Teammates")!.click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
});
it("lets editors open the invite popup and send workspace invitations", async () => {
  mocks.role = 15;
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  await act(() => button("Invite Teammates")!.click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await enter('input[type="email"]', "test@example.com");
  await submit();
  expect(mocks.invite).toHaveBeenCalledWith("team", { emails: [{ email: "test@example.com", role: 15 }] });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it("does not offer invitations or the teammate list to guests", async () => {
  mocks.role = 5;
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  expect(button("Invite Teammates")).toBeUndefined();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Only workspace admins and members");
  expect(host.textContent).not.toContain("Existing teammate list");
});
it("shows a retry action when loading teammates fails", async () => {
  mocks.error = new Error("offline");
  await render(<PMSSettings workspaceSlug="team" tab="teammates" />);
  await act(() => button("Retry")!.click());
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("invites to the workspace with the chosen role", async () => {
  await inviteDialog();
  await enter('input[type="email"]', "test@example.com");
  await enter("select", "5");
  await submit();
  expect(mocks.invite).toHaveBeenCalledWith("team", { emails: [{ email: "test@example.com", role: 5 }] });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.onClose).toHaveBeenCalledOnce();
});
it("offers only administered projects and invites using the project access endpoint", async () => {
  await inviteDialog();
  expect(host.textContent).not.toContain("Restricted");
  await enter('input[type="email"]', "test@example.com");
  await enter("label:last-of-type select", "p1");
  await submit();
  expect(mocks.projectInvite).toHaveBeenCalledWith("team", "p1", [{ email: "test@example.com", role: 15 }]);
  expect(mocks.invite).not.toHaveBeenCalled();
});
it("does not send an invitation again if refreshing fails after sending", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.refresh.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
  await inviteDialog();
  await enter('input[type="email"]', "test@example.com");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("invitation was sent");
  await submit();
  expect(mocks.invite).toHaveBeenCalledOnce();
  expect(mocks.onClose).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
