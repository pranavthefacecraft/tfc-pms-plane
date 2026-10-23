/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { AuthRoot } from "@/components/account/auth-forms/auth-root";
import type { EAuthModes } from "@/helpers/authentication.helper";
import { AuthHeader } from "./header";

type AuthBaseProps = {
  authType: EAuthModes;
};

export function AuthBase({ authType }: AuthBaseProps) {
  return (
    <div className="auth-page auth-entry-page relative z-10 flex min-h-screen w-full flex-col items-center px-4 py-10 sm:px-8">
      <div className="my-auto flex w-full max-w-[22.5rem] flex-col gap-8">
        <AuthHeader type={authType} centered />
        <AuthRoot authMode={authType} />
      </div>
    </div>
  );
}
