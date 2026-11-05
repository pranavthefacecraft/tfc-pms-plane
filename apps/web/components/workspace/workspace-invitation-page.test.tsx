/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceInvitationPage from "@/app/(all)/workspace-invitations/page";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  join: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("invitation_id=i1&slug=acme&token=invite-token"),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { email: "new@acme.test" } }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/wrappers/authentication-wrapper", () => ({
  AuthenticationWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/common/logo-spinner", () => ({ LogoSpinner: () => <span>Loading</span> }));
vi.mock("@/components/ui/empty-space", () => ({
  EmptySpace: ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
  EmptySpaceItem: ({ title, action }: { title: string; action?: () => void }) => (
    <button onClick={action}>{title}</button>
  ),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    getWorkspaceInvitation = mocks.get;
    joinWorkspace = mocks.join;
  },
}));

describe("workspace/project invitation acceptance", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({
      id: "i1",
      email: "new@acme.test",
      workspace: { slug: "acme", name: "Acme" },
      responded_at: null,
      projects: [{ id: "p1", name: "Website" }],
    });
    mocks.join.mockResolvedValue({});
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  async function render() {
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <WorkspaceInvitationPage />
        </SWRConfig>
      )
    );
  }
  it("uses token-verified project context and opens the invited project after acceptance", async () => {
    await render();
    expect(mocks.get).toHaveBeenCalledWith("acme", "i1", "invite-token");
    expect(host.querySelector("h1")?.textContent).toBe("You have been invited to Website in Acme");
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Accept")!.click()
    );
    expect(mocks.join).toHaveBeenCalledWith("acme", "i1", { accepted: true, token: "invite-token" });
    expect(mocks.push).toHaveBeenCalledWith("/acme/projects/p1/overview");
  });
  it("keeps workspace-only invitations workspace-labelled", async () => {
    mocks.get.mockResolvedValue({
      id: "i1",
      email: "new@acme.test",
      workspace: { slug: "acme", name: "Acme" },
      projects: [],
    });
    await render();
    expect(host.querySelector("h1")?.textContent).toBe("You have been invited to Acme");
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Accept")!.click()
    );
    expect(mocks.push).toHaveBeenCalledWith("/acme");
  });
  it("surfaces acceptance errors without navigating", async () => {
    mocks.join.mockRejectedValue(new Error("Wrong account"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render();
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Accept")!.click()
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Sign in with the invited email");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
