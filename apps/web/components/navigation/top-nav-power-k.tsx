/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useCallback, useEffect } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CloseOutline, SearchOutline } from "@makeplane/propel/icons";
import { CheckCircle2, Folder, Users, FileText, Paperclip, Command as CommandIcon } from "lucide-react";
import { cn } from "@plane/utils";
import { usePowerK } from "@/hooks/store/use-power-k";
import { useExpandableSearch } from "@/hooks/use-expandable-search";
import { WorkspaceSearch } from "./workspace-search";
import type { SearchCategory } from "./workspace-search";

const categories = [
  { key: "all", label: "All", icon: SearchOutline },
  { key: "tasks", label: "Tasks", icon: CheckCircle2 },
  { key: "projects", label: "Projects", icon: Folder },
  { key: "people", label: "People", icon: Users },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "files", label: "Files", icon: Paperclip },
] as const;

export const TopNavPowerK = observer(function TopNavPowerK() {
  const { workspaceSlug } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const { setTopNavInputRef, togglePowerKModal } = usePowerK();
  const onClose = useCallback(() => {
    setSearchTerm("");
    setCategory("all");
  }, []);
  const { isOpen, containerRef, inputRef, handleClose, handleMouseDown, handleFocus, openPanel } = useExpandableSearch({
    onClose,
  });

  useEffect(() => {
    setTopNavInputRef(inputRef);
    return () => setTopNavInputRef(null);
  }, [setTopNavInputRef, inputRef]);

  return (
    <div ref={containerRef} className="relative">
      <Command shouldFilter={false} className="flex w-full flex-col">
        <div
          className={cn("relative z-30 flex w-[364px] max-w-[calc(100vw-100px)] items-center", {
            "w-[554px]": isOpen,
          })}
        >
          <div className="flex h-8 w-full items-center rounded-lg border border-subtle-1 bg-layer-2 px-2">
            <SearchOutline className="mr-2 size-3.5 shrink-0 text-placeholder" />
            <Command.Input
              ref={inputRef}
              value={searchTerm}
              onValueChange={(value) => {
                setSearchTerm(value);
                openPanel();
              }}
              onMouseDown={handleMouseDown}
              onFocus={handleFocus}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                  event.preventDefault();
                  handleClose();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  handleClose();
                }
              }}
              aria-label="Search"
              aria-expanded={isOpen}
              placeholder="Search all PMS..."
              className="placeholder-text-placeholder min-w-0 flex-1 bg-transparent text-13 text-primary outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchTerm("");
                  inputRef.current?.focus();
                }}
                className="ml-2 shrink-0"
              >
                <CloseOutline className="size-3.5 text-placeholder hover:text-primary" />
              </button>
            )}
          </div>
        </div>
        {isOpen && (
          <div className="shadow-lg absolute -top-[6px] -left-2 z-20 flex max-h-[80vh] w-[574px] max-w-[calc(100vw-84px)] flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1 pt-10">
            <div
              role="group"
              aria-label="Search categories"
              className="flex flex-wrap gap-2 border-b border-subtle px-3 py-3"
            >
              {categories.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={category === key}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border border-subtle px-3 py-1 text-12 font-medium text-secondary hover:bg-layer-2",
                    {
                      "border-[#CBDCF8] bg-[#EAF2FF] text-[#135DDD] dark:bg-layer-2": category === key,
                    }
                  )}
                  onClick={() => {
                    setCategory(key);
                    inputRef.current?.focus();
                  }}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-subtle px-3 py-1 text-12 font-medium text-secondary hover:bg-layer-2"
                onClick={() => {
                  handleClose();
                  togglePowerKModal(true);
                }}
              >
                <CommandIcon className="size-3.5" />
                Commands
              </button>
            </div>
            <Command.List className="vertical-scrollbar scrollbar-sm max-h-[60vh] overflow-y-auto px-2 py-2 outline-none">
              <WorkspaceSearch
                workspaceSlug={workspaceSlug?.toString() || ""}
                searchTerm={searchTerm}
                category={category}
                onClose={handleClose}
              />
            </Command.List>
            <div className="border-t border-subtle px-3 py-2 text-11 text-tertiary">
              All your workspaces - Use arrow keys to navigate, Enter to open
            </div>
          </div>
        )}
      </Command>
    </div>
  );
});
