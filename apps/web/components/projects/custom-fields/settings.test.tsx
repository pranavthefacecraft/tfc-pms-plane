/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import type { PropsWithChildren } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EUserPermissions,
  EUserPermissionsLevel,
  GROUPED_PROJECT_SETTINGS,
  PROJECT_SETTINGS,
  PROJECT_SETTINGS_CATEGORY,
} from "@plane/constants";
import CustomFieldsSettingsPage from "@/app/(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/custom-fields/page";

const mocks = vi.hoisted(() => ({
  allowed: true,
  archived: false,
  manager: vi.fn(),
  permissions: vi.fn(),
  translate: vi.fn(),
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      mocks.translate(key, options);
      return options?.defaultValue ?? key;
    },
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ currentProjectDetails: { name: "Project", archived_at: mocks.archived ? "2026-01-01" : null } }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    allowPermissions: (...args: unknown[]) => {
      mocks.permissions(...args);
      return mocks.allowed;
    },
  }),
}));
vi.mock("@/components/auth-screens/not-authorized-view", () => ({
  NotAuthorizedView: () => <div>Not authorized</div>,
}));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children }: PropsWithChildren) => <main>{children}</main>,
}));
vi.mock("@/components/settings/page-header", () => ({ SettingsPageHeader: () => null }));
vi.mock("./manager", () => ({
  ProjectCustomFieldsManager: (props: unknown) => {
    mocks.manager(props);
    return <div>Field manager</div>;
  },
}));

describe("custom fields project settings", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowed = true;
    mocks.archived = false;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    host.remove();
  });

  async function render() {
    await act(() =>
      root.render(<CustomFieldsSettingsPage params={{ workspaceSlug: "workspace", projectId: "project" }} />)
    );
  }

  it("registers Custom fields after Estimates in Work Structure", () => {
    const items = GROUPED_PROJECT_SETTINGS[PROJECT_SETTINGS_CATEGORY.WORK_STRUCTURE];
    expect(items.map((item) => item.key)).toEqual(["states", "labels", "estimates", "custom_fields"]);
    expect(PROJECT_SETTINGS.custom_fields.href).toBe("/custom-fields");
    expect(PROJECT_SETTINGS.custom_fields.access).toEqual([EUserPermissions.ADMIN, EUserPermissions.MEMBER]);
  });

  it("opens the existing manager for the current project and preserves admin/member access", async () => {
    await render();
    expect(host.querySelector("h1")?.textContent).toBe("Custom fields");
    expect(mocks.translate).toHaveBeenCalledWith("project_settings.custom_fields", { defaultValue: "Custom fields" });
    expect(mocks.permissions).toHaveBeenCalledWith(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      "workspace",
      "project"
    );
    expect(mocks.manager).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceSlug: "workspace", projectId: "project", disabled: false })
    );
  });

  it("does not mount or fetch the manager for unauthorized users", async () => {
    mocks.allowed = false;
    await render();
    expect(host.textContent).toContain("Not authorized");
    expect(mocks.manager).not.toHaveBeenCalled();
  });

  it("makes archived project fields read-only", async () => {
    mocks.archived = true;
    await render();
    expect(mocks.manager).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
    expect(host.textContent).toContain("Archived projects are read-only");
  });
});
