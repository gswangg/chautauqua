// Portal tasks — tiny cross-submodule helpers.
//
// Split out of the former single-file src/routes/portal/tasks.tsx (a
// merge-conflict hotspot) so both ./views.tsx and ./resources.tsx (and the
// task routes in ../tasks.tsx) can share requireAuth/ensureCsrfCookie
// without a circular import back into the barrel file.

import type { Context } from "hono";
import type { AppEnv, AuthInfo } from "../../../server/env";
import { ApiError } from "../../../server/http";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../../auth/cookies";
import {
  assertOwnAssignment,
  ForeignAssignmentError,
  type PortalAssignmentScope,
} from "../../../server/repo/portal";

export function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

export function ensureCsrfCookie(c: Context<AppEnv>): { token: string; setCookieIfNew: string | null } {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

export function assertOwnAssignmentOr403(scope: PortalAssignmentScope, contactId: string): void {
  try {
    assertOwnAssignment(scope, contactId);
  } catch (err) {
    if (err instanceof ForeignAssignmentError) {
      throw new ApiError("forbidden", "This task assignment does not belong to you");
    }
    throw err;
  }
}
