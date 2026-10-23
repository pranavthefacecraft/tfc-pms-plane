/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { EAuthModes, EAuthSteps } from "@/helpers/authentication.helper";
import { AuthHeader as AuthFormHeader } from "@/components/account/auth-forms/auth-header";
import { AuthHeader, AuthHeaderBase } from "./header";
import { AuthBase } from "./auth-base";

vi.mock("@/components/account/auth-forms/auth-root", () => ({
  AuthRoot: ({ authMode }: { authMode: EAuthModes }) => <div data-testid="auth-form" data-mode={authMode} />,
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", async () => {
  const { default: auth } = await import("../../../../packages/i18n/src/locales/en/auth.json");
  return {
    useTranslation: () => ({
      t: (key: string) => (key === "auth.common.new_to_plane" ? auth.auth.common.new_to_plane : key),
    }),
  };
});
vi.mock("swr", () => ({ default: () => ({ data: undefined, isLoading: false }) }));
vi.mock("@/services/workspace.service", () => ({ WorkspaceService: vi.fn(function WorkspaceService() {}) }));
vi.mock("@/components/common/logo-spinner", () => ({ LogoSpinner: () => null }));
vi.mock("@/components/workspace/logo", () => ({ WorkspaceLogo: () => null }));
vi.mock("@/components/core/page-title", () => ({
  PageHead: ({ title }: { title: string }) => <span data-testid="page-title">{title}</span>,
}));
vi.mock("@/hooks/store/use-instance", () => ({
  useInstance: () => ({ config: { enable_signup: true } }),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it.each([EAuthModes.SIGN_IN, EAuthModes.SIGN_UP])(
  "uses the supplied logo for %s without changing auth links",
  async (type) => {
    await act(() =>
      root.render(
        <MemoryRouter>
          <AuthHeader type={type} />
        </MemoryRouter>
      )
    );
    const logo = host.querySelector("img");
    expect(logo?.getAttribute("src")).toBe("/clevdex-logo.png");
    expect(logo?.getAttribute("alt")).toBe("Clevdex");
    expect(logo?.closest("a")?.getAttribute("href")).toBe("/");
    const expectedHref = type === EAuthModes.SIGN_IN ? "/sign-up/" : "/sign-in/";
    expect(host.querySelector(`a[href="${expectedHref}"]`)).not.toBeNull();
    expect(host.querySelector('[data-testid="page-title"]')?.textContent).toContain(" - Clevdex");
    expect(host.textContent).not.toContain("TFC PMS");
    if (type === EAuthModes.SIGN_IN) expect(host.textContent).toContain("New to Clevdex?");
  }
);

it("uses the same logo on the shared password-recovery header", async () => {
  await act(() =>
    root.render(
      <MemoryRouter>
        <AuthHeaderBase pageTitle="Forgot password" />
      </MemoryRouter>
    )
  );
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/clevdex-logo.png");
  expect(host.querySelector("img")?.className).toContain("h-auto");
  expect(host.querySelectorAll("a")).toHaveLength(1);
});

it.each(
  [EAuthModes.SIGN_IN, EAuthModes.SIGN_UP].flatMap((mode) =>
    [EAuthSteps.EMAIL, EAuthSteps.PASSWORD, EAuthSteps.UNIQUE_CODE].map((step) => ({ mode, step }))
  )
)("uses Clevdex for $mode at $step", async ({ mode, step }) => {
  await act(() =>
    root.render(
      <AuthFormHeader
        workspaceSlug={undefined}
        invitationId={undefined}
        invitationEmail={undefined}
        authMode={mode}
        currentAuthStep={step}
      />
    )
  );
  expect(host.textContent).toContain(
    mode === EAuthModes.SIGN_IN ? "Welcome back to Clevdex." : "Create your Clevdex account."
  );
  expect(host.textContent).not.toContain("TFC PMS");
  expect(host.querySelector(".text-left")).not.toBeNull();
  expect(host.querySelector(".font-normal")?.textContent).toContain("Clevdex");
});

it.each([EAuthModes.SIGN_IN, EAuthModes.SIGN_UP])(
  "centers the logo above the unchanged %s form and places the account switch below",
  async (type) => {
    await act(() =>
      root.render(
        <MemoryRouter>
          <AuthBase authType={type} />
        </MemoryRouter>
      )
    );
    const logo = host.querySelector("img");
    expect(logo?.className).toContain("w-32");
    expect(logo?.closest("a")?.className).toContain("self-center");
    expect(host.querySelector(".auth-entry-page")).not.toBeNull();
    expect(host.querySelector(".max-w-\\[22\\.5rem\\]")).not.toBeNull();
    expect(host.querySelector('[data-testid="auth-form"]')?.getAttribute("data-mode")).toBe(type);
    expect(host.querySelector(".order-last a")?.getAttribute("href")).toBe(
      type === EAuthModes.SIGN_IN ? "/sign-up/" : "/sign-in/"
    );
  }
);
