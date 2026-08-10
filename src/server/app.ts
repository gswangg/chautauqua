// Base app bootstrap, extracted from src/index.ts (structure decomposition:
// keeps index.ts's job narrowed to sub-app mounting per DEC-012, which is
// the ONLY place app.route() may be called). This module owns request-scoped
// context wiring, the always-on session loader, the error handler, and the
// core meta endpoints (/health, /api/v1) plus the dev-mailbox mount guard.

import { Hono } from "hono";
import type { AppEnv } from "./env";
import { makeDb } from "./context";
import { sessionLoader } from "./middleware";
import { registerErrorHandler } from "./http";
import { shouldMountDevMailbox } from "../routes/dev/mailbox";
import { bumpPublicVersionMiddleware } from "./pubcache";

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

  registerErrorHandler(app);

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/api/v1", (c) => c.json({ name: "chautauqua", version: "v1" }));

  return app;
}

/**
 * DEC-005: /dev/mailbox is dev-only, mounted only when env.DEV_MODE === '1'.
 * Bindings are only known per-request in a Worker, so the guard runs ahead
 * of the route match and 404s (via c.notFound()) rather than delegating —
 * with DEV_MODE unset the routes are indistinguishable from not existing.
 *
 * This installs middleware guards only (app.use), not the sub-app mount
 * itself — index.ts still does `app.route("/", devMailboxRoutes)`.
 */
export function guardDevMailbox(app: Hono<AppEnv>): void {
  app.use("/dev/mailbox", async (c, next) => {
    if (!shouldMountDevMailbox(c.env)) return c.notFound();
    await next();
  });
  app.use("/dev/mailbox/*", async (c, next) => {
    if (!shouldMountDevMailbox(c.env)) return c.notFound();
    await next();
  });
}
