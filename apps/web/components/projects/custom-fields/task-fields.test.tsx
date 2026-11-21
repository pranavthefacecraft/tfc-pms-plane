import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TaskCustomFields } from "./task-fields";

const mocks = vi.hoisted(() => ({
  fieldType: "date",
  value: "2025-06-01",
  fieldName: "Delivery date",
  options: [] as { id: string; name: string; color: string }[],
  setValue: vi.fn().mockResolvedValue(undefined),
  mutate: vi.fn().mockResolvedValue(undefined),
  fieldError: vi.fn(),
}));
vi.mock("@/hooks/use-live-task-updates", () => ({ useLiveTaskUpdates: vi.fn() }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "None" }) }));
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
    data: [{ id: "date", name: mocks.fieldName, field_type: mocks.fieldType, options: mocks.options }],
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
  mocks.fieldName = "Delivery date";
  mocks.options = [];
  mocks.setValue.mockReset().mockResolvedValue(undefined);
  mocks.fieldError.mockClear();
});

it.each([
  { fieldName: "Stage", selected: "In Progress", showsChevron: false },
  { fieldName: "Status", selected: "Blocked", showsChevron: true },
])(
  "renders the drawer $fieldName value in a compact menu and saves a configured selection",
  async ({ fieldName, selected, showsChevron }) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    const animationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
    Reflect.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
    mocks.fieldName = fieldName;
    mocks.fieldType = "single_select";
    mocks.value = "current";
    mocks.options = [
      { id: "current", name: selected, color: "#000000" },
      { id: "next", name: "Done", color: "#000000" },
    ];
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = (disabled: boolean) =>
      act(() =>
        root.render(
          <TaskCustomFields
            workspaceSlug="workspace"
            projectId="project"
            issueId="issue"
            disabled={disabled}
            primaryGroup={{ names: ["stage", "status"], after: null }}
          />
        )
      );
    try {
      await render(false);
      const trigger = host.querySelector("button");
      expect(trigger?.getAttribute("aria-label")).toBe(`${fieldName}: ${selected}`);
      expect(trigger?.textContent).toBe(selected);
      expect(!!trigger?.querySelector("svg")).toBe(showsChevron);
      expect(trigger?.querySelector("span")?.classList.contains("rounded-full")).toBe(showsChevron);
      await act(() => trigger?.click());
      const done = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((item) =>
        item.textContent?.includes("Done")
      );
      expect(done).toBeDefined();
      await act(() => done?.click());
      expect(mocks.setValue).toHaveBeenCalledWith("workspace", "project", "issue", "date", "next");
      await render(true);
      expect(host.querySelector("button")).toBeNull();
      expect(host.textContent).toContain(selected);
    } finally {
      await act(() => root.unmount());
      host.remove();
      if (animationsDescriptor) Reflect.defineProperty(Element.prototype, "getAnimations", animationsDescriptor);
      else Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  },
  15_000
);

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
