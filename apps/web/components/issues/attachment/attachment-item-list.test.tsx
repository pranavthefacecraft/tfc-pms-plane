import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { TAttachmentHelpers } from "../issue-detail-widgets/attachments/helper";
import { IssueAttachmentItemList } from "./attachment-item-list";

const state = vi.hoisted(() => ({ files: undefined as string[] | undefined }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "Attach" }) }));
vi.mock("@/hooks/use-file-size", () => ({ useFileSize: () => ({ maxFileSize: 1024 }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ attachment: { getAttachmentsByIssueId: () => state.files } }),
}));
vi.mock("./attachment-list-item", () => ({
  IssueAttachmentsListItem: ({ attachmentId }: { attachmentId: string }) => <span>{attachmentId}</span>,
}));
vi.mock("./attachment-list-upload-item", () => ({ IssueAttachmentsUploadItem: () => null }));
vi.mock("./delete-attachment-modal", () => ({ IssueAttachmentDeleteModal: () => null }));

it("opens the file picker from the tile on empty and populated tasks, but hides it in read-only mode", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const attachmentHelpers = {
    snapshot: { uploadStatus: [] },
    operations: { create: vi.fn(), remove: vi.fn() },
  } satisfies TAttachmentHelpers;
  const render = (disabled = false) =>
    act(() =>
      root.render(
        <IssueAttachmentItemList
          workspaceSlug="workspace"
          projectId="project"
          issueId="task"
          attachmentHelpers={attachmentHelpers}
          disabled={disabled}
          presentation="cards"
        />
      )
    );
  try {
    await render();
    const tile = () => host.querySelector<HTMLButtonElement>('button[aria-label="Attach"]');
    const inputClick = vi.spyOn(host.querySelector<HTMLInputElement>('input[type="file"]')!, "click");
    await act(() => tile()!.click());
    expect(inputClick).toHaveBeenCalledOnce();
    state.files = ["Brief.pdf"];
    await render();
    expect(tile()?.previousElementSibling?.textContent).toBe("Brief.pdf");
    await act(() => tile()!.click());
    expect(inputClick).toHaveBeenCalledTimes(2);
    await render(true);
    expect(tile()).toBeNull();
    expect(host.textContent).toContain("Brief.pdf");
  } finally {
    await act(() => root.unmount());
    host.remove();
    state.files = undefined;
    vi.unstubAllGlobals();
  }
});
