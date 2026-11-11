import { act } from "react";
import type { ComponentProps, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CreateWorkspacePage from "@/app/(all)/create-workspace/page";
import { CreateWorkspaceForm } from "./create-workspace-form";

const mocks = vi.hoisted(() => ({
  disabled: false,
  back: vi.fn(),
  push: vi.fn(),
  updateProfile: vi.fn(),
  form: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => (key === "common.go_back" ? "Go back" : key) }),
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({
    label,
    onClick,
    type = "button",
  }: {
    label: string;
    onClick?: () => void;
    type?: "button" | "submit";
  }) => (
    <button type={type} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { email: "test@example.test" } }),
  useUserProfile: () => ({ updateUserProfile: mocks.updateProfile }),
}));
vi.mock("@/hooks/store/use-instance", () => ({
  useInstance: () => ({ config: { is_workspace_creation_disabled: mocks.disabled } }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ back: mocks.back, push: mocks.push }) }));
vi.mock("@/lib/wrappers/authentication-wrapper", () => ({
  AuthenticationWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./create-workspace-form", () => ({
  CreateWorkspaceForm: (props: unknown) => {
    mocks.form(props);
    return <form aria-label="Workspace creation" />;
  },
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.disabled = false;
  mocks.updateProfile.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
async function render() {
  await act(async () => root.render(<CreateWorkspacePage />));
}
it("places a single Go back button above Create your account, outside the form", async () => {
  await render();
  const button = host.querySelector("button");
  const heading = host.querySelector("h4");
  expect(heading?.textContent).toBe("Create your account");
  expect(button?.textContent).toBe("Go back");
  expect(host.querySelectorAll("button")).toHaveLength(1);
  expect(button?.parentElement).toBe(heading?.parentElement);
  expect(button?.nextElementSibling).toBe(heading);
  expect(button?.closest("form")).toBeNull();
  expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({ showBackButton: false }));
  await act(() => button?.click());
  expect(mocks.back).toHaveBeenCalledOnce();
});
it("preserves updating the selected workspace and navigating after creation", async () => {
  await render();
  const props = mocks.form.mock.calls[0][0] as ComponentProps<typeof CreateWorkspaceForm>;
  await props.onSubmit?.({ id: "workspace-id", slug: "new-account" } as Parameters<
    NonNullable<typeof props.onSubmit>
  >[0]);
  expect(mocks.updateProfile).toHaveBeenCalledWith({ last_workspace_id: "workspace-id" });
  expect(mocks.push).toHaveBeenCalledWith("/new-account");
});
it("keeps back navigation available when workspace creation is disabled", async () => {
  mocks.disabled = true;
  await render();
  expect(mocks.form).not.toHaveBeenCalled();
  const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Go back");
  await act(() => button?.click());
  expect(mocks.back).toHaveBeenCalledOnce();
});
