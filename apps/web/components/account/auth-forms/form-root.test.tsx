import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EAuthModes, EAuthSteps } from "@plane/constants";
import { TermsAndConditions } from "../terms-and-conditions";
import { AuthFormRoot } from "./form-root";

const { config } = vi.hoisted(() => ({
  config: { is_smtp_configured: true, is_email_password_enabled: true },
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "auth.common.forgot_password" ? "Forgot password?" : key),
  }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/services/auth.service", () => ({ AuthService: vi.fn(function AuthService() {}) }));
vi.mock("./password", () => ({ AuthPasswordForm: () => null }));
vi.mock("./unique-code", () => ({ AuthUniqueCodeForm: () => null }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  config.is_smtp_configured = true;
  config.is_email_password_enabled = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function renderForm(mode = EAuthModes.SIGN_IN, email = "") {
  await act(() =>
    root.render(
      <MemoryRouter>
        <AuthFormRoot
          authStep={EAuthSteps.EMAIL}
          authMode={mode}
          currentAuthMode={mode}
          email={email}
          setEmail={vi.fn()}
          setAuthMode={vi.fn()}
          setAuthStep={vi.fn()}
          setErrorInfo={vi.fn()}
        />
      </MemoryRouter>
    )
  );
}

it("shows password recovery before entering an email", async () => {
  await renderForm();
  expect(host.querySelector("a")?.textContent).toBe("Forgot password?");
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/accounts/forgot-password/?email=");
});

it("prefills recovery with the email currently entered without submitting login", async () => {
  await renderForm();
  const input = host.querySelector("input");
  if (!input) throw new Error("Email input missing");
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "guest+board@example.com");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.querySelector("a")?.getAttribute("href")).toBe(
    "/accounts/forgot-password/?email=guest%2Bboard%40example.com"
  );
});

it("keeps the SMTP-unavailable explanation instead of offering a broken reset link", async () => {
  config.is_smtp_configured = false;
  await renderForm();
  expect(host.querySelector("a")).toBeNull();
  const trigger = Array.from(host.querySelectorAll("button")).find(
    (button) => button.textContent === "Forgot password?"
  );
  expect(trigger).toBeDefined();
  await act(() => trigger?.click());
  expect(document.body.textContent).toContain("auth.forgot_password.errors.smtp_not_enabled");
});

it("does not show password recovery on sign-up", async () => {
  await renderForm(EAuthModes.SIGN_UP);
  expect(host.textContent).not.toContain("Forgot password?");
});

it("hides the legal footer on sign-in", async () => {
  await act(() => root.render(<TermsAndConditions authType={EAuthModes.SIGN_IN} />));
  expect(host.textContent).toBe("");
  expect(host.querySelector("a")).toBeNull();
});

it("keeps the legal footer and policy links on sign-up", async () => {
  await act(() => root.render(<TermsAndConditions authType={EAuthModes.SIGN_UP} />));
  expect(host.textContent).toContain("By creating an account");
  expect(Array.from(host.querySelectorAll("a"), (link) => link.textContent)).toEqual([
    "Terms of Service",
    "Privacy Policy",
  ]);
});

it("requires agreement before continuing signup and keeps sign-in preference selectable", async () => {
  await renderForm(EAuthModes.SIGN_UP, "new@example.com");
  const checkbox = host.querySelector<HTMLInputElement>('[type="checkbox"]')!;
  const submit = host.querySelector<HTMLButtonElement>('[type="submit"]')!;
  expect(checkbox.required).toBe(true);
  expect(submit.disabled).toBe(true);
  await act(() => checkbox.click());
  expect(submit.disabled).toBe(false);
  await renderForm(EAuthModes.SIGN_IN, "new@example.com");
  expect(host.textContent).toContain("Keep me signed in");
  expect(host.querySelector<HTMLInputElement>('[name="remember_me_choice"]')?.value).toBe("false");
  await act(() => host.querySelector<HTMLInputElement>('[type="checkbox"]')!.click());
  expect(host.querySelector<HTMLInputElement>('[name="remember_me_choice"]')?.value).toBe("true");
});

it("does not show password recovery when password authentication is disabled", async () => {
  config.is_email_password_enabled = false;
  await renderForm();
  expect(host.textContent).not.toContain("Forgot password?");
});
