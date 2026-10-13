/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

// TFC PMS Logo lockup.

type PlaneLockupProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
  color?: string;
};

export function PlaneLockup({ width = "150", height = "50", className }: PlaneLockupProps) {
  return (
    <img
      src="/god-mode/tfc-pms-logo.png"
      alt="TFC PMS"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain", height: typeof height === "number" ? `${height}px` : height, width: "auto" }}
    />
  );
}
