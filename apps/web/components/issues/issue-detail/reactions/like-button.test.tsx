/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { IssueLikeButton } from "./like-button";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  liked: false,
  count: 0,
  create: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: mocks.user }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    reaction: {
      getReactionsByIssueId: () => ({ "128077": Array.from({ length: mocks.count }, (_, i) => `${i}`) }),
      reactionsByUser: () => (mocks.liked ? [{ reaction: "128077" }] : []),
    },
    createReaction: mocks.create,
    removeReaction: mocks.remove,
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/utils", () => ({ cn: (...values: string[]) => values.join(" ") }));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => children,
}));

describe("task like button", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const animationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    Reflect.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
    vi.clearAllMocks();
    mocks.liked = false;
    mocks.count = 0;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    if (animationsDescriptor) Reflect.defineProperty(Element.prototype, "getAnimations", animationsDescriptor);
    else Reflect.deleteProperty(Element.prototype, "getAnimations");
  });

  const render = async (disabled = false) => {
    await act(() =>
      root.render(<IssueLikeButton workspaceSlug="workspace" projectId="project" issueId="task" disabled={disabled} />)
    );
    const button = host.querySelector("button");
    if (!button) throw new Error("Like button missing");
    return button;
  };

  it("likes with the existing persistent thumbs-up reaction", async () => {
    const button = await render();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Like this task");
    await act(() => button.click());
    expect(mocks.create).toHaveBeenCalledWith("workspace", "project", "task", "128077");
  });

  it("offers a text-only Unlike action inside the menu", async () => {
    mocks.liked = true;
    await act(() =>
      root.render(
        <Menu defaultOpen>
          <MenuTrigger>Options</MenuTrigger>
          <MenuContent>
            <IssueLikeButton workspaceSlug="workspace" projectId="project" issueId="task" presentation="menu" />
          </MenuContent>
        </Menu>
      )
    );
    const item = document.body.querySelector<HTMLElement>('[role="menuitem"]')!;
    expect(item.textContent).toBe("Unlike this task");
    expect(item.querySelector("svg")).toBeNull();
    await act(() => item.click());
    expect(mocks.remove).toHaveBeenCalledWith("workspace", "project", "task", "128077", "user-1");
  });

  it("shows existing likes and removes only the current user's like", async () => {
    mocks.liked = true;
    mocks.count = 3;
    const button = await render();
    expect(button.textContent).toBe("3");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await act(() => button.click());
    expect(mocks.remove).toHaveBeenCalledWith("workspace", "project", "task", "128077", "user-1");
  });

  it("does not mutate archived tasks", async () => {
    const button = await render(true);
    await act(() => button.click());
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("prevents duplicate requests while saving", async () => {
    let finish: (() => void) | undefined;
    mocks.create.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const button = await render();
    await act(() => {
      button.click();
      button.click();
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(() => finish?.());
    expect(button.disabled).toBe(false);
  });

  it("surfaces failures and lets the user retry", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Offline"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const button = await render();
      await act(() => button.click());
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
      expect(button.disabled).toBe(false);
      expect(button.getAttribute("aria-pressed")).toBe("false");
    } finally {
      consoleError.mockRestore();
    }
  });
});
