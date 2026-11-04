import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SharedNotepadPage from "@/app/shared-notepad";

const mocks = vi.hoisted(() => ({ accept: vi.fn() }));
vi.mock("@/lib/wrappers/authentication-wrapper", () => ({
  AuthenticationWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/workspace-pages/page-detail-root", () => ({
  WorkspacePageDetailRoot: ({
    workspaceSlug,
    pageId,
    shared,
  }: {
    workspaceSlug: string;
    pageId: string;
    shared: boolean;
  }) => (
    <div data-shared={shared}>
      Notepad {workspaceSlug}/{pageId}
    </div>
  ),
}));
vi.mock("@/services/page/workspace-page.service", () => ({
  WorkspacePageService: class {
    acceptInvitation = mocks.accept;
  },
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.accept.mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(query = "?invitation=signed-token") {
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={[`/shared/notepads/team/note/${query}`]}>
        <Routes>
          <Route path="/shared/notepads/:workspaceSlug/:pageId" element={<SharedNotepadPage />} />
        </Routes>
      </MemoryRouter>
    )
  );
}
it("requires explicit acceptance before opening the notepad editor", async () => {
  await render();
  expect(host.querySelector("[data-shared]")).toBeNull();
  await act(() => host.querySelector("button")!.click());
  expect(mocks.accept).toHaveBeenCalledWith("team", "note", "signed-token");
  expect(host.querySelector("[data-shared]")?.textContent).toBe("Notepad team/note");
});
it("keeps failed invitations on the acceptance screen with an actionable error", async () => {
  mocks.accept.mockRejectedValueOnce(new Error("expired"));
  await render();
  await act(() => host.querySelector("button")!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("invited email");
  expect(host.querySelector("[data-shared]")).toBeNull();
  await act(() => host.querySelector("button")!.click());
  expect(host.querySelector("[data-shared]")).not.toBeNull();
});
it("opens a previously accepted shared notepad without accepting again", async () => {
  await render("");
  expect(host.querySelector("[data-shared]")?.getAttribute("data-shared")).toBe("true");
  expect(mocks.accept).not.toHaveBeenCalled();
});
