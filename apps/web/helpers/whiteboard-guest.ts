/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isWhiteboardGuestPath = (path: string | null) =>
  !!path &&
  /^\/[\w-]+\/tool\/(?:whiteboards|shared-whiteboards\/[\w-]+)\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\/?(?:\?[^#]*)?$/i.test(
    path
  );

export const isNotepadGuestPath = (path: string | null) =>
  !!path && /^\/shared\/notepads\/[\w-]+\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\/?(?:\?[^#]*)?$/i.test(path);
