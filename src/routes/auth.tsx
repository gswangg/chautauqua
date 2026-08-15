// Auth routes per DEC-005 (route map) + DEC-012 (SSR login) + DEC-014 (claim
// flow). Route files export a named Hono sub-app; only src/index.ts mounts
// it (DEC-012). Handlers stay thin: parse/authz -> repo query -> response.
//
// This file is a thin composer over three sibling route modules (split from
// a single 948-line file to reduce merge contention -- no behavior change):
//   - ./auth-login.tsx  -- /login, /logout
//   - ./auth-claim.tsx  -- /claim/:token
//   - ./auth-reset.tsx  -- /forgot, /reset/:token
// Shared view components live in ./auth-views.tsx; shared non-view helpers
// (csrf cookie bootstrap, single-event lookup, demo-identity gating, the
// login status line, reset-email copy) live in ./auth-helpers.ts.

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { loginRoutes } from "./auth-login";
import { claimRoutes } from "./auth-claim";
import { resetRoutes } from "./auth-reset";

// Statement-form mounts, one per line, matching src/routes/review/index.ts --
// NOT a `new Hono().route(...).route(...)` chain. test/helpers/registered-
// routes.ts resolves each sub-app's mounted prefix by matching
// `<parent>.route("<prefix>", <child>)` with a NAMED receiver, so a chained
// composition leaves every child (loginRoutes/claimRoutes/resetRoutes)
// looking unmounted and fails the route enumeration guards.
export const authRoutes = new Hono<AppEnv>();
authRoutes.route("/", loginRoutes);
authRoutes.route("/", claimRoutes);
authRoutes.route("/", resetRoutes);

// Re-exported for callers that reached into this file directly before the
// split (test/*, src/routes/account.tsx).
export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./auth-views";
export {
  loginStatusLine,
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_RATE_LIMIT_MAX,
  RATE_LIMIT_ERROR,
} from "./auth-helpers";
