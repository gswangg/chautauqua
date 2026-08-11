// Regression for task-w1-h: GET /docs/api is hand-maintained SSR (DEC-056),
// which means it can silently drift from the routes src/index.ts actually
// mounts. This test mounts every real sub-app under the exact same prefixes
// src/index.ts uses (DEC-012: only src/index.ts calls app.route(), so we
// mirror its mounting order here rather than importing it, since its default
// export only exposes `fetch`/`scheduled`, not the underlying Hono app) and
// diffs the resulting /api/v1 route table against docs.tsx's ROUTE_GROUPS.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { ROUTE_GROUPS } from "../src/routes/docs";

import { eventsRoutes } from "../src/routes/api/events";
import { portalConfigRoutes } from "../src/routes/api/portal-config";
import { emailLogRoutes } from "../src/routes/api/email-log";
import { formsRoutes } from "../src/routes/api/forms";
import { submissionsRoutes } from "../src/routes/api/submissions";
import { contactsRoutes } from "../src/routes/api/contacts";
import { pipelineRoutes } from "../src/routes/api/pipeline";
import { overviewRoutes } from "../src/routes/api/overview";
import { viewsRoutes } from "../src/routes/api/views";
import { commsRoutes } from "../src/routes/comms";
import { agendaRoutes } from "../src/routes/agenda";
import { taskRoutes } from "../src/routes/tasks";
import { reviewRoutes } from "../src/routes/review";
import { meRoutes } from "../src/routes/me";
import { fileApiRoutes } from "../src/routes/files";
import { tokensRoutes } from "../src/routes/api/tokens";
import { exportsRoutes } from "../src/routes/api/exports";
import { usersRoutes } from "../src/routes/api/users";

// Mirrors src/index.ts's mounting for every sub-app that can register an
// /api/v1/* route (DEC-012). Non-API surfaces (auth, portal, public, docs,
// root, dev mailbox) are intentionally omitted — docs.tsx's page states
// "All endpoints below are namespaced under /api/v1", so only those matter.
function buildApiApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.route("/api/v1", eventsRoutes);
  app.route("/api/v1", portalConfigRoutes);
  app.route("/api/v1", submissionsRoutes);
  app.route("/api/v1", contactsRoutes);
  app.route("/api/v1", pipelineRoutes);
  app.route("/api/v1", overviewRoutes);
  app.route("/api/v1", viewsRoutes);
  app.route("/api/v1", agendaRoutes);
  app.route("/api/v1", taskRoutes);
  app.route("/api/v1", fileApiRoutes);
  app.route("/", emailLogRoutes);
  app.route("/", formsRoutes);
  app.route("/", commsRoutes);
  app.route("/", reviewRoutes);
  app.route("/", meRoutes);
  app.route("/", tokensRoutes);
  app.route("/", exportsRoutes);
  app.route("/", usersRoutes);
  return app;
}

/** Hono route patterns use e.g. ":id{[^/]+}" for some params; normalize to
 * bare ":name" so they compare equal to docs.tsx's plain ":name" style. */
function normalizePath(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)(\{[^}]*\})?/g, ":$1");
}

describe("docs.tsx ROUTE_GROUPS vs the real mounted /api/v1 routes", () => {
  const app = buildApiApp();
  const actual = new Set(
    app.routes
      .filter((r) => r.path.startsWith("/api/v1/") || r.path === "/api/v1")
      .filter((r) => r.method !== "ALL")
      .map((r) => `${r.method} ${normalizePath(r.path)}`),
  );

  // docs.tsx paths sometimes carry a documented query string
  // (?format=csv|json) that isn't part of the route pattern itself.
  const documented = new Set(
    ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path.split("?")[0]}`),
  );

  it("documents every real /api/v1 route (nothing mounted is missing from the page)", () => {
    const undocumented = [...actual].filter((r) => !documented.has(r));
    expect(undocumented).toEqual([]);
  });

  it("never documents a route that isn't actually mounted (no stale entries)", () => {
    const stale = [...documented].filter((r) => !actual.has(r));
    expect(stale).toEqual([]);
  });
});
