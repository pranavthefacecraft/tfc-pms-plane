import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TaskDateField } from "./task-date-field";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
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

it("opens from the date text, respects bounds, and returns a date-only value", async () => {
  const change = vi.fn();
  await act(() =>
    root.render(
      <TaskDateField
        label="Due date"
        value="2026-11-02"
        min="2026-11-02"
        max="2026-11-10"
        disabled={false}
        onChange={change}
      />
    )
  );
  const text = Array.from(host.querySelectorAll("span")).find((item) => item.textContent === "02 Nov 2026")!;
  await act(() => text.click());
  const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button"));
  const day = (date: string) => buttons.find((button) => button.getAttribute("aria-label")?.includes(date))!;
  expect(day("November 1st, 2026").disabled).toBe(true);
  expect(day("November 11th, 2026").disabled).toBe(true);
  await act(() => day("November 5th, 2026").click());
  expect(change).toHaveBeenCalledWith("2026-11-05");
});

it("supports clearing and prevents opening while saving", async () => {
  const change = vi.fn();
  const render = (disabled: boolean) =>
    act(() => root.render(<TaskDateField label="Due date" value="2026-11-02" disabled={disabled} onChange={change} />));
  await render(true);
  expect(host.querySelector("button")?.disabled).toBe(true);
  await render(false);
  await act(() => host.querySelector("button")!.click());
  const clear = Array.from(document.body.querySelectorAll("button")).find(
    (button) => button.textContent === "Clear due date"
  )!;
  await act(() => clear.click());
  expect(change).toHaveBeenCalledWith(null);
});
