import { expect, it, vi } from "vitest";
import { createIssuePayload } from "@plane/utils";
import { BaseIssuesStore } from "./issue/helpers/base-issues.store";

vi.mock("@/services/issue", () => ({ IssueService: vi.fn(), IssueArchiveService: vi.fn() }));
vi.mock("@/services/cycle.service", () => ({ CycleService: vi.fn() }));
vi.mock("@/services/module.service", () => ({ ModuleService: vi.fn() }));
vi.mock("@/lib/store-context", () => ({ store: {} }));

it.each([true, false])("cleans up the optimistic quick-add card on success=%s", async (success) => {
  const draft = createIssuePayload("project", { id: "temporary", name: "Second task", section_id: null });
  const saved = { ...draft, id: "saved", sequence_id: 2 };
  const error = new Error("Request rejected");
  const createIssue = success ? vi.fn().mockResolvedValue(saved) : vi.fn().mockRejectedValue(error);
  const removeIssue = vi.fn();
  const removeIssueFromList = vi.fn();
  const context = {
    addIssue: vi.fn(),
    createIssue,
    removeIssueFromList,
    rootIssueStore: { issues: { removeIssue } },
    addCycleToIssue: vi.fn(),
    changeModulesInIssue: vi.fn(),
  };
  const result = Reflect.apply(BaseIssuesStore.prototype.issueQuickAdd, context, ["workspace", "project", draft]);
  if (success) await expect(result).resolves.toEqual(saved);
  else await expect(result).rejects.toBe(error);
  expect(context.addIssue).toHaveBeenCalledWith(draft);
  expect(createIssue).toHaveBeenCalledWith("workspace", "project", draft);
  expect(removeIssueFromList).toHaveBeenCalledExactlyOnceWith("temporary");
  expect(removeIssue).toHaveBeenCalledExactlyOnceWith("temporary");
  expect(removeIssue).not.toHaveBeenCalledWith("saved");
});
