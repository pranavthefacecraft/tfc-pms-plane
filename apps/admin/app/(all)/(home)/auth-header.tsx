/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import clevdexLogo from "@/app/assets/logos/clevdex-logo.png";
import { PlaneLockup } from "@/components/common/plane-lockup";

export function AuthHeader({ centered = false }: { centered?: boolean }) {
  return (
    <div
      className={
        centered
          ? "flex w-full justify-center"
          : "sticky top-0 flex w-full flex-shrink-0 items-center justify-between gap-6"
      }
    >
      <Link href="/">
        {centered ? (
          <img src={clevdexLogo} alt="Clevdex" className="h-auto w-32 max-w-full object-contain" />
        ) : (
          <PlaneLockup height={28} className="text-primary" />
        )}
      </Link>
    </div>
  );
}
