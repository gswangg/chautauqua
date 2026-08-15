// DEC-099/DEC-069 (task w37-f): derives the AUTHENTICATED half of the
// cacheability population. test/public-cacheability-enumeration.test.ts
// already derived the PUBLIC population (/e/*, /embed/*, /) and found a real
// violation by building it. The complementary universal -- an authenticated
// surface is never shared-cacheable -- was asserted only by six hand-picked
// doors in test/cache-control-default.test.ts:68-161, which is exactly the
// ONE DOOR IS NOT A POPULATION failure DEC-099's wave-35 amendment ruled
// against. This file builds that population non-hand-typed instead.
//
// Population: every GET registration test/helpers/registered-routes.ts's
// enumerateRegisteredRoutes() finds (parsed from src/routes/**/*.{ts,tsx} +
// src/index.ts's own source -- never re-parsed by hand here, per field guide
// w31 "the route enumerator already exists"), MINUS anything resolved under
// /e/, /embed/, /health, /assets, or the bare public hub "/" -- those are the
// PUBLIC population public-cacheability-enumeration.test.ts already owns.
//
// Harness: the exact throwing-db-Proxy + noStoreByDefault + real-sub-app
// idiom test/cache-control-default.test.ts and test/anonymous-route-probe.
// test.ts already use, composed the DEC-518 non-hand-typed way (parseIndexMounts,
// test/helpers/index-mounts.ts) so the composition itself can't silently
// drift from src/index.ts's real mount list. Every request is anonymous (no
// session cookie, no c.var.auth) -- Hono's compose() catches a thrown error
// at the SAME dispatch level that threw it and resolves normally back up the
// chain (node_modules/hono/dist/compose.js), so noStoreByDefault's
// post-next() default still applies to a 500 produced by the db-throw path,
// exactly as it does to a real handler's response.
//
// LIMITATION, worth knowing before trusting a green run here (same shape as
// test/anonymous-route-probe.test.ts's own documented limitation): a route
// that touches the db BEFORE any authz gate (e.g. /login, /claim/:token,
// /submit/:eventSlug, /docs/api, /headshots/:fileId -- see that file's
// PUBLIC_BY_DESIGN list) throws on the Proxy immediately and is answered by
// the generic no-store 500 path here, never reaching its real handler body.
// This probe therefore only proves those routes' db-throw path is
// compliant, not what their real response looks like once data flows.
// /headshots/:fileId is a known instance: src/routes/portal/profile.tsx's
// headshotServeRoutes intentionally serves `Cache-Control: <CLIENT_CACHE_
// CONTROL>` + `Vary: Cookie` for a publicly-visible headshot (by design,
// DEC-028/DEC-067 -- see that file's header comment) -- a real shared-cache
// response this probe's throwing-db harness structurally cannot observe, so
// it is neither in-population-and-passing nor a KNOWN_VIOLATIONS entry here;
// a future wave that wants that branch covered needs a data-driven db mock
// (the technique test/public-cacheability-enumeration.test.ts uses), not
// this anonymous-gate probe.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";
import { noStoreByDefault } from "../src/server/middleware";
import { enumerateRegisteredRoutes } from "./helpers/registered-routes";
import { parseIndexMounts } from "./helpers/index-mounts";

// ---------------------------------------------------------------------------
// Population: every GET registration NOT in the public-cacheability-
// enumeration.test.ts population (/e/*, /embed/*, /health, /assets, "/").
// ---------------------------------------------------------------------------

export interface PopulationRoute {
  method: "GET";
  path: string;
  file: string;
  line: number;
}

const EXCLUDED_PREFIXES = ["/e/", "/embed/", "/health", "/assets"];

export function inAuthenticatedPopulation(path: string): boolean {
  if (path === "/") return false;
  return !EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function derivePopulation(): PopulationRoute[] {
  const routes = enumerateRegisteredRoutes();
  const kept: PopulationRoute[] = [];
  const seen = new Set<string>();
  for (const r of routes) {
    if (r.method !== "GET") continue;
    if (!inAuthenticatedPopulation(r.path)) continue;
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue; // dedupe (same path can register more than once)
    seen.add(key);
    kept.push({ method: "GET", path: r.path, file: r.file, line: r.line });
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Throwing db stub -- identical idiom to test/cache-control-default.test.ts's
// throwingDb() and test/anonymous-route-probe.test.ts's makeThrowingDb().
// ---------------------------------------------------------------------------

function throwingDb(): AppEnv["Variables"]["db"] {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`db.${String(prop)} touched — this route should have answered anonymously first`);
      },
    },
  ) as AppEnv["Variables"]["db"];
}

// ---------------------------------------------------------------------------
// App composition -- the DEC-518 non-hand-typed technique (parseIndexMounts),
// same as test/anonymous-route-probe.test.ts's buildAnonymousApp, but with
// noStoreByDefault mounted (this file's whole claim is about that default),
// and a synthetic route for the negative control.
// ---------------------------------------------------------------------------

const NEGATIVE_CONTROL_PATH = "/__test-synthetic-cacheable-route";

async function buildApp(): Promise<Hono<AppEnv>> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", throwingDb());
    // Deliberately no c.set("auth", ...) -- genuinely anonymous throughout.
    await next();
  });
  registerErrorHandler(app);
  app.use("*", noStoreByDefault);

  // The negative control: a throwaway route that gets the rule wrong on
  // purpose, registered on the SAME harness (same noStoreByDefault instance)
  // real routes are driven over -- proves cacheabilityViolations actually
  // fires rather than vacuously passing because every real route already
  // complies.
  app.get(NEGATIVE_CONTROL_PATH, (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.text("synthetic cacheable route");
  });

  const mounts = await parseIndexMounts();
  for (const { prefix, identifier, subApp } of mounts) {
    if (identifier === "devMailboxRoutes") {
      guardDevMailbox(app);
    }
    app.route(prefix, subApp);
  }
  return app;
}

// ---------------------------------------------------------------------------
// Literal substitution for `:name` / `:name{regex}` / bare `*` segments --
// same small candidate pool as test/anonymous-route-probe.test.ts's
// literalFor/toRequestPath (not exported there, reimplemented here rather
// than reaching into that file's internals).
// ---------------------------------------------------------------------------

function literalFor(segment: string): string {
  if (segment === "*") return "probe-wildcard";
  if (!segment.startsWith(":")) return segment;
  const braceIdx = segment.indexOf("{");
  if (braceIdx === -1) return "probe-value";
  const regexSrc = segment.slice(braceIdx + 1, segment.length - 1);
  const re = new RegExp(`^${regexSrc}$`);
  const candidates = ["probe.json", "probe.xml", "probe-value", "probevalue", "test"];
  const hit = candidates.find((c) => re.test(c));
  if (!hit) {
    throw new Error(
      `authenticated-cacheability-enumeration: no candidate literal satisfies param regex /${regexSrc}/ in segment '${segment}'`,
    );
  }
  return hit;
}

function toRequestPath(routePath: string): string {
  return routePath
    .split("/")
    .map((segment) => literalFor(segment))
    .join("/");
}

// ---------------------------------------------------------------------------
// The one closed predicate, exported so a future probe (and this file's own
// negative control) can reuse it verbatim rather than re-deriving a second
// copy of the rule.
// ---------------------------------------------------------------------------

const SHARED_CACHE_DIRECTIVES = ["public", "s-maxage", "stale-while-revalidate"];

/** Returns the list of ways `res` violates "an authenticated surface is
 * never shared-cacheable": Cache-Control must be exactly "no-store", must
 * carry no Vary: Cookie, and must carry no shared-cache directive (public /
 * s-maxage / stale-while-revalidate). Empty array = compliant. */
export function authenticatedCacheabilityViolations(res: Response, label: string): string[] {
  const cacheControl = res.headers.get("Cache-Control");
  const vary = res.headers.get("Vary");
  const violations: string[] = [];

  if (cacheControl !== "no-store") {
    violations.push(`${label}: Cache-Control="${cacheControl ?? "null"}" (must be exactly "no-store")`);
  }
  if (vary !== null && vary.split(",").map((v) => v.trim()).includes("Cookie")) {
    violations.push(`${label}: carries Vary: Cookie (must never — authenticated responses are never shared-cacheable)`);
  }
  const lowerCc = (cacheControl ?? "").toLowerCase();
  const foundDirectives = SHARED_CACHE_DIRECTIVES.filter((d) => lowerCc.includes(d));
  if (foundDirectives.length > 0) {
    violations.push(
      `${label}: Cache-Control="${cacheControl}" carries shared-cache directive(s) [${foundDirectives.join(", ")}]`,
    );
  }
  return violations;
}

// ---------------------------------------------------------------------------
// KNOWN_VIOLATIONS ratchet -- currently empty. Every route this probe can
// actually drive to a real response (rather than the generic db-throw 500
// path, see this file's header LIMITATION note) already complies. If a
// future wave's probe run finds a real violation, it goes here keyed
// "METHOD path" with file:line (from enumerateRegisteredRoutes, which gives
// both) and an owner -- never fixed here (frozen wave) and never silently
// allowlisted by loosening the predicate above.
// ---------------------------------------------------------------------------

interface KnownViolation {
  file: string;
  line: number;
  owner: string;
  reason: string;
}

const KNOWN_VIOLATIONS: Record<string, KnownViolation> = {};

describe("DEC-099/DEC-069 (w37-f): authenticated-surface cacheability is a derived population", () => {
  it("the population is non-empty and a floor covering /admin, /portal and an /api/v1 path", () => {
    const population = derivePopulation();
    expect(population.length).toBeGreaterThan(0);
    const paths = population.map((r) => r.path);
    expect(paths).toContain("/admin");
    expect(paths.some((p) => p.startsWith("/portal"))).toBe(true);
    expect(paths.some((p) => p.startsWith("/api/v1"))).toBe(true);
    // A broken filter (e.g. one that keeps nothing, or that accidentally
    // keeps /e/*'s or /embed/*'s public population too) must fail loudly
    // rather than vacuously pass.
    expect(paths.every((p) => inAuthenticatedPopulation(p))).toBe(true);
    expect(paths.some((p) => p.startsWith("/e/") || p.startsWith("/embed/"))).toBe(false);
  });

  it("every enumerated authenticated-population GET route satisfies the closed predicate, or is a listed KNOWN_VIOLATIONS entry that still actually violates it", async () => {
    const population = derivePopulation();
    const app = await buildApp();

    const unexpectedViolations: string[] = [];
    const staleRatchetEntries: string[] = [];
    const seenKeys = new Set<string>();

    for (const route of population) {
      const key = `${route.method} ${route.path}`;
      seenKeys.add(key);
      const requestPath = toRequestPath(route.path);
      const res = await app.request(requestPath, {}, {} as unknown as AppEnv["Bindings"]);
      const label = `GET ${route.path} (requested ${requestPath}, ${route.file}:${route.line}) -> ${res.status}`;
      const violations = authenticatedCacheabilityViolations(res, label);

      const knownViolation = KNOWN_VIOLATIONS[key];
      if (knownViolation) {
        if (violations.length === 0) {
          staleRatchetEntries.push(
            `${key}: listed in KNOWN_VIOLATIONS (${knownViolation.reason}) but no longer violates the predicate — delete this ratchet entry`,
          );
        }
      } else if (violations.length > 0) {
        unexpectedViolations.push(...violations);
      }
    }

    // Every ratchet entry must still name a route this run actually
    // enumerated -- a deleted/renamed route must not leave a stale,
    // unverifiable ratchet entry either.
    const deadRatchetEntries = Object.keys(KNOWN_VIOLATIONS).filter((key) => !seenKeys.has(key));

    expect(unexpectedViolations).toEqual([]);
    expect(staleRatchetEntries).toEqual([]);
    expect(deadRatchetEntries).toEqual([]);
  });

  it("NEGATIVE CONTROL: a synthetic 'public, max-age=60' authenticated-surface route is caught by the same predicate (DEC-518 technique)", async () => {
    const app = await buildApp();
    const res = await app.request(NEGATIVE_CONTROL_PATH, {}, {} as unknown as AppEnv["Bindings"]);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");

    const violations = authenticatedCacheabilityViolations(res, "negative control");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join(" | ")).toContain('must be exactly "no-store"');
    expect(violations.join(" | ")).toContain("shared-cache directive");
  });

  it("NEGATIVE CONTROL: a synthetic response carrying Vary: Cookie is also caught, independently of Cache-Control", () => {
    const res = new Response("nope", {
      status: 200,
      headers: { "Cache-Control": "no-store", Vary: "Cookie" },
    });
    const violations = authenticatedCacheabilityViolations(res, "negative control 2");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("carries Vary: Cookie");
  });
});
