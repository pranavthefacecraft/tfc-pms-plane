import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { AddSection } from "./add-section";
import { SectionSelect } from "./section-select";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({
  role: 20,
  archived: false,
  layout: "list",
  loadError: false,
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
  fetch: vi.fn(),
  updateFilters: vi.fn(),
  fetchIssues: vi.fn(),
  toast: vi.fn(),
  permissions: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  EmojiPicker: ({
    label,
    onChange,
    disabled,
  }: {
    label: ReactNode;
    disabled: boolean;
    onChange: (value: { type: "icon"; value: { name: string; color: string } }) => void;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange({ type: "icon", value: { name: "palette", color: "#ff0088" } })}
    >
      {label}
    </button>
  ),
  Logo: ({ logo }: { logo: { icon: { name: string; color: string } } }) => (
    <span data-section-icon={logo.icon.name} style={{ color: logo.icon.color }} />
  ),
}));
vi.mock("swr", () => ({ default: () => ({ error: state.loadError, mutate: state.retry }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({}) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROJECT" }));
vi.mock("@/hooks/use-issues-actions", () => ({
  useIssuesActions: () => ({ updateFilters: state.updateFilters, fetchIssues: state.fetchIssues }),
}));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issues: { paginationOptions: { canGroup: true, perPageCount: 50 } },
    issuesFilter: { issueFilters: { displayFilters: { layout: state.layout } } },
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: state.permissions }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ archived_at: state.archived ? "2026-01-01" : null }) }),
}));
vi.mock("@/hooks/store/use-project-section", () => ({
  useProjectSection: () => ({
    getSections: () => [
      { id: "design", name: "Design", sort_order: 10000 },
      { id: "dev", name: "Development", sort_order: 20000 },
    ],
    create: state.create,
    update: state.update,
    remove: state.remove,
    move: state.move,
    fetch: state.fetch,
  }),
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.resetAllMocks();
  state.role = EUserPermissions.ADMIN;
  state.archived = false;
  state.layout = "list";
  state.loadError = false;
  state.permissions.mockImplementation((roles: number[]) => roles.includes(state.role));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // eslint-disable-next-line no-extend-native -- jsdom lacks the Web Animations API used by Propel.
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function button(label: string) {
  const result = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label
  );
  expect(result, label).toBeDefined();
  return result!;
}
async function render() {
  await act(() => root.render(<AddSection workspaceSlug="workspace" projectId="project" />));
}
async function input(value: string, selector = 'input[name="section-name"]') {
  const element = document.querySelector<HTMLInputElement>(selector)!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it.each([EUserPermissions.ADMIN, EUserPermissions.MEMBER])(
  "allows role %s to create independent sections with no status group",
  async (role) => {
    state.role = role;
    await render();
    await act(() => button("Add section").click());
    expect(document.querySelector("select")).toBeNull();
    await input("  Marketing  ");
    await act(() => button("Create section").click());
    expect(state.create).toHaveBeenCalledExactlyOnceWith("workspace", "project", "Marketing", {
      icon: "",
      icon_color: "#6d7b8a",
    });
    expect(state.updateFilters).toHaveBeenCalledWith("project", "display_filters", {
      group_by: "section",
      sub_group_by: null,
      show_empty_groups: true,
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(state.permissions).toHaveBeenCalledWith(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      "workspace",
      "project"
    );
  }
);
it.each([EUserPermissions.GUEST, -1])("hides section management for role %s", async (role) => {
  state.role = role;
  await render();
  expect(host.textContent).not.toContain("Add section");
  expect(host.textContent).not.toContain("Manage sections");
});
it("hides management for archived projects", async () => {
  state.archived = true;
  await render();
  expect(host.textContent).not.toContain("Add section");
});
it("creates a section with its selected icon and color", async () => {
  await render();
  await act(() => button("Add section").click());
  await input("Creative");
  await act(() => button("Choose section icon").click());
  await input("#123abc", 'input[type="color"]');
  expect(document.querySelector("[data-section-icon=palette]")?.getAttribute("style")).toContain("rgb(18, 58, 188)");
  await act(() => button("Create section").click());
  expect(state.create).toHaveBeenCalledExactlyOnceWith("workspace", "project", "Creative", {
    icon: "palette",
    icon_color: "#123abc",
  });
});
it("saves appearance without renaming, retains failed edits, and allows resetting the icon", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await render();
  await act(() => button("Manage sections").click());
  await act(() => button("Choose section icon").click());
  state.update.mockRejectedValueOnce({ response: { data: { icon_color: ["Invalid icon color."] } } });
  await act(() => button("Save").click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Invalid icon color.");
  expect(document.querySelector("[data-section-icon=palette]")).not.toBeNull();
  await act(() => button("Save").click());
  expect(state.update).toHaveBeenLastCalledWith("workspace", "project", "design", {
    name: "Design",
    icon: "palette",
    icon_color: "#ff0088",
  });
  await act(() => button("Reset icon").click());
  await act(() => button("Save").click());
  expect(state.update).toHaveBeenLastCalledWith("workspace", "project", "design", {
    name: "Design",
    icon: "",
    icon_color: "#ff0088",
  });
});
it("hides mutations in completed cycles while keeping section grouping available", async () => {
  await act(() => root.render(<AddSection workspaceSlug="workspace" projectId="project" readOnly />));
  expect(host.textContent).not.toContain("Add section");
  expect(host.textContent).not.toContain("Manage sections");
  expect(host.textContent).toContain("Group by Sections");
});
it("rejects whitespace names and retains failed drafts with the API error", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  await render();
  await act(() => button("Add section").click());
  await input("  ");
  await act(() => button("Create section").click());
  expect(state.create).not.toHaveBeenCalled();
  await input("Design");
  state.create.mockRejectedValueOnce({ response: { data: { name: ["Name already exists"] } } });
  await act(() => button("Create section").click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Name already exists");
  expect(document.querySelector<HTMLInputElement>('input[name="section-name"]')?.value).toBe("Design");
  await act(() => button("Create section").click());
  expect(state.create).toHaveBeenCalledTimes(2);
});
it("blocks double submission and dismissal during creation", async () => {
  let complete: (() => void) | undefined;
  state.create.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      })
  );
  await render();
  await act(() => button("Add section").click());
  await input("Design");
  await act(() => {
    button("Create section").click();
    button("Create section").click();
  });
  expect(state.create).toHaveBeenCalledOnce();
  expect(button("Cancel").disabled).toBe(true);
  await act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(() => complete!());
});
it("renames and reorders sections without changing task statuses", async () => {
  await render();
  await act(() => button("Manage sections").click());
  await input("Creative", 'input[aria-label="Rename Design"]');
  await act(() => button("Save").click());
  expect(state.update).toHaveBeenCalledWith("workspace", "project", "design", {
    name: "Creative",
    icon: "",
    icon_color: "#6d7b8a",
  });
  expect(button("Move Design up").disabled).toBe(true);
  await act(() => button("Move Design down").click());
  expect(state.move).toHaveBeenCalledWith("workspace", "project", "design", 1);
});
it("confirms deletion, keeps tasks and reloads the active view", async () => {
  await render();
  await act(() => button("Manage sections").click());
  await act(() => button("Delete Design").click());
  expect(state.remove).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("tasks will be kept under No section");
  await act(() => button("Delete section").click());
  expect(state.remove).toHaveBeenCalledWith("workspace", "project", "design");
  expect(state.fetchIssues).toHaveBeenCalledWith("mutation", { canGroup: true, perPageCount: 50 }, "project");
});
it("reports delete failures without pretending the section was removed", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.remove.mockRejectedValueOnce(new Error("Offline"));
  await render();
  await act(() => button("Manage sections").click());
  await act(() => button("Delete Design").click());
  await act(() => button("Delete section").click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Offline");
  expect(state.fetchIssues).not.toHaveBeenCalled();
});
it("groups by sections with empty sections visible on request", async () => {
  await render();
  await act(() => button("Group by Sections").click());
  expect(state.updateFilters).toHaveBeenCalledWith("project", "display_filters", {
    group_by: "section",
    sub_group_by: null,
    show_empty_groups: true,
  });
});
it.each(["calendar", "gantt_chart", "spreadsheet"])("preserves %s layout", async (layout) => {
  state.layout = layout;
  await render();
  expect(host.textContent).not.toContain("Group by Sections");
  expect(state.updateFilters).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Add section");
});
it("does not change Calendar grouping when creating a section", async () => {
  state.layout = "calendar";
  await render();
  await act(() => button("Add section").click());
  await input("Marketing");
  await act(() => button("Create section").click());
  expect(state.create).toHaveBeenCalledWith("workspace", "project", "Marketing", { icon: "", icon_color: "#6d7b8a" });
  expect(state.updateFilters).not.toHaveBeenCalled();
});
it("exposes section load failures with retry", async () => {
  state.loadError = true;
  await render();
  await act(() => button("Retry").click());
  expect(state.retry).toHaveBeenCalledOnce();
});
it("assigns and clears sections independently from status", async () => {
  const change = vi.fn();
  await act(() => root.render(<SectionSelect workspaceSlug="workspace" projectId="project" onChange={change} />));
  const select = host.querySelector("select")!;
  await act(() => {
    select.value = "design";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(change).toHaveBeenCalledWith("design");
  await act(() => {
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(change).toHaveBeenCalledWith(null);
});
it("reports assignment errors", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const change = vi.fn().mockRejectedValueOnce(new Error("Permission denied"));
  await act(() => root.render(<SectionSelect workspaceSlug="workspace" projectId="project" onChange={change} />));
  await act(() => {
    const select = host.querySelector("select")!;
    select.value = "design";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: "Permission denied" }));
});
