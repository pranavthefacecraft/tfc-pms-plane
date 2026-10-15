/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTheme } from "next-themes";

export function LogoSpinner() {
  const { resolvedTheme } = useTheme();

  const isLightTheme = resolvedTheme === "light" || resolvedTheme === "light-contrast";

  return (
    <div role="status" aria-label="Loading TFCPMS" className="flex items-center justify-center">
      <img
        src="/tfc-pms-logo.png"
        alt="TFCPMS"
        className={`h-6 w-auto object-contain motion-safe:animate-pulse sm:h-11${isLightTheme ? " invert" : ""}`}
      />
    </div>
  );
}
