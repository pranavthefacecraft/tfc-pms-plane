/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams, Navigate } from "react-router";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PMSSettings } from "@/components/settings/pms/settings";

export default function PMSSettingsPage() {
  const { workspaceSlug, settingsTab } = useParams();
  const tab = settingsTab ?? "account";
  if (tab !== "account" && tab !== "teammates" && tab !== "billing" && tab !== "company")
    return <Navigate to={`/${workspaceSlug}/pms-settings/account`} replace />;
  return (
    <ContentWrapper>
      <PMSSettings workspaceSlug={workspaceSlug ?? ""} tab={tab} />
    </ContentWrapper>
  );
}
