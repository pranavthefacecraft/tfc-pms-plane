import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthHeader } from "./auth-header";
import { InstanceSignInForm } from "./sign-in-form";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  requestCSRFToken: vi.fn(async () => ({ csrf_token: "test-csrf" })),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@plane/services", () => ({
  AuthService: class {
    requestCSRFToken = mocks.requestCSRFToken;
  },
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.params = new URLSearchParams();
  mocks.requestCSRFToken.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function enter(input: HTMLInputElement, value: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("places the Clevdex logo above the login card and preserves the admin POST and CSRF token", async () => {
  await act(() => root.render(<InstanceSignInForm />));
  const logo = host.querySelector("img")!;
  const card = host.querySelector(".god-mode-sign-in-card")!;
  expect(logo.alt).toBe("Clevdex");
  expect(logo.getAttribute("src")).toContain("clevdex-logo.png");
  expect(card.contains(logo)).toBe(false);
  expect(host.querySelector("h1")?.textContent).toBe("Manage your TFC PMS instance");
  const form = host.querySelector("form")!;
  expect(form.getAttribute("method")).toBe("POST");
  expect(form.getAttribute("action")).toMatch(/\/api\/instances\/admins\/sign-in\/$/);
  expect(host.querySelector<HTMLInputElement>('[name="csrfmiddlewaretoken"]')?.value).toBe("test-csrf");
  expect(mocks.requestCSRFToken).toHaveBeenCalledTimes(1);
  expect(host.querySelector('a[href*="sign-up"]')).toBeNull();
});

it("preserves required credentials, password visibility, and submitting state", async () => {
  await act(() => root.render(<InstanceSignInForm />));
  const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const email = host.querySelector<HTMLInputElement>('[name="email"]')!;
  const password = host.querySelector<HTMLInputElement>('[name="password"]')!;
  expect(submit.disabled).toBe(true);
  await enter(email, "admin@example.test");
  expect(submit.disabled).toBe(true);
  await enter(password, "example-password");
  expect(submit.disabled).toBe(false);
  expect(password.type).toBe("password");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Show password"]')!.click());
  expect(password.type).toBe("text");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Hide password"]')!.click());
  expect(password.type).toBe("password");
  await act(() => {
    const form = host.querySelector("form")!;
    form.addEventListener("submit", (event) => event.preventDefault(), { once: true });
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('button[type="submit"]')?.getAttribute("aria-busy")).toBe("true");
  expect(host.querySelector('button[type="submit"]')?.getAttribute("aria-disabled")).toBe("true");
});

it("preserves an email supplied in the URL and displays authentication errors", async () => {
  mocks.params = new URLSearchParams({
    email: "admin@example.test",
    error_code: "AUTHENTICATION_FAILED",
    error_message: "Unable to sign in.",
  });
  await act(() => root.render(<InstanceSignInForm />));
  expect(host.querySelector<HTMLInputElement>('[name="email"]')?.value).toBe("admin@example.test");
  expect(host.textContent).toContain("Unable to sign in.");
});

it("leaves the non-centered instance setup header unchanged", async () => {
  await act(() => root.render(<AuthHeader />));
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/god-mode/tfc-pms-logo.png");
  expect(host.querySelector("img")?.alt).toBe("TFC PMS");
});
