// Regression for task-w1-h: GET /docs/api is hand-maintained SSR (DEC-056),
// which means it can silently drift from the routes src/index.ts actually
// mounts. DEC-518: rather than hand-mirroring src/index.ts's app.route()
// calls (which drifted from the real file more than once, see field guide
// w27-28/w29 entries), this test DERIVES the mounted-route list straight
// from src/index.ts's own source: it extracts every `app.route("<prefix>",
// <identifier>)` call in file order, resolves each identifier through that
// same file's `import { ... } from "..."` statements, dynamically imports
// the resolved module, and rebuilds an app from the exact list it found.
// Any new sub-app src/index.ts mounts is automatically picked up; any
// identifier this test can't resolve fails loudly by name instead of
// silently passing.

import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { ROUTE_GROUPS, PUBLIC_ROUTE_GROUPS, docsRoutes } from "../src/routes/docs";
import { publicRoutes } from "../src/routes/public";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { rootRoutes } from "../src/routes/root";

const INDEX_PATH = resolve(fileURLToPath(import.meta.url), "../../src/index.ts");
const INDEX_DIR = dirname(INDEX_PATH);

interface ImportBinding {
  /** The name exported by the module (left side of `as`, or the name itself). */
  exportedName: string;
  /** Module specifier as written in the import statement. */
  modulePath: string;
}

/** Parses every `import { a, b as c } from "./mod"` statement in `source`
 * into a map from local identifier -> { exportedName, modulePath }. */
function parseImportBindings(source: string): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source))) {
    const namesGroup = m[1];
    const modulePath = m[2];
    if (namesGroup === undefined || modulePath === undefined) continue;
    const names = namesGroup
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const raw of names) {
      const parts = raw.split(/\s+as\s+/).map((s) => s.trim());
      const exportedName = parts[0];
      if (!exportedName) continue;
      const localName = parts[1] ?? exportedName;
      bindings.set(localName, { exportedName, modulePath });
    }
  }
  return bindings;
}

interface RouteCall {
  prefix: string;
  identifier: string;
}

/** Extracts every literal `app.route("<prefix>", <identifier>)` call, in
 * source order. Deliberately narrow (a fixed string prefix + a bare
 * identifier) so a call this can't parse fails the resolution step below
 * rather than being silently skipped. */
function parseRouteCalls(source: string): RouteCall[] {
  const calls: RouteCall[] = [];
  const routeCallRegex = /app\.route\(\s*(["'])((?:(?!\1).)*)\1\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = routeCallRegex.exec(source))) {
    const prefix = m[2];
    const identifier = m[3];
    if (prefix === undefined || identifier === undefined) continue;
    calls.push({ prefix, identifier });
  }
  return calls;
}

/** Hono route patterns use e.g. ":id{[^/]+}" for some params; normalize to
 * bare ":name" so they compare equal to docs.tsx's plain ":name" style. */
function normalizePath(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)(\{[^}]*\})?/g, ":$1");
}

describe("docs.tsx ROUTE_GROUPS vs the real mounted /api/v1 routes (derived from src/index.ts)", () => {
  let app: Hono<AppEnv>;

  beforeAll(async () => {
    const source = readFileSync(INDEX_PATH, "utf-8");
    const bindings = parseImportBindings(source);
    const routeCalls = parseRouteCalls(source);

    expect(routeCalls.length).toBeGreaterThan(0);

    const moduleCache = new Map<string, Record<string, unknown>>();
    async function loadModule(modulePath: string): Promise<Record<string, unknown>> {
      let mod = moduleCache.get(modulePath);
      if (!mod) {
        const resolved = resolve(INDEX_DIR, modulePath);
        mod = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
        moduleCache.set(modulePath, mod);
      }
      return mod;
    }

    app = new Hono<AppEnv>();
    for (const { prefix, identifier } of routeCalls) {
      const binding = bindings.get(identifier);
      if (!binding) {
        throw new Error(
          `src/index.ts calls app.route("${prefix}", ${identifier}) but ${identifier} is not ` +
            `bound by any import statement in that file — this test can't resolve it and refuses ` +
            `to silently skip it (DEC-518).`,
        );
      }
      const mod = await loadModule(binding.modulePath);
      const subApp = mod[binding.exportedName];
      if (!subApp) {
        throw new Error(
          `src/index.ts imports ${identifier} (as ${binding.exportedName}) from ` +
            `"${binding.modulePath}", but that module has no such export.`,
        );
      }
      app.route(prefix, subApp as Hono<AppEnv>);
    }
  });

  it("resolved at least one app.route() call from src/index.ts's own source", () => {
    expect(app).toBeDefined();
  });

  it("documents every real /api/v1 route (nothing mounted is missing from the page)", () => {
    // Derived predicate over the mounted app's ACTUAL route table, not a
    // hand-listed set of module names: any route whose path doesn't start
    // under /api/v1 (auth, account, portal*, public*, root, docs, dev
    // mailbox, file/headshot serve, ...) is a non-API surface and out of
    // scope for docs.tsx, whichever sub-app happens to register it.
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

    const undocumented = [...actual].filter((r) => !documented.has(r));
    expect(undocumented).toEqual([]);
  });

  it("never documents a route that isn't actually mounted (no stale entries)", () => {
    const actual = new Set(
      app.routes
        .filter((r) => r.path.startsWith("/api/v1/") || r.path === "/api/v1")
        .filter((r) => r.method !== "ALL")
        .map((r) => `${r.method} ${normalizePath(r.path)}`),
    );
    const documented = new Set(
      ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path.split("?")[0]}`),
    );

    const stale = [...documented].filter((r) => !actual.has(r));
    expect(stale).toEqual([]);
  });
});

describe("docs.tsx PUBLIC_ROUTE_GROUPS vs the real mounted public GET routes", () => {
  // src/index.ts mounts all four of these at "/" (app.route("/",
  // publicRoutes), app.route("/", publicSubmitRoutes), app.route("/",
  // docsRoutes), app.route("/", rootRoutes)) — mirror that here so the diff
  // below sees the exact same route table the running server does. rootRoutes
  // and docsRoutes carry the instance's own public surfaces (GET / and GET
  // /docs/api) plus the non-public /admin and /admin/* shell routes, which
  // are excluded below by name (DEC-056 amendment, wave 71).
  const app = new Hono<AppEnv>();
  app.route("/", publicRoutes);
  app.route("/", publicSubmitRoutes);
  app.route("/", docsRoutes);
  app.route("/", rootRoutes);

  // The only two registered GETs on rootRoutes/docsRoutes that are NOT
  // public, no-login surfaces: the admin SPA shell (auth-gated, redirects
  // anonymous/speaker callers away) and its catch-all. Length is asserted
  // below so a third entry can't be slipped in silently.
  const NON_PUBLIC = new Set(["GET /admin", "GET /admin/*"]);
  if (NON_PUBLIC.size !== 2) {
    throw new Error(`NON_PUBLIC exclusion list must contain exactly 2 entries, got ${NON_PUBLIC.size}`);
  }

  /** publicRoutes uses a Hono regex param constraint (e.g.
   * `:surface{[a-z]+\.json}`) for the .json/.xml feed twins so they win the
   * route-match ahead of the plain `:surface` HTML route. Normalize both the
   * actual route table and docs.tsx's friendlier `:surface.json` spelling to
   * the same string so they compare equal. */
  function normalizePublicPath(path: string): string {
    return path.replace(/:([a-zA-Z0-9_]+)(\{[^}]*\})?/g, (_match, name: string, brace?: string) => {
      if (!brace) return `:${name}`;
      if (brace.includes("\\.json")) return `:${name}.json`;
      if (brace.includes("\\.xml")) return `:${name}.xml`;
      return `:${name}`;
    });
  }

  // Deliberately undocumented: a bare-redirect twin of /e/:eventSlug that
  // exists only so an embedder who guesses /embed/:eventSlug (no surface
  // segment) lands somewhere sane. It carries no content of its own — the
  // chromeless embed surfaces it redirects into are already documented.
  const EXCLUDED_UNDOCUMENTED = new Set(["GET /embed/:eventSlug"]);

  it("documents every real public GET (nothing registered is missing from the table, or is a named non-public exclusion)", () => {
    const actual = new Set(
      app.routes
        .filter((r) => r.method === "GET")
        .map((r) => `GET ${normalizePublicPath(r.path)}`)
        .filter((r) => !EXCLUDED_UNDOCUMENTED.has(r))
        .filter((r) => !NON_PUBLIC.has(r)),
    );
    const documented = new Set(PUBLIC_ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path}`));

    const undocumented = [...actual].filter((r) => !documented.has(r));
    expect(undocumented).toEqual([]);
  });

  it("never documents a public route that isn't actually mounted (no stale entries)", () => {
    const actual = new Set(
      app.routes.filter((r) => r.method === "GET").map((r) => `GET ${normalizePublicPath(r.path)}`),
    );
    const documented = new Set(PUBLIC_ROUTE_GROUPS.flatMap((g) => g.rows).map((r) => `${r.method} ${r.path}`));

    const stale = [...documented].filter((r) => !actual.has(r));
    expect(stale).toEqual([]);
  });

  it("NON_PUBLIC contains only /admin and /admin/* (no third entry slipped in)", () => {
    expect([...NON_PUBLIC].sort()).toEqual(["GET /admin", "GET /admin/*"]);
  });
});
