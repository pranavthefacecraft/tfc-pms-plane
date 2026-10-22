/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@makeplane/propel/elements/button";
import { cn } from "@plane/utils";

type Props = React.ComponentProps<"button"> & {
  label: React.ReactNode;
  onClick: () => void;
};

export function SidebarAddButton(props: Props) {
  const { label, onClick, disabled, className, ...rest } = props;
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      stretch="full"
      onClick={onClick}
      disabled={disabled}
      render={
        <button
          className={cn(
            "!border-transparent !bg-[#0c0a0b0f] !text-primary hover:!bg-[#0c0a0b1a] dark:!bg-layer-1 dark:hover:!bg-layer-2",
            className
          )}
        />
      }
      {...rest}
    >
      <span className="flex w-full items-center justify-start gap-2">{label}</span>
    </Button>
  );
}
