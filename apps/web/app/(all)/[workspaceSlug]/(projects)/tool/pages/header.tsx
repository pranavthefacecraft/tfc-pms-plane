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
import { PagesOutline, ToolOutline } from "@makeplane/propel/icons";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { getWorkspacePageName } from "@/components/workspace-pages/helpers";
import { WORKSPACE_PAGE_DETAIL_SWR_KEY } from "@/components/workspace-pages/page-detail-root";
import { useCreateWorkspacePage } from "@/components/workspace-pages/use-create-page";
// services
import type { TWorkspacePage } from "@/services/page/workspace-page.service";

export const WorkspaceToolPagesHeader = observer(function WorkspaceToolPagesHeader() {
  const { workspaceSlug, pageId } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const currentPageId = pageId?.toString();
  // hooks
  const { createPage, isCreating } = useCreateWorkspacePage(slug);
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
                label="Pages"
                href={currentPageId ? `/${slug}/tool/pages/` : undefined}
                icon={<PagesOutline className="size-4 text-tertiary" />}
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
            label="Create page"
            loading={isCreating}
            onClick={() => void createPage()}
          />
        </Header.RightItem>
      )}
    </Header>
  );
});
