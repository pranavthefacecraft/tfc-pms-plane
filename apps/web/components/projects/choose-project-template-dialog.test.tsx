/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TProjectSection } from "@/services/project/project-section.service";
import { ChooseProjectTemplateDialog } from "./choose-project-template-dialog";
import { GENERAL_TEMPLATE_STAGES, applyProjectTemplate } from "./project-templates";

vi.mock("@makeplane/propel/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

function sectionApi(sections: TProjectSection[]) {
  const calls: string[] = [];
  return {
    calls,
    list: vi.fn(async () => sections),
    create: vi.fn(async (_slug: string, _project: string, name: string) => {
      calls.push(`create ${name}`);
      return { id: name, name, sort_order: 1 };
    }),
    update: vi.fn(async (_slug: string, _project: string, id: string, data: { name?: string }) => {
      calls.push(`rename ${id} ${data.name}`);
      return { id, name: data.name ?? "", sort_order: 0 };
    }),
    remove: vi.fn(async (_slug: string, _project: string, id: string) => {
      calls.push(`remove ${id}`);
    }),
  };
}

describe("applyProjectTemplate", () => {
  const untitled = { id: "d1", name: "Untitled section", sort_order: 0, is_default: true };

  it("removes the default section for a blank project", async () => {
    const api = sectionApi([untitled]);
    await applyProjectTemplate(api, "acme", "p1", "blank");
    expect(api.calls).toEqual(["remove d1"]);
  });

  it("turns the default section into To Do and adds the other General stages in order", async () => {
    const api = sectionApi([untitled]);
    await applyProjectTemplate(api, "acme", "p1", "general");
    expect(api.calls).toEqual(["rename d1 To Do", "create In Progress", "create Review", "create Done"]);
    expect(GENERAL_TEMPLATE_STAGES).toEqual(["To Do", "In Progress", "Review", "Done"]);
  });

  it("creates every General stage when there is no default section", async () => {
    const api = sectionApi([]);
    await applyProjectTemplate(api, "acme", "p1", "general");
    expect(api.calls).toEqual(["create To Do", "create In Progress", "create Review", "create Done"]);
    await applyProjectTemplate(api, "acme", "p1", "blank");
    expect(api.remove).not.toHaveBeenCalled();
  });
});

describe("ChooseProjectTemplateDialog", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onClose = vi.fn();
  const onChoose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<ChooseProjectTemplateDialog isOpen onClose={onClose} onChoose={onChoose} />));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = (text: string) =>
    [...host.querySelectorAll("button")].find((node) => node.textContent?.startsWith(text)) as HTMLButtonElement;

  it("offers Blank Project and General Template like the Figma design", () => {
    expect(host.querySelector("h2")?.textContent).toBe("Choose a Project");
    expect(button("Blank Project").textContent).toBe("Blank ProjectStart with no stages.");
    expect(button("General Template").textContent).toBe(
      "General TemplateStart with To Do, In Progress, Review, and Done."
    );
  });

  it("reports the chosen template and closes", () => {
    act(() => button("General Template").click());
    expect(onChoose).toHaveBeenCalledWith("general");
    act(() => button("Blank Project").click());
    expect(onChoose).toHaveBeenCalledWith("blank");
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
    expect(onClose).toHaveBeenCalled();
  });
});
