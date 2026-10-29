import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { UserMenuRoot } from "./user-menu-root";

const user = vi.hoisted(() => ({ first_name: "Pranav", display_name: "Creative", email: "user@example.com" }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: user, signOut: vi.fn() }) }));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({ toggleAnySidebarDropdown: vi.fn() }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleProfileSettingsModal: vi.fn() }),
}));
vi.mock("@/components/common/cover-image", () => ({ CoverImage: () => null }));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <>{children}</>,
  MenuTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  MenuContent: () => null,
  MenuItem: () => null,
}));

it.each([
  ["Pranav", "Creative", "P"],
  ["", "Creative", "C"],
  ["", "", "U"],
])("renders the initial instead of the avatar for %s / %s", (firstName, displayName, initial) => {
  user.first_name = firstName;
  user.display_name = displayName;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<UserMenuRoot showInitial />);
  const trigger = host.querySelector("button");
  expect(trigger?.textContent).toBe(initial);
  expect(trigger?.querySelector("span")?.classList.contains("bg-[#135DDD]")).toBe(true);
  expect(trigger?.querySelector("span")?.classList.contains("text-white")).toBe(true);
  expect(trigger?.querySelector("img")).toBeNull();
  expect(trigger?.getAttribute("aria-label")).toBe("aria_labels.projects_sidebar.open_user_menu");
});
