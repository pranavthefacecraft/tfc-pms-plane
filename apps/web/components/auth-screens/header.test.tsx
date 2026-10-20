/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { EAuthModes } from "@/helpers/authentication.helper";
import { AuthHeader, AuthHeaderBase } from "./header";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
