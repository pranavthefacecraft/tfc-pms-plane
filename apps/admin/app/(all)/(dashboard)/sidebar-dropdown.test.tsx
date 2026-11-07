import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminSidebarDropdown } from "./sidebar-dropdown";

const mocks = vi.hoisted(() => ({ collapsed: false }));
vi.mock("@/hooks/store", () => ({
  useTheme: () => ({ isSidebarCollapsed: mocks.collapsed }),
  useUser: () => ({
    currentUser: { email: "admin@example.test", display_name: "Admin" },
    signOut: vi.fn(),
  }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));
vi.mock("@plane/services", () => ({
  AuthService: class {
    requestCSRFToken = async () => ({ csrf_token: "test-csrf" });
  },
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  // jsdom does not implement the Web Animations API used by the menu.
  // eslint-disable-next-line eslint/no-extend-native
  Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  mocks.collapsed = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  vi.unstubAllGlobals();
});

it("uses the PMS lockup instead of the old icon and title while preserving the account menu and sign-out form", async () => {
  await act(() => root.render(<AdminSidebarDropdown />));
  const logo = host.querySelector<HTMLImageElement>('img[alt="PMS by Clevdex"]')!;
  expect(logo.getAttribute("src")).toContain("clevdex-pms-lockup.svg");
  expect(logo.className).toContain("w-36");
  expect(host.querySelector("h4")).toBeNull();
  expect(host.querySelector('[aria-label="Account menu"]')).not.toBeNull();
  expect(host.querySelector("form")?.getAttribute("action")).toMatch(/\/api\/instances\/admins\/sign-out\/$/);
  expect(host.querySelector<HTMLInputElement>('[name="csrfmiddlewaretoken"]')?.value).toBe("test-csrf");
});

it("keeps the instance menu available with a compact logo when collapsed", async () => {
  mocks.collapsed = true;
  await act(() => root.render(<AdminSidebarDropdown />));
  expect(host.querySelector('img[alt="PMS by Clevdex"]')?.className).toContain("w-9");
  expect(host.querySelector('[aria-label="Account menu"]')).toBeNull();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Instance admin menu"]')!.click());
  expect(document.body.textContent).toContain("Sign out");
  expect(document.body.textContent).toContain("Switch to dark mode");
});
