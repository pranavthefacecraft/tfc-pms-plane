/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { PageHead } from "@/components/core/page-title";
import { PMSAccount } from "./account";
import { PMSTeammates } from "./teammates";

export function PMSSettings({ workspaceSlug, tab }: { workspaceSlug: string; tab: "account" | "teammates" }) {
  const account = tab === "account";
  return (
    <div className="p-4 md:p-7">
      <PageHead title="PMS Settings" />
      <h1 className="mb-5 text-20 font-semibold">Settings</h1>
      <section className="max-w-5xl rounded-lg border border-[#E2E6EF] bg-surface-1 p-4 md:p-6">
        <h2 className="text-18 font-semibold">{account ? "Account" : "Teammates"}</h2>
        <p className="mt-1 text-13 text-secondary">
          {account ? "Manage personal details and account security." : "Manage access to projects and shared work."}
        </p>
        <nav aria-label="PMS settings" className="my-5 flex gap-5 border-b border-subtle">
          {(["account", "teammates"] as const).map((value) => (
            <Link
              key={value}
              href={`/${workspaceSlug}/pms-settings/${value}`}
              aria-current={tab === value ? "page" : undefined}
              className={`border-b-2 pb-3 text-13 font-medium ${tab === value ? "border-[#135DDD] text-[#135DDD]" : "border-transparent text-secondary hover:text-primary"}`}
            >
              {value === "account" ? "Account" : "Teammates"}
            </Link>
          ))}
        </nav>
        {account ? <PMSAccount /> : <PMSTeammates workspaceSlug={workspaceSlug} />}
      </section>
    </div>
  );
}
