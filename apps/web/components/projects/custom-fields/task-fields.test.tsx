import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TaskCustomFields } from "./task-fields";

vi.mock("swr", () => ({ default: () => ({ data: { date: "2025-06-01" }, mutate: vi.fn() }) }));
vi.mock("./service", () => ({
  useCustomFields: () => ({
    data: [{ id: "date", name: "Delivery date", field_type: "date", options: [] }],
  }),
  customFields: { values: vi.fn(), setValue: vi.fn() },
  fieldError: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("preserves an existing past value while rejecting a new past date in the native calendar", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2025, 5, 15, 23, 30));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() =>
      root.render(<TaskCustomFields workspaceSlug="workspace" projectId="project" issueId="issue" disabled={false} />)
    );
    const input = host.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input?.value).toBe("2025-06-01");
    expect(input?.min).toBe("2025-06-15");
    if (!input) throw new Error("Date input missing");
    input.value = "2025-06-14";
    expect(input.validity.rangeUnderflow).toBe(true);
    input.value = "2025-06-15";
    expect(input.checkValidity()).toBe(true);
    input.value = "";
    expect(input.checkValidity()).toBe(true);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
