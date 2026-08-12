// Base app bootstrap, extracted from src/index.ts (structure decomposition:
// keeps index.ts's job narrowed to sub-app mounting per DEC-012, which is
// the ONLY place app.route() may be called). This module owns request-scoped
// context wiring, the always-on session loader, the error handler, and the
// core meta endpoints (/health, /api/v1) plus the dev-mailbox mount guard.

import { Hono } from "hono";
import type { AppEnv } from "./env";
import { makeDb } from "./context";
import { sessionLoader, noStoreApi } from "./middleware";
import { registerErrorHandler } from "./http";
import { registerNotFoundHandler } from "./not-found";
import { shouldMountDevMailbox } from "../routes/dev/mailbox";
import { bumpPublicVersionMiddleware } from "./pubcache";
import { ApiError } from "./http";
import { DEC_546 } from "../decisions";

void DEC_546;

/**
 * Builds the base Hono app with request-scoped db, the always-on session
 * loader, the error handler, and core meta endpoints. Route sub-apps are
 * mounted by src/index.ts (DEC-012: it is the ONLY place that calls
 * app.route()).
 */
export function createBaseApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Request-scoped db + always-on session loader, ahead of every route.
  app.use("*", async (c, next) => {
    c.set("db", makeDb(c.env));
    await next();
  });
  app.use("*", sessionLoader);
  // DEC-083: bump the public cache version after any successful mutation,
  // ahead of every route sub-app mount (src/index.ts is the only place
  // that mounts routes, per DEC-012).
  app.use("*", bumpPublicVersionMiddleware);
  // w1-e: every /api/v1 response is request-fresh (no edge/browser caching
  // of admin/API data) — scoped to the /api/v1 prefix so public SSR
  // surfaces (which own their own Cache-Control via pubcache.ts) are
  // untouched.
  app.use("/api/v1", noStoreApi);
  app.use("/api/v1/*", noStoreApi);

  registerErrorHandler(app);

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/api/v1", (c) => c.json({ name: "chautauqua", version: "v1" }));

  // DEC-635: one 404 handler for the whole app -- last, so every mounted
  // route sub-app (src/index.ts, DEC-012) still gets first crack at
  // matching.
  registerNotFoundHandler(app);

  return app;
}

/**
 * DEC-005: /dev/mailbox is dev-only, mounted only when env.DEV_MODE === '1'.
 * Bindings are only known per-request in a Worker, so the guard runs ahead
 * of the route match and 404s (via c.notFound()) rather than delegating —
 * with DEV_MODE unset the routes are indistinguishable from not existing.
 *
 * DEC-546: behind that existence check, /dev/mailbox is also organizer-only
 * and org-scoped -- the wave-18 "public by design" disposition rested on a
 * false premise (it rendered every /claim/<token>). The existence check
 * (404) stays first and unchanged; the authz gate (redirect to /login when
 * anonymous, 403 when not an organizer) only ever runs once DEV_MODE='1'
 * has already been established, so it never leaks the routes' existence to
 * a non-dev deployment.
 *
 * This installs middleware guards only (app.use), not the sub-app mount
 * itself — index.ts still does `app.route("/", devMailboxRoutes)`.
 */
export function guardDevMailbox(app: Hono<AppEnv>): void {
  app.use("/dev/mailbox", async (c, next) => {
    if (!shouldMountDevMailbox(c.env)) return c.notFound();
    const auth = c.var.auth;
    if (!auth) return c.redirect("/login", 302);
    if (auth.role !== "organizer") throw new ApiError("forbidden", "Requires role 'organizer'");
    await next();
  });
  app.use("/dev/mailbox/*", async (c, next) => {
    if (!shouldMountDevMailbox(c.env)) return c.notFound();
    const auth = c.var.auth;
    if (!auth) return c.redirect("/login", 302);
    if (auth.role !== "organizer") throw new ApiError("forbidden", "Requires role 'organizer'");
    await next();
  });
}
