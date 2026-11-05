/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { ScrollArea } from "@makeplane/propel/components/scroll-area";
// local imports
import { ProjectSettingsSidebarHeader } from "./header";
import { ProjectSettingsSidebarItemCategories } from "./item-categories";

type Props = {
  projectId: string;
};

export function ProjectSettingsSidebarRoot(props: Props) {
  const { projectId } = props;

  return (
    <div className="flex h-full w-[250px] shrink-0 animate-fade-in flex-col overflow-hidden border-r border-[#E2E6EF] bg-surface-1 dark:border-subtle">
      <div className="flex h-[73px] shrink-0 items-center px-3">
        <img
          src="/clevdex-pms-lockup.svg"
          alt="PMS by Clevdex"
          width={184}
          height={40}
          className="h-auto max-w-full rounded-md bg-white"
        />
      </div>
      <ScrollArea orientation="vertical">
        <div className="pb-5">
          <ProjectSettingsSidebarHeader projectId={projectId} />
          <ProjectSettingsSidebarItemCategories projectId={projectId} />
        </div>
      </ScrollArea>
    </div>
  );
}
