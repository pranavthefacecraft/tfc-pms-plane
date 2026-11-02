import { beforeEach, expect, it, vi } from "vitest";
import { MyTasksService } from "@/services/workspace-my-tasks.service";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = request;
  },
}));
beforeEach(() => vi.clearAllMocks());

it("loads every project task page rather than stopping at the first 100", async () => {
  const first = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
  request.mockResolvedValueOnce({ data: { count: 101, results: first } });
  request.mockResolvedValueOnce({ data: { count: 101, results: [{ id: "100" }] } });
  const tasks = await new MyTasksService().all("team");
  expect(tasks).toHaveLength(101);
  expect(request).toHaveBeenNthCalledWith(2, "/api/workspaces/team/my-tasks/", {
    params: { view: "list", limit: 100, offset: 100 },
  });
});

it("reports a broken or changed pagination response instead of looping forever", async () => {
  request.mockResolvedValue({ data: { count: 1, results: [] } });
  await expect(new MyTasksService().all("team")).rejects.toThrow("Please retry");
});
