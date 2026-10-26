import { autorun } from "mobx";
import { beforeEach, expect, it, vi } from "vitest";
import { SectionStore } from "./section.store";
import { ProjectSectionService } from "@/services/project/project-section.service";
import type { TIssue } from "@plane/types";
import { createIssuePayload } from "@plane/utils";

vi.mock("@/services/project/project-section.service", () => ({
  ProjectSectionService: class {
    list = vi.fn();
    create = vi.fn();
    update = vi.fn();
    remove = vi.fn();
  },
}));

const design = { id: "design", name: "Design", sort_order: 10000 };
const dev = { id: "dev", name: "Development", sort_order: 20000 };
let service: ProjectSectionService;
let store: SectionStore;
let issuesMap: Record<string, TIssue>;
const updateIssue = vi.fn();
const clear = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  service = new ProjectSectionService();
  issuesMap = {};
  store = new SectionStore(
    {
      issues: { issuesMap, updateIssue },
      projectIssues: { clear },
      cycleIssues: { clear },
      moduleIssues: { clear },
      projectViewIssues: { clear },
    },
    service
  );
});
it("loads project-specific ordered sections and updates observers after create", async () => {
  vi.mocked(service.list).mockResolvedValueOnce([design]);
  await store.fetch("workspace", "project");
  const observed: string[][] = [];
  const dispose = autorun(() => observed.push(store.getSections("workspace", "project").map((item) => item.name)));
  vi.mocked(service.create).mockResolvedValueOnce(dev);
  await store.create("workspace", "project", "Development");
  expect(observed).toEqual([["Design"], ["Design", "Development"]]);
  expect(store.getSections("other-workspace", "project")).toEqual([]);
  expect(store.getSections("workspace", "other-project")).toEqual([]);
  dispose();
});
it("renames an existing section without duplication", async () => {
  vi.mocked(service.list).mockResolvedValueOnce([design, dev]);
  await store.fetch("workspace", "project");
  vi.mocked(service.update).mockResolvedValueOnce({ ...design, name: "Creative" });
  await store.update("workspace", "project", "design", { name: "Creative" });
  expect(store.getSections("workspace", "project").map((item) => item.name)).toEqual(["Creative", "Development"]);
});
it("moves sections with persistent sort order", async () => {
  vi.mocked(service.list).mockResolvedValueOnce([design, dev]);
  await store.fetch("workspace", "project");
  vi.mocked(service.update).mockResolvedValueOnce({ ...design, sort_order: 30000 });
  await store.move("workspace", "project", "design", 1);
  expect(service.update).toHaveBeenCalledWith("workspace", "project", "design", { sort_order: 30000 });
  expect(store.getSections("workspace", "project").map((item) => item.id)).toEqual(["dev", "design"]);
});
it("preserves sections on failed deletion", async () => {
  vi.mocked(service.list).mockResolvedValueOnce([design]);
  await store.fetch("workspace", "project");
  vi.mocked(service.remove).mockRejectedValueOnce(new Error("Offline"));
  await expect(store.remove("workspace", "project", "design")).rejects.toThrow("Offline");
  expect(store.getSections("workspace", "project")).toEqual([design]);
  expect(clear).not.toHaveBeenCalled();
});
it("deletes only after server confirmation and invalidates cached grouped lists", async () => {
  vi.mocked(service.list).mockResolvedValueOnce([design, dev]);
  await store.fetch("workspace", "project");
  await store.remove("workspace", "project", "design");
  expect(service.remove).toHaveBeenCalledWith("workspace", "project", "design");
  expect(store.getSections("workspace", "project")).toEqual([dev]);
  expect(clear).toHaveBeenCalledTimes(4);
  expect(clear).toHaveBeenCalledWith(false);
});
it("clears only the deleted section assignment in cached work items", async () => {
  issuesMap.task = createIssuePayload("project", {
    id: "task",
    section_id: "design",
    state_id: "done",
    name: "Finished task",
  });
  issuesMap.other = createIssuePayload("project", { id: "other", section_id: "dev", state_id: "todo" });
  await store.remove("workspace", "project", "design");
  expect(updateIssue).toHaveBeenCalledExactlyOnceWith("task", { section_id: null });
  expect(issuesMap.task.state_id).toBe("done");
});
it("rejects invalid reorder boundaries without API requests", async () => {
  vi.mocked(service.list).mockResolvedValueOnce([design]);
  await store.fetch("workspace", "project");
  await expect(store.move("workspace", "project", "design", -1)).rejects.toThrow("cannot be moved");
  expect(service.update).not.toHaveBeenCalled();
});
it("does not silently default to an empty list on load failure", async () => {
  vi.mocked(service.list).mockRejectedValueOnce(new Error("Permission denied"));
  await expect(store.fetch("workspace", "project")).rejects.toThrow("Permission denied");
});
