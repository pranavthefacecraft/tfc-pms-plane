import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TaskCustomFields } from "./task-fields";

const mocks = vi.hoisted(() => ({
  fieldType: "date",
  value: "2025-06-01",
  setValue: vi.fn().mockResolvedValue(undefined),
  mutate: vi.fn().mockResolvedValue(undefined),
  fieldError: vi.fn(),
}));
vi.mock("@/hooks/use-live-task-updates", () => ({ useLiveTaskUpdates: vi.fn() }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: (props: { label: string; type?: "submit" | "button"; onClick?: () => void; disabled?: boolean }) => (
    <button type={props.type ?? "button"} aria-label={props.label} onClick={props.onClick} disabled={props.disabled}>
      {props.label}
    </button>
  ),
}));
vi.mock("swr", () => ({ default: () => ({ data: { date: mocks.value }, mutate: mocks.mutate }) }));
vi.mock("./service", () => ({
  useCustomFields: () => ({
    data: [{ id: "date", name: "Delivery date", field_type: mocks.fieldType, options: [] }],
    mutate: mocks.mutate,
  }),
  customFields: { values: vi.fn(), setValue: mocks.setValue },
  fieldError: mocks.fieldError,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  mocks.fieldType = "date";
  mocks.value = "2025-06-01";
  mocks.setValue.mockReset().mockResolvedValue(undefined);
  mocks.fieldError.mockClear();
});

it("synchronizes clean fields while retaining unsaved drafts and rejected saves", async () => {
  mocks.fieldType = "text";
  mocks.value = "Before";
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = () =>
    act(() =>
      root.render(<TaskCustomFields workspaceSlug="workspace" projectId="project" issueId="issue" disabled={false} />)
    );
  try {
    await render();
    mocks.value = "Remote change";
    await render();
    const input = host.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("Remote change");
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "My draft");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    mocks.value = "Another remote change";
    await render();
    expect(host.querySelector("input")).toBe(input);
    expect(input.value).toBe("My draft");
    mocks.setValue.mockRejectedValueOnce(new Error("Offline"));
    await act(() =>
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(mocks.fieldError).toHaveBeenCalled();
    expect(input.value).toBe("My draft");
    await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]')!.click());
    expect(input.value).toBe("Another remote change");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
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
