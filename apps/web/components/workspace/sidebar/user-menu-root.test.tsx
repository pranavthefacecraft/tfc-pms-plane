import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UserMenuRoot } from "./user-menu-root";

const user = vi.hoisted(() => ({ first_name: "Pranav", display_name: "Creative", email: "user@example.com" }));
const actions = vi.hoisted(() => ({
  push: vi.fn(),
  settings: undefined as (() => void) | undefined,
  updateProfile: vi.fn(),
  creationDisabled: false,
  noWorkspace: false,
  signOut: vi.fn(),
  toggleDropdown: vi.fn(),
}));
const workspaces = {
  team: { id: "team-id", slug: "team", name: "Team" },
  studio: { id: "studio-id", slug: "studio", name: "Personal Studio" },
};
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: user, signOut: actions.signOut }),
  useUserProfile: () => ({ updateUserProfile: actions.updateProfile }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ currentWorkspace: actions.noWorkspace ? null : workspaces.team, workspaces }),
}));
vi.mock("@/hooks/store/use-instance", () => ({
  useInstance: () => ({ config: { is_workspace_creation_disabled: actions.creationDisabled } }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleAnySidebarDropdown: actions.toggleDropdown }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleProfileSettingsModal: vi.fn() }),
}));
vi.mock("@/components/common/cover-image", () => ({ CoverImage: () => null }));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-open={open}>
      {children}
      <button onClick={() => onOpenChange(true)}>Open profile menu</button>
    </div>
  ),
  MenuTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  MenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  MenuItem: ({ label, onClick, render }: { label: string; onClick: () => void; render?: ReactNode }) => {
    if (label === "Profile & Preferences") actions.settings = onClick;
    return (
      <div>
        {render}
        <button onClick={onClick}>{label}</button>
      </div>
    );
  },
}));
vi.mock("@base-ui/react/menu", () => ({
  Menu: {
    Item: ({
      children,
      onClick,
      disabled,
      "aria-current": current,
    }: {
      children: ReactNode;
      onClick: () => void;
      disabled: boolean;
      "aria-current"?: "page";
    }) => (
      <button role="menuitem" onClick={onClick} disabled={disabled} aria-current={current}>
        {children}
      </button>
    ),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  actions.creationDisabled = false;
  actions.noWorkspace = false;
  actions.updateProfile.mockResolvedValue({});
  actions.signOut.mockResolvedValue(undefined);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("opens the full PMS Settings page from the user menu", () => {
  renderToStaticMarkup(
    <MemoryRouter>
      <UserMenuRoot />
    </MemoryRouter>
  );
  actions.settings?.();
  expect(actions.push).toHaveBeenCalledWith("/team/pms-settings/account");
});

it.each([
  ["Pranav", "Creative", "P"],
  ["", "Creative", "C"],
  ["", "", "U"],
])("renders the initial instead of the avatar for %s / %s", (firstName, displayName, initial) => {
  user.first_name = firstName;
  user.display_name = displayName;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <UserMenuRoot showInitial />
    </MemoryRouter>
  );
  const trigger = host.querySelector("button");
  expect(trigger?.textContent).toBe(initial);
  expect(trigger?.querySelector("span")?.classList.contains("bg-[#135DDD]")).toBe(true);
  expect(trigger?.querySelector("span")?.classList.contains("text-white")).toBe(true);
  expect(trigger?.querySelector("img")).toBeNull();
  expect(trigger?.getAttribute("aria-label")).toBe("aria_labels.projects_sidebar.open_user_menu");
});

it("lists actual workspaces with the current workspace first, creation and invitations", () => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <UserMenuRoot showInitial />
    </MemoryRouter>
  );
  const items = host.querySelectorAll('[role="menuitem"]');
  expect(items).toHaveLength(2);
  expect(items[0]?.textContent).toBe("TeamCurrent account");
  expect(items[0]?.getAttribute("aria-current")).toBe("page");
  expect(items[1]?.textContent).toBe("Personal StudioSwitch account");
  expect(host.querySelector('a[href="/create-workspace/"]')).not.toBeNull();
  expect(host.querySelector('a[href="/invitations/"]')).not.toBeNull();
  expect(host.querySelector('a[href="/team/all-accounts-activity/"]')).not.toBeNull();
});
it("respects disabled workspace creation and falls back outside a workspace", () => {
  actions.creationDisabled = true;
  actions.noWorkspace = true;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <UserMenuRoot />
    </MemoryRouter>
  );
  expect(host.querySelector('a[href="/create-workspace/"]')).toBeNull();
  actions.settings?.();
  expect(actions.push).toHaveBeenCalledWith("/settings/profile/general");
});
it("persists workspace selection before navigating and prevents concurrent switches", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let complete!: (value: object) => void;
  actions.updateProfile.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  try {
    await act(() =>
      root.render(
        <MemoryRouter>
          <UserMenuRoot showInitial />
        </MemoryRouter>
      )
    );
    await act(() =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Open profile menu")!.click()
    );
    await act(() => host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]!.click());
    expect(actions.updateProfile).toHaveBeenCalledWith({ last_workspace_id: "studio-id" });
    expect(actions.push).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Switching workspace...");
    expect([...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].every((item) => item.disabled)).toBe(
      true
    );
    await act(() => complete({}));
    expect(actions.push).toHaveBeenCalledWith("/studio");
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector("[data-open]")?.getAttribute("data-open")).toBe("false");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
it.each(["reject", "undefined"])(
  "reports unsuccessful workspace selection (%s) without navigating",
  async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (failure === "reject") actions.updateProfile.mockRejectedValueOnce(new Error("offline"));
    else actions.updateProfile.mockResolvedValueOnce(undefined);
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(
          <MemoryRouter>
            <UserMenuRoot showInitial />
          </MemoryRouter>
        )
      );
      await act(() =>
        [...host.querySelectorAll("button")].find((button) => button.textContent === "Open profile menu")!.click()
      );
      await act(() => host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]!.click());
      expect(actions.push).not.toHaveBeenCalled();
      expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not switch workspace");
      expect(host.querySelector("[data-open]")?.getAttribute("data-open")).toBe("true");
      await act(() => host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]!.click());
      expect(actions.push).toHaveBeenCalledWith("/studio");
      expect(host.querySelector('[role="alert"]')).toBeNull();
      expect(host.querySelector("[data-open]")?.getAttribute("data-open")).toBe("false");
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  }
);
it("does not rewrite workspace preference when choosing the current workspace", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(
        <MemoryRouter>
          <UserMenuRoot showInitial />
        </MemoryRouter>
      )
    );
    await act(() => host.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click());
    expect(actions.updateProfile).not.toHaveBeenCalled();
    expect(actions.push).not.toHaveBeenCalled();
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
