/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import clevdexLoadingLogo from "@/app/assets/logos/clevdex-loading-logo.png";

export function LogoSpinner() {
  return (
    <div role="status" aria-label="Loading Clevdex" className="flex items-center justify-center">
      <img
        src={clevdexLoadingLogo}
        alt="Clevdex"
        className="h-auto w-24 max-w-full object-contain motion-safe:animate-pulse sm:w-32"
      />
    </div>
  );
}
