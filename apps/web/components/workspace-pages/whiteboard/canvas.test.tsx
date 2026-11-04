import { act, useEffect } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TWhiteboardCanvasProps } from "./canvas";
import WhiteboardCanvas from "./canvas";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  reconnect: vi.fn(),
  readOnly: false,
  attachApi: false,
  api: {
    getSceneElementsIncludingDeleted: vi.fn(() => []),
    getSceneElements: vi.fn(() => []),
    getFiles: vi.fn(() => ({})),
    getAppState: vi.fn(() => ({
      viewModeEnabled: true,
      zenModeEnabled: false,
      viewBackgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    })),
    updateScene: vi.fn(),
    addFiles: vi.fn(),
  },
}));
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({
    children,
    viewModeEnabled,
    excalidrawAPI,
  }: {
    children: ReactNode;
    viewModeEnabled: boolean;
    excalidrawAPI: (api: typeof mocks.api) => void;
  }) => {
    useEffect(() => {
      if (mocks.attachApi) excalidrawAPI(mocks.api);
    }, [excalidrawAPI]);
    mocks.readOnly = viewModeEnabled;
    return <div data-excalidraw>{children}</div>;
  },
  MainMenu: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    DefaultItems: {
      Export: () => null,
      SaveAsImage: () => null,
      SearchMenu: () => null,
      Help: () => null,
      ClearCanvas: () => null,
      ChangeCanvasBackground: () => null,
    },
    Separator: () => null,
  }),
  WelcomeScreen: Object.assign(({ children }: { children: ReactNode }) => <>{children}</>, {
    Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
  CaptureUpdateAction: { NEVER: "NEVER", IMMEDIATELY: "IMMEDIATELY" },
  hashElementsVersion: () => 0,
  newElementWith: vi.fn(),
  convertToExcalidrawElements: vi.fn(),
  viewportCoordsToSceneCoords: vi.fn(),
}));
vi.mock("./comments", () => ({ WhiteboardComments: () => null }));
vi.mock("./document-preview", () => ({ DocumentPreview: () => null }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.attachApi = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(overrides: Partial<TWhiteboardCanvasProps["collaboration"]> = {}) {
  await act(() =>
    root.render(
      <WhiteboardCanvas
        workspaceSlug="team"
        boardId="board"
        initialScene={{ elements: [] }}
        theme="light"
        header={<div>Floating board header</div>}
        collaboration={{
          connected: true,
          clientId: "client",
          state: {
            revision: 1,
            scene: { elements: [] },
            role: "owner",
            user: { id: "owner", display_name: "Owner", first_name: "", last_name: "", avatar_url: null },
            presenter: null,
            participants: [],
          },
          send: mocks.send,
          error: "",
          reconnect: mocks.reconnect,
          ...overrides,
        }}
      />
    )
  );
}
it("uses the dotted canvas, floating header, centered start prompt and collapsible board tools", async () => {
  await render();
  expect(host.querySelector(".pms-whiteboard__dots")?.getAttribute("aria-hidden")).toBe("true");
  expect(host.textContent).toContain("Floating board header");
  expect(host.querySelector("h2")?.textContent).toBe("Start With An Idea");
  expect(host.querySelector("details summary")?.textContent).toBe("Board tools");
  expect(host.textContent).toContain("Attach documents");
  expect(host.textContent).toContain("Add / edit text link");
  expect(mocks.readOnly).toBe(false);
});
it("shows disconnected and error states outside collapsed tools and reconnects", async () => {
  await render({ connected: false, error: "Connection lost" });
  const alert = host.querySelector('[role="alert"]')!;
  expect(alert.closest("details")).toBeNull();
  expect(mocks.readOnly).toBe(true);
  await act(() => alert.querySelector("button")!.click());
  expect(mocks.reconnect).toHaveBeenCalled();
});
it("does not restore stale read-only UI state when joining or reconnecting an editable session", async () => {
  mocks.attachApi = true;
  await render({ connected: false, state: null });
  expect(mocks.readOnly).toBe(true);
  expect(mocks.api.updateScene).not.toHaveBeenCalled();
  await render();
  expect(mocks.readOnly).toBe(false);
  expect(mocks.api.updateScene).toHaveBeenLastCalledWith({
    elements: [],
    appState: { viewBackgroundColor: "#ffffff", scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    captureUpdate: "NEVER",
  });
  await render({ connected: false });
  expect(mocks.readOnly).toBe(true);
  await render();
  expect(mocks.readOnly).toBe(false);
  for (const [update] of mocks.api.updateScene.mock.calls) {
    expect(update.appState).not.toHaveProperty("viewModeEnabled");
    expect(update.appState).not.toHaveProperty("zenModeEnabled");
  }
});
it("still synchronizes the shared background and presenter viewport without copying local UI state", async () => {
  mocks.attachApi = true;
  await render({
    state: {
      revision: 1,
      scene: { elements: [], appState: { viewBackgroundColor: "#fff2b8" } },
      role: "editor",
      user: { id: "editor", display_name: "Editor", first_name: "", last_name: "", avatar_url: null },
      presenter: {
        client_id: "presenter",
        user_id: "presenter",
        viewport: { scrollX: 10, scrollY: 20, zoom: 1.5 },
      },
      participants: [],
    },
  });
  expect(mocks.readOnly).toBe(true);
  expect(mocks.api.updateScene).toHaveBeenLastCalledWith({
    elements: [],
    appState: { viewBackgroundColor: "#fff2b8", scrollX: 10, scrollY: 20, zoom: { value: 1.5 } },
    captureUpdate: "NEVER",
  });
});
