/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export function LogoSpinner() {
  return (
    <div role="status" aria-label="Loading Clevdex" className="flex items-center justify-center">
      <img
        src="/clevdex-loading-logo.png"
        alt="Clevdex"
        className="h-auto w-24 max-w-full object-contain motion-safe:animate-pulse sm:w-32"
      />
    </div>
  );
}
