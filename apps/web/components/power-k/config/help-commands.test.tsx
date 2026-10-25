import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { usePowerKHelpCommands } from "./help-commands";
import { PowerKCommandRegistry } from "../core/registry";
import type { TPowerKContext } from "../core/types";

const mocks = vi.hoisted(() => ({ toggleShortcutsListModal: vi.fn() }));
vi.mock("@/hooks/store/use-power-k", () => ({ usePowerK: () => mocks }));

const context: TPowerKContext = {
  params: {},
  activeCommand: null,
  activeContext: null,
  shouldShowContextBasedActions: true,
  setShouldShowContextBasedActions: vi.fn(),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
  closePalette: vi.fn(),
  setActiveCommand: vi.fn(),
  setActivePage: vi.fn(),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("hides external help commands without deleting their actions or hiding keyboard shortcuts", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const registry = new PowerKCommandRegistry();
  function Commands() {
    registry.registerMultiple(usePowerKHelpCommands());
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(() => root.render(<Commands />));
    expect(registry.getAllCommands()).toHaveLength(4);
    expect(registry.getVisibleCommands(context).map((command) => command.id)).toEqual(["open_keyboard_shortcuts"]);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    for (const [id, url] of [
      ["open_plane_documentation", "https://docs.plane.so/"],
      ["join_forum", "https://forum.plane.so"],
      ["report_bug", "https://github.com/makeplane/plane/issues/new/choose"],
    ]) {
      const command = registry.getCommand(id);
      expect(command?.isVisible(context)).toBe(false);
      expect(command?.isEnabled(context)).toBe(true);
      if (command?.type !== "action") throw new Error(`Missing retained action: ${id}`);
      command.action(context);
      expect(open).toHaveBeenLastCalledWith(url, "_blank", "noopener,noreferrer");
    }
    const shortcuts = registry.getCommand("open_keyboard_shortcuts");
    if (shortcuts?.type !== "action") throw new Error("Missing keyboard shortcut action");
    shortcuts.action(context);
    expect(mocks.toggleShortcutsListModal).toHaveBeenCalledWith(true);
  } finally {
    await act(() => root.unmount());
  }
});
