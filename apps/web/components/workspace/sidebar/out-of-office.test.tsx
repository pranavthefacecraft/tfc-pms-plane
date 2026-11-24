import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TOutOfOffice } from "@plane/types";
import { isOutOfOffice, OutOfOfficeDialog, OutOfOfficeStatus, profileDate } from "./out-of-office";

const state = vi.hoisted(() => ({
  schedule: null as TOutOfOffice | null,
  save: vi.fn(),
  close: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { user_timezone: "Asia/Kolkata" } }),
  useUserProfile: () => ({ data: { out_of_office: state.schedule }, updateUserProfile: state.save }),
}));
vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.schedule = { start_date: "2026-11-23", end_date: "2026-11-25", message: "Back Thursday" };
  state.save.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const button = (label: string) => [...document.querySelectorAll("button")].find((node) => node.textContent === label)!;
async function submit() {
  await act(() =>
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
}
it("uses the profile timezone and inclusive start/end dates without marking future or expired ranges active", () => {
  const now = new Date("2026-11-23T23:30:00Z");
  expect(profileDate("Asia/Kolkata", now)).toBe("2026-11-24");
  expect(profileDate("America/Los_Angeles", now)).toBe("2026-11-23");
  expect(isOutOfOffice(state.schedule, "2026-11-23")).toBe(true);
  expect(isOutOfOffice(state.schedule, "2026-11-25")).toBe(true);
  expect(isOutOfOffice(state.schedule, "2026-11-22")).toBe(false);
  expect(isOutOfOffice(state.schedule, "2026-11-26")).toBe(false);
  expect(isOutOfOffice(null, "2026-11-24")).toBe(false);
});
it("saves the date range and optional message through the profile API", async () => {
  await act(() => root.render(<OutOfOfficeDialog onClose={state.close} />));
  expect(host.querySelectorAll("input")).toHaveLength(2);
  expect(host.textContent).toContain("Asia/Kolkata");
  await submit();
  expect(state.save).toHaveBeenCalledWith({ out_of_office: state.schedule });
  expect(state.close).toHaveBeenCalledOnce();
});
it("keeps the form and draft open on unsuccessful saves and supports retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.save.mockResolvedValueOnce(undefined);
  await act(() => root.render(<OutOfOfficeDialog onClose={state.close} />));
  await submit();
  expect(state.close).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("draft is retained");
  expect(host.querySelector("textarea")?.value).toBe("Back Thursday");
  await submit();
  expect(state.close).toHaveBeenCalledOnce();
});
it("clears saved dates without overwriting other profile preferences", async () => {
  await act(() => root.render(<OutOfOfficeDialog onClose={state.close} />));
  await act(() => button("Clear dates").click());
  expect(state.save).toHaveBeenCalledWith({ out_of_office: null });
  expect(state.close).toHaveBeenCalledOnce();
});
it("rejects a reversed date range without calling the API", async () => {
  state.schedule = { start_date: "2026-11-25", end_date: "2026-11-23", message: "" };
  await act(() => root.render(<OutOfOfficeDialog onClose={state.close} />));
  await submit();
  expect(state.save).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("end date");
});
it("shows only the active profile status and message", async () => {
  const today = profileDate("Asia/Kolkata");
  state.schedule = { start_date: today, end_date: today, message: "Away today" };
  await act(() => root.render(<OutOfOfficeStatus />));
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Out of office: Away today");
  state.schedule = null;
  await act(() => root.render(<OutOfOfficeStatus key="cleared" />));
  expect(host.querySelector('[role="status"]')).toBeNull();
});
