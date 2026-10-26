import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MessageComposer } from "./composer";
import { draftKey, emptyDraft, loadDraft } from "./draft";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  send: vi.fn(),
  toast: vi.fn(),
  close: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { fetchWorkspaceMembers: mocks.fetch } }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "self" } }) }));
vi.mock("@/services/workspace-message.service", () => ({ workspaceMessageService: { send: mocks.send } }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));

const member = (id: string, name: string, active = true, bot = false) => ({
  id: `membership-${id}`,
  is_active: active,
  member: { id, display_name: name, first_name: name, last_name: "", is_bot: bot },
});
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  mocks.fetch.mockResolvedValue([
    member("self", "Me"),
    member("alice", "Alice"),
    member("bob", "Bob"),
    member("inactive", "Inactive", false),
    member("bot", "Bot", true, true),
  ]);
  mocks.send.mockResolvedValue({ id: "sent" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(userId = "self", workspaceSlug = "team") {
  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <MessageComposer
          key={`${userId}:${workspaceSlug}`}
          userId={userId}
          workspaceSlug={workspaceSlug}
          onClose={mocks.close}
        />
      </SWRConfig>
    );
  });
}
async function type(label: string, value: string) {
  const input = host.querySelector(`[aria-label="${label}"]`);
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) throw new Error(`Missing ${label}`);
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function button(text: string) {
  const element = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === text);
  if (!element) throw new Error(`Missing button ${text}`);
  return element;
}
async function fill() {
  await type("Subject", "Workspace news");
  await type("Message", "Hello team");
  await act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
}

it("offers only active human workspace recipients other than the sender", async () => {
  await render();
  expect(mocks.fetch).toHaveBeenCalledWith("team");
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
  expect(host.textContent).toContain("Alice");
  expect(host.textContent).toContain("Bob");
  expect(host.textContent).not.toContain("Inactive");
  expect(host.textContent).not.toContain("Bot");
  expect(button("Send").disabled).toBe(true);
  await type("Search workspace members", "bob");
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  expect(host.textContent).not.toContain("Alice");
});

it("saves subject, body and recipients and restores after unmount/refresh", async () => {
  await render();
  await fill();
  const saved = loadDraft(draftKey("self", "team"));
  expect(saved.subject).toBe("Workspace news");
  expect(saved.body).toBe("Hello team");
  expect(saved.recipients).toEqual(["alice"]);
  await act(() => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector<HTMLInputElement>('[aria-label="Subject"]')?.value).toBe(saved.subject);
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Message"]')?.value).toBe(saved.body);
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
});

it("keeps saved drafts isolated by user and workspace", async () => {
  await render();
  await fill();
  await render("other-user", "team");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Subject"]')?.value).toBe("");
  await render("self", "other-workspace");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Subject"]')?.value).toBe("");
  expect(loadDraft(draftKey("self", "team")).subject).toBe("Workspace news");
});

it("sends the draft once and clears it only after success", async () => {
  await render();
  await fill();
  expect(button("Send").disabled).toBe(false);
  const id = loadDraft(draftKey("self", "team")).id;
  await act(() => button("Send").click());
  expect(mocks.send).toHaveBeenCalledExactlyOnceWith("team", {
    id,
    subject: "Workspace news",
    body: "Hello team",
    recipients: ["alice"],
  });
  expect(localStorage.getItem(draftKey("self", "team"))).toBeNull();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Message sent" }));
});

it("keeps ambiguous failed sends immutable and retries the exact payload", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.send.mockRejectedValueOnce(new Error("Network failed")).mockResolvedValueOnce({});
  await render();
  await fill();
  await act(() => button("Send").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Retry Send");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Subject"]')?.disabled).toBe(true);
  expect(loadDraft(draftKey("self", "team")).attempted).toBe(true);
  await act(() => button("Retry Send").click());
  expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0]);
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("allows corrections after a definitive validation error", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.send.mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 400, data: { error: "Recipient removed" } },
  });
  await render();
  await fill();
  await act(() => button("Send").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Recipient removed");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Subject"]')?.disabled).toBe(false);
  expect(loadDraft(draftKey("self", "team")).attempted).toBe(false);
});

it("can minimize, restore, close and reopen without losing the draft", async () => {
  await render();
  await fill();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Minimize message"]')?.click());
  expect(host.querySelector("form")).toBeNull();
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Restore message"]')?.click());
  expect(host.querySelector<HTMLInputElement>('[aria-label="Subject"]')?.value).toBe("Workspace news");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Save draft and close"]')?.click());
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(loadDraft(draftKey("self", "team")).body).toBe("Hello team");
});

it("requires confirmation before deleting a saved draft", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await render();
  await fill();
  await act(() => button("Discard draft").click());
  expect(localStorage.getItem(draftKey("self", "team"))).not.toBeNull();
  confirm.mockReturnValue(true);
  await act(() => button("Discard draft").click());
  expect(localStorage.getItem(draftKey("self", "team"))).toBeNull();
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("warns explicitly when draft storage is corrupted or unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem(draftKey("self", "team"), "not-json");
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not restore");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Quota exceeded");
  });
  await type("Subject", "Unsaved");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be saved");
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Save draft and close"]')?.click());
  expect(mocks.close).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Keep this window open");
});

it("shows member-fetch failures and does not allow sending", async () => {
  mocks.fetch.mockRejectedValue(new Error("Unavailable"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not load workspace members");
  expect(button("Send").disabled).toBe(true);
});

it("removes recipients that are no longer in the workspace from a restored draft", async () => {
  localStorage.setItem(
    draftKey("self", "team"),
    JSON.stringify({ ...emptyDraft(), subject: "Update", body: "Hello", recipients: ["removed"] })
  );
  await render();
  expect(button("Send").disabled).toBe(true);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("no longer workspace members");
  await act(() => button("Remove unavailable recipients").click());
  expect(loadDraft(draftKey("self", "team")).recipients).toEqual([]);
});
