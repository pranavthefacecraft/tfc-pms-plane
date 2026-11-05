/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MemberSelect } from "./member-select";

const mocks = vi.hoisted(() => ({
  block: vi.fn((_props: { getValues: (params: { search: string }) => Promise<{ results: { id: string }[] }> }) => null),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/blocks/property-select", () => ({ MemberSelect: mocks.block }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "acme" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "me" } }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: () => ({
      id: "ann",
      display_name: "Ann",
      first_name: "Ann",
      last_name: "Lee",
      email: "ann@acme.test",
    }),
    project: {},
    workspace: { workspaceMemberIds: ["ann"], isUserSuspended: () => false },
  }),
}));

describe("member search", () => {
  it("matches both names and email addresses in the workspace roster", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(() => root.render(<MemberSelect value={null} onChange={vi.fn()} variant="select-lg" />));
      const { getValues } = mocks.block.mock.calls[0][0];
      expect((await getValues({ search: "ANN@ACME.TEST" })).results.map((member) => member.id)).toEqual(["ann"]);
      expect((await getValues({ search: "Lee" })).results.map((member) => member.id)).toEqual(["ann"]);
      expect((await getValues({ search: "unknown@example.test" })).results).toEqual([]);
    } finally {
      act(() => root.unmount());
    }
  });
});
