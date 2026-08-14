// DEC-056 (wave-31 amendment): "hand-maintained docs page trusted, never
// enumerated" -- this test renders the real GET /docs/api page (exactly as
// test/docs-page.test.ts does) and cross-checks it against the source-level
// route enumerator in test/helpers/registered-routes.ts (the same scanner
// test/pubcache-purge-classification.test.ts uses, reused rather than
// re-parsed per the field guide's "THE ROUTE ENUMERATOR ALREADY EXISTS").
//
// Both directions are checked: every registered /api/v1 route must appear
// on the rendered page (or be named, with a mandatory reason, in
// UNDOCUMENTED_BY_DESIGN below), and every /api/v1 path printed on the page
// must resolve to an actually-registered route (no ghost endpoints).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { docsRoutes } from "../src/routes/docs";
import type { AppEnv } from "../src/server/env";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";

function buildApp() {
  const app = new Hono<AppEnv>();
  app.route("/", docsRoutes);
  return app;
}

/** Normalizes a Hono/express-style `:paramName` segment to the bare token
 * `:param` so a route registered as `/contacts/:id` and a docs row spelled
 * `/contacts/:id` (or a friendlier `/events/:eventId`) compare equal. */
function normalizeParams(path: string): string {
  return path.replace(/:[A-Za-z0-9_]+/g, ":param");
}

interface UndocumentedEntry {
  method: string;
  path: string;
  reason: string;
}

// Closed two-list: /api/v1 routes that are registered but deliberately not
// printed as a docs row, each with a mandatory one-line reason (never a
// silent skip).
const UNDOCUMENTED_BY_DESIGN: UndocumentedEntry[] = [
  {
    method: "GET",
    path: "/api/v1",
    reason: "meta/health endpoint (name + version), not a documented API resource",
  },
];

describe("GET /docs/api is enumerated against the real registered routes (DEC-056)", () => {
  const registered = enumerateRegisteredRoutes().filter((r) => r.path.startsWith("/api/v1"));

  it("finds at least 60 registered /api/v1 routes (scanner sanity check)", () => {
    expect(registered.length).toBeGreaterThanOrEqual(60);
  });

  it("every UNDOCUMENTED_BY_DESIGN entry carries a non-empty reason", () => {
    for (const entry of UNDOCUMENTED_BY_DESIGN) {
      expect(entry.reason.trim().length, `${entry.method} ${entry.path} has no reason`).toBeGreaterThan(0);
    }
  });

  it("documents every registered /api/v1 route on the rendered page (or lists it in UNDOCUMENTED_BY_DESIGN)", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    expect(res.status).toBe(200);
    const body = await res.text();

    const allowlisted = new Set(
      UNDOCUMENTED_BY_DESIGN.map((e) => `${e.method} ${normalizeParams(e.path)}`),
    );

    const missing: string[] = [];
    for (const r of registered) {
      const key = `${r.method} ${normalizeParams(r.path)}`;
      if (allowlisted.has(key)) continue;
      if (!body.includes(r.path) && !body.includes(normalizeParams(r.path))) {
        missing.push(`  ${r.file}:${r.line}: ${r.method} ${r.path} not found on the rendered /docs/api page.`);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Found ${missing.length} registered /api/v1 route(s) missing from /docs/api:\n${missing.join("\n")}`);
    }
    expect(missing).toEqual([]);
  });

  it("never prints an /api/v1 path on the page that isn't an actually registered route (no ghost endpoints)", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    const body = await res.text();

    // Every route path the docs table actually prints is rendered inside a
    // <td><code class="chq-tool-code">...</code></td> path cell (see
    // docs.tsx's table rows) -- scan those cells specifically, not free
    // prose that merely mentions "/api/v1" as a namespace (e.g. the page's
    // own intro sentence, which also wraps it in <code> but not a <td>).
    const pathCellRe = /<td>\s*<code class="chq-tool-code">([^<]*)<\/code>\s*<\/td>/g;
    const printedPaths = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = pathCellRe.exec(body)) !== null) {
      const text = m[1]!;
      if (!text.startsWith("/api/v1")) continue;
      // Strip any documented query string, e.g. ?format=csv|json.
      const raw = text.split("?")[0]!;
      printedPaths.add(raw);
    }

    expect(printedPaths.size).toBeGreaterThan(0);

    const registeredKeys = new Set(registered.map((r) => normalizeParams(r.path)));

    const ghosts: string[] = [];
    for (const path of printedPaths) {
      const normalized = normalizeParams(path);
      if (!registeredKeys.has(normalized)) {
        ghosts.push(`  ${path} (normalized: ${normalized}) does not match any registered route.`);
      }
    }
    if (ghosts.length > 0) {
      throw new Error(`Found ${ghosts.length} ghost /api/v1 path(s) printed on /docs/api:\n${ghosts.join("\n")}`);
    }
    expect(ghosts).toEqual([]);
  });
});
