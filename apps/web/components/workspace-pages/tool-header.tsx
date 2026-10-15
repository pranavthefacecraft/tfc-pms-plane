/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { ToolOutline } from "@makeplane/propel/icons";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// services
import type { TWorkspacePage, TWorkspaceToolType } from "@/services/page/workspace-page.service";
// local imports
import {
  TOOL_TYPE_LABELS,
  WORKSPACE_PAGE_DETAIL_SWR_KEY,
  getToolTypeIcon,
  getWorkspacePageName,
  getWorkspaceToolListHref,
} from "./helpers";
import { useCreateWorkspacePage } from "./use-create-page";

type Props = {
  toolType: TWorkspaceToolType;
};

export const WorkspaceToolHeader = observer(function WorkspaceToolHeader({ toolType }: Props) {
  const { workspaceSlug, pageId } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const currentPageId = pageId?.toString();
  const labels = TOOL_TYPE_LABELS[toolType];
  const ToolIcon = getToolTypeIcon(toolType);
  // hooks
  const { createPage, isCreating } = useCreateWorkspacePage(slug, toolType);
  // the detail view populates this cache entry; the header only reads it
  const { data: page } = useSWR<TWorkspacePage>(
    currentPageId ? WORKSPACE_PAGE_DETAIL_SWR_KEY(slug, currentPageId) : null,
    null
  );

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={<BreadcrumbLink label="Tool" icon={<ToolOutline className="size-4 text-tertiary" />} />}
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={labels.plural}
                href={currentPageId ? getWorkspaceToolListHref(slug, toolType) : undefined}
                icon={<ToolIcon className="size-4 text-tertiary" />}
              />
            }
          />
          {currentPageId && (
            <Breadcrumbs.Item component={<BreadcrumbLink label={page ? getWorkspacePageName(page) : "..."} />} />
          )}
        </Breadcrumbs>
      </Header.LeftItem>
      {!currentPageId && (
        <Header.RightItem>
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={`Create ${labels.singular}`}
            loading={isCreating}
            onClick={() => void createPage()}
          />
        </Header.RightItem>
      )}
    </Header>
  );
});
