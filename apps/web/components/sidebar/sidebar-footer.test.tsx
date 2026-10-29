import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarFooter } from "./sidebar-footer";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), toast: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ signOut: mocks.signOut }) }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<SidebarFooter />));
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("links to Help Center in a safe new tab and pins the footer below navigation", () => {
  const link = host.querySelector("a");
  expect(link?.textContent).toBe("Help Center");
  expect(link?.getAttribute("href")).toBe("https://docs.plane.so/");
  expect(link?.target).toBe("_blank");
  expect(link?.rel).toBe("noopener noreferrer");
  expect(host.firstElementChild?.classList.contains("mt-auto")).toBe(true);
});

it("uses the existing sign-out action and prevents duplicate requests while pending", async () => {
  let finish: (() => void) | undefined;
  mocks.signOut.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const button = host.querySelector("button");
  expect(button?.classList.contains("text-[#D50000]")).toBe(true);
  expect(button?.querySelector("svg")?.getAttribute("stroke")).toBe("currentColor");
  await act(() => button?.click());
  expect(button?.disabled).toBe(true);
  await act(() => button?.click());
  expect(mocks.signOut).toHaveBeenCalledOnce();
  await act(async () => finish?.());
  expect(button?.disabled).toBe(false);
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("surfaces sign-out failures and allows retry", async () => {
  mocks.signOut.mockRejectedValue(new Error("Network error"));
  await act(() => host.querySelector("button")?.click());
  expect(mocks.toast).toHaveBeenCalledWith({
    type: "error",
    title: "auth.sign_out.toast.error.title",
    message: "auth.sign_out.toast.error.message",
  });
  expect(host.querySelector("button")?.disabled).toBe(false);
});
