/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ROLE_LABELS } from "./create-project-dialog.helpers";

/** The project creator is shown as Owner; everyone else by project role (Admin, Editor, Viewer). */
export function accessRoleLabel(userId: string, ownerId: string | undefined, role: number | undefined) {
  if (ownerId && userId === ownerId) return "Owner";
  return (role !== undefined && ROLE_LABELS[role]) || "Member";
}

/** Public projects (network 2) are open to the whole workspace; private ones only to invited teammates. */
export function accessNote(network: number | undefined) {
  return network === 2
    ? "Everyone in the workspace can open this project"
    : "Only invited teammates can open this project";
}
