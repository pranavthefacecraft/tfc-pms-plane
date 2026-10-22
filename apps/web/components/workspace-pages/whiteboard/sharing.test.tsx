import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WhiteboardSharing } from "./sharing";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = mocks.get;
    post = mocks.post;
  },
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const initial = {
  access: 1,
  guest_role: "disabled",
  members: [],
  guests: [{ id: "guest", display_name: "Guest Person", first_name: "Guest" }],
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockReset().mockResolvedValue({ data: initial });
  mocks.post.mockReset();
  mocks.toast.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(() =>
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <WhiteboardSharing workspaceSlug="team" boardId="board" />
      </SWRConfig>
    )
  );
  await act(async () => host.querySelector("button")?.click());
}

it.each(["viewer", "editor", "disabled"])("saves the owner's guest link choice %s", async (role) => {
  mocks.post.mockResolvedValue({ data: { ...initial, guest_role: role } });
  await render();
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Guest link access"]')!;
  await act(async () => {
    select.value = role;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(mocks.post).toHaveBeenCalledWith("/api/workspaces/team/workspace-pages/board/sharing/", { guest_role: role });
  expect(select.value).toBe(role);
});
it("lets the owner remove a joined guest", async () => {
  mocks.post.mockResolvedValue({ data: { ...initial, guests: [] } });
  await render();
  expect(host.textContent).toContain("Guest Person (Guest)");
  const remove = [...host.querySelectorAll("button")].find((button) => button.textContent === "Remove");
  await act(async () => remove?.click());
  expect(mocks.post).toHaveBeenCalledWith("/api/workspaces/team/workspace-pages/board/sharing/", {
    user_id: "guest",
    role: "remove",
  });
  expect(host.textContent).not.toContain("Guest Person");
});
it("reports a failed guest setting update without pretending it succeeded", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.post.mockRejectedValue(new Error("Request failed"));
  await render();
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Guest link access"]')!;
  await act(async () => {
    select.value = "editor";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  expect(select.value).toBe("disabled");
  expect(select.disabled).toBe(false);
  log.mockRestore();
});
