import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CreateWorkspaceForm } from "./create-workspace-form";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ createWorkspace: vi.fn() }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ back: vi.fn() }) }));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    workspaceSlugCheck = vi.fn();
  },
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
it("renders the organization size selector with an explicit input-matching border", async () => {
  await act(async () =>
    root.render(
      <CreateWorkspaceForm
        defaultValues={{ name: "", slug: "", organization_size: "" }}
        setDefaultValues={vi.fn()}
        showBackButton={false}
      />
    )
  );
  const trigger = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("workspace_creation.form.organization_size.placeholder")
  );
  expect(trigger).toBeDefined();
  expect(trigger?.classList.contains("border")).toBe(true);
  expect(trigger?.classList.contains("border-subtle-1")).toBe(true);
  expect(trigger?.classList.contains("w-full")).toBe(true);
  expect(host.querySelectorAll("input")).toHaveLength(2);
});
