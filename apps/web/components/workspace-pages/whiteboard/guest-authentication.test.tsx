import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EPageTypes } from "@/helpers/authentication.helper";
import { isWhiteboardGuestPath } from "@/helpers/whiteboard-guest";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

const path = "/team/tool/whiteboards/e0aaabda-bedc-4447-b22c-fdaa813ef438/";
const mocks = vi.hoisted(() => ({
  pathname: "",
  nextPath: null as string | null,
  user: { id: "user" } as { id: string } | undefined,
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.nextPath ? { next_path: mocks.nextPath } : {}),
}));
vi.mock("swr", () => ({ default: () => ({ isLoading: false }) }));
vi.mock("@/components/common/logo-spinner", () => ({ LogoSpinner: () => <div>Loading</div> }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ loader: false, workspaces: {} }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ isLoading: false, data: mocks.user, fetchCurrentUser: vi.fn() }),
  useUserProfile: () => ({ data: { id: "profile", is_onboarded: false } }),
  useUserSettings: () => ({ data: {} }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.pathname = path;
  mocks.nextPath = null;
  mocks.user = { id: "user" };
  mocks.push.mockReset();
  mocks.replace.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(pageType = EPageTypes.AUTHENTICATED) {
  await act(() =>
    root.render(
      <AuthenticationWrapper pageType={pageType}>
        <div>Guest entry</div>
      </AuthenticationWrapper>
    )
  );
}

it("lets a signed-in new account reach the board without creating a workspace", async () => {
  await render();
  expect(host.textContent).toBe("Guest entry");
  expect(mocks.push).not.toHaveBeenCalled();
});
it("sends signed-out visitors to sign in with the original board URL", async () => {
  mocks.user = undefined;
  await render();
  expect(mocks.push).toHaveBeenCalledWith(`/?next_path=${path}`);
  expect(host.textContent).toBe("");
});
it("returns newly signed-in accounts to the shared board rather than onboarding", async () => {
  mocks.pathname = "/";
  mocks.nextPath = path;
  await render(EPageTypes.NON_AUTHENTICATED);
  expect(mocks.replace).toHaveBeenCalledWith(path);
});
it("preserves onboarding for other authenticated routes", async () => {
  mocks.pathname = "/team/projects";
  await render();
  expect(mocks.push).toHaveBeenCalledWith("/onboarding");
});
it.each([
  "//evil.test/team/tool/whiteboards/e0aaabda-bedc-4447-b22c-fdaa813ef438",
  "/team/tool/pages/board",
  "/team/tool/whiteboards/not-a-uuid",
  "https://evil.test/",
])("does not treat %s as a guest return path", (value) => expect(isWhiteboardGuestPath(value)).toBe(false));
