import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FavoriteItemWrapper } from "@/components/workspace/sidebar/favorites/favorite-items/common/favorite-item-wrapper";
import { SidebarAddButton } from "./add-button";
import { SidebarNavItem } from "./sidebar-navigation";

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

it.each([false, true])("styles navigation hover and selected state (active: %s)", async (isActive) => {
  await act(() => root.render(<SidebarNavItem isActive={isActive}>Home</SidebarNavItem>));
  const item = host.firstElementChild;
  expect(item?.classList.contains("border")).toBe(true);
  expect(item?.classList.contains("hover:bg-[#EAF2FF]")).toBe(true);
  expect(item?.classList.contains("hover:border-[#CBDCF8]")).toBe(true);
  expect(item?.classList.contains("bg-[#EAF2FF]")).toBe(isActive);
  expect(item?.classList.contains("border-[#CBDCF8]")).toBe(isActive);
  expect(item?.classList.contains("border-transparent")).toBe(!isActive);
  expect(item?.classList.contains("dark:hover:bg-layer-transparent-hover")).toBe(true);
  expect(item?.classList.contains("text-[#344867]")).toBe(!isActive);
  expect(item?.classList.contains("dark:text-secondary")).toBe(!isActive);
});

it.each([false, true])("keeps favorite rows consistent (menu active: %s)", async (isMenuActive) => {
  await act(() =>
    root.render(
      <FavoriteItemWrapper elementRef={createRef<HTMLDivElement>()} isMenuActive={isMenuActive}>
        Favorite
      </FavoriteItemWrapper>
    )
  );
  expect(host.firstElementChild?.classList.contains("hover:bg-[#EAF2FF]")).toBe(true);
  expect(host.firstElementChild?.classList.contains("bg-[#EAF2FF]")).toBe(isMenuActive);
  expect(host.firstElementChild?.classList.contains("border-[#CBDCF8]")).toBe(isMenuActive);
});

it("uses a neutral creation action and preserves click and disabled behavior", async () => {
  const onClick = vi.fn();
  const render = (disabled: boolean) =>
    act(() => root.render(<SidebarAddButton label="New work item" onClick={onClick} disabled={disabled} />));
  await render(false);
  const button = host.querySelector("button");
  expect(button?.classList.contains("!bg-[#0c0a0b0f]")).toBe(true);
  expect(button?.classList.contains("!text-primary")).toBe(true);
  await act(() => button?.click());
  expect(onClick).toHaveBeenCalledOnce();
  await render(true);
  expect(button?.disabled).toBe(true);
  await act(() => button?.click());
  expect(onClick).toHaveBeenCalledOnce();
});
