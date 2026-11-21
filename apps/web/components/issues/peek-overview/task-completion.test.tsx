import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TaskCompletion } from "./task-completion";

vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    getProjectStates: () => [
      { id: "todo", group: "unstarted", default: true },
      { id: "done", group: "completed", default: false },
    ],
  }),
}));

it("completes and reopens tasks using the project workflow without enabling read-only tasks", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const update = vi.fn().mockResolvedValue(undefined);
  const render = (stateId: string, disabled = false) =>
    act(() =>
      root.render(<TaskCompletion projectId="project" stateId={stateId} disabled={disabled} onChange={update} />)
    );
  try {
    await render("todo");
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Mark as Complete");
    await act(() => button.click());
    expect(update).toHaveBeenNthCalledWith(1, "done");
    await render("done");
    expect(button.textContent).toBe("Mark as Incomplete");
    await act(() => button.click());
    expect(update).toHaveBeenNthCalledWith(2, "todo");
    await render("todo", true);
    expect(button.disabled).toBe(true);
    await act(() => button.click());
    expect(update).toHaveBeenCalledTimes(2);
  } finally {
    await act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
