// DEC-637: enumerate the API reference from the real mounted router (via
// src/index.ts's `export { app }`) instead of trusting a hand-written
// table. Diffs the flattened docs.tsx rows (ROUTE_GROUPS) against
// app.routes in both directions: every registered /api/v1 route must be
// documented, and every documented row must correspond to a registered
// route. Anything deliberately undocumented is named in
// UNDOCUMENTED_BY_DESIGN below, not silently skipped.

import { describe, expect, it } from "vitest";
import { app } from "../src/index";
import { ROUTE_GROUPS } from "../src/routes/docs";

/** Hono route patterns use e.g. ":id{[^/]+}" for some params; normalize to
 * bare ":name" so they compare equal to docs.tsx's plain ":name" style. */
function normalizePath(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)(\{[^}]*\})?/g, ":$1");
}

// Closed two-list: routes that exist under /api/v1 but are deliberately
// not documented as an API-reference row, with a one-line reason each.
const UNDOCUMENTED_BY_DESIGN = new Set<string>([
  // The /api/v1 root itself is a meta/health endpoint (name + version), not
  // a documented API resource.
  "GET /api/v1",
]);

describe("API docs enumerated from the real router (DEC-637)", () => {
  const apiRoutes = app.routes
    // Drop middleware entries: app.use()-registered handlers surface as
    // method 'ALL' in Hono's route table, not a real HTTP verb a client
    // would call.
    .filter((r) => r.method !== "ALL")
    .filter((r) => r.path === "/api/v1" || r.path.startsWith("/api/v1/"));

  const registered = new Set(apiRoutes.map((r) => `${r.method} ${normalizePath(r.path)}`));

  const documented = new Set(
    ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path.split("?")[0]}`),
  );

  it("finds at least 100 distinct registered API routes (floor so an empty scan can't pass)", () => {
    expect(registered.size).toBeGreaterThanOrEqual(100);
  });

  it("documents every registered /api/v1 route (or lists it in UNDOCUMENTED_BY_DESIGN)", () => {
    const missing = [...registered].filter((r) => !documented.has(r) && !UNDOCUMENTED_BY_DESIGN.has(r));
    expect(missing, `Routes registered but not documented in docs.tsx ROUTE_GROUPS:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("never documents a route that isn't actually registered (no stale rows)", () => {
    const stale = [...documented].filter((r) => !registered.has(r));
    expect(stale, `Rows in docs.tsx ROUTE_GROUPS with no matching registered route:\n${stale.join("\n")}`).toEqual(
      [],
    );
  });

  it("UNDOCUMENTED_BY_DESIGN entries are all actually registered (no dead allowlist entries)", () => {
    const dead = [...UNDOCUMENTED_BY_DESIGN].filter((r) => !registered.has(r));
    expect(dead, `UNDOCUMENTED_BY_DESIGN entries that aren't registered routes:\n${dead.join("\n")}`).toEqual([]);
  });
});
