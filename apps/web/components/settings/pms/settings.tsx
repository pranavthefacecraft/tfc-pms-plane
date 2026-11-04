/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { PageHead } from "@/components/core/page-title";
import { PMSAccount } from "./account";
import { PMSTeammates } from "./teammates";
import { PMSBilling } from "./billing";
import { PMSCompany } from "./company";

const settingsTabs = {
  account: { title: "Account", description: "Manage personal details and account security." },
  teammates: { title: "Teammates", description: "Manage access to projects and shared work." },
  billing: { title: "Billing", description: "Manage your plan, payments, and invoices." },
  company: { title: "Company", description: "Manage your business details used across PMS." },
};

export function PMSSettings({ workspaceSlug, tab }: { workspaceSlug: string; tab: keyof typeof settingsTabs }) {
  return (
    <div className="p-4 md:p-7">
      <PageHead title="PMS Settings" />
      <h1 className="mb-5 text-20 font-semibold">Settings</h1>
      <section className="max-w-5xl rounded-lg border border-[#E2E6EF] bg-surface-1 p-4 md:p-6">
        <h2 className="text-18 font-semibold">{settingsTabs[tab].title}</h2>
        <p className="mt-1 text-13 text-secondary">{settingsTabs[tab].description}</p>
        <nav aria-label="PMS settings" className="my-5 flex gap-5 overflow-x-auto border-b border-subtle">
          {(["account", "teammates", "billing", "company"] as const).map((value) => (
            <Link
              key={value}
              href={`/${workspaceSlug}/pms-settings/${value}`}
              aria-current={tab === value ? "page" : undefined}
              className={`border-b-2 pb-3 text-13 font-medium ${tab === value ? "border-[#135DDD] text-[#135DDD]" : "border-transparent text-secondary hover:text-primary"}`}
            >
              {settingsTabs[value].title}
            </Link>
          ))}
        </nav>
        {tab === "account" && <PMSAccount />}
        {tab === "teammates" && <PMSTeammates workspaceSlug={workspaceSlug} />}
        {tab === "billing" && <PMSBilling workspaceSlug={workspaceSlug} />}
        {tab === "company" && <PMSCompany key={workspaceSlug} workspaceSlug={workspaceSlug} />}
      </section>
    </div>
  );
}
