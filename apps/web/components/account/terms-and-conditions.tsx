/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { EAuthModes } from "@plane/constants";

interface TermsAndConditionsProps {
  authType?: EAuthModes;
}

// Constants for better maintainability
const LEGAL_LINKS = {
  termsOfService: "#",
  privacyPolicy: "#",
} as const;

const MESSAGES = {
  [EAuthModes.SIGN_UP]: "By creating an account",
  [EAuthModes.SIGN_IN]: "By signing in",
} as const;

// Reusable link component to reduce duplication
function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-secondary">
      <span className="text-13 font-medium underline hover:cursor-pointer">{children}</span>
    </a>
  );
}

export function TermsAndConditions({ authType = EAuthModes.SIGN_IN }: TermsAndConditionsProps) {
  if (authType === EAuthModes.SIGN_IN) return null;

  return (
    <div className="flex items-center justify-center">
      <p className="text-center text-13 whitespace-pre-line text-tertiary">
        {`${MESSAGES[authType]}, you understand and agree to \n our `}
        <LegalPolicyLinks />.
      </p>
    </div>
  );
}

export function LegalPolicyLinks({ termsLabel = "Terms of Service" }: { termsLabel?: string }) {
  return (
    <>
      <LegalLink href={LEGAL_LINKS.termsOfService}>{termsLabel}</LegalLink> and{" "}
      <LegalLink href={LEGAL_LINKS.privacyPolicy}>Privacy Policy</LegalLink>
    </>
  );
}
