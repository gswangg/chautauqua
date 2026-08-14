// DEC-550 (wave-32 amendment): a runtime anonymous probe for MUTATING
// routes (POST/PUT/PATCH/DELETE), the sibling of
// test/anonymous-route-probe.test.ts's GET probe. Composition is
// deliberately LOCAL to this file rather than shared with that file's
// buildAnonymousApp() -- a sibling lane writes a similar probe and the
// small duplication is a deliberate wave-32 instruction, not an oversight.
//
// Technique (copied from anonymous-route-probe.test.ts): a bare
// Hono<AppEnv> + registerErrorHandler + one middleware that sets `db` to a
// stub that THROWS on any property access (recording that it was touched)
// and sets NO auth -- every request here is genuinely anonymous. Mounts are
// derived from src/index.ts's own source via parseIndexMounts()
// (test/helpers/index-mounts.ts, DEC-518 technique), never hand-listed, with
// guardDevMailbox applied immediately before the devMailboxRoutes mount
// exactly as src/index.ts does. env is `{}` -- no bindings at all.
//
// Route enumeration: every POST/PUT/PATCH/DELETE entry in the composed
// app's own route table (app.routes), deduped by method+path, with a
// literal substituted for every `:param` (honouring inline `{regex}`
// constraints the same way the GET probe's literalFor does) and for a bare
// `*`.
//
// For each enumerated route this file issues TWO anonymous requests:
//   1. No CSRF header at all.
//   2. The csrfJson header contract (`x-chq-csrf: 1`, src/server/
//      middleware.ts) -- so a route whose only refusal came from the CSRF
//      guard (rather than an authz check) is still proven to refuse.
// Both requests carry `content-type: application/json` and an empty JSON
// body (`{}`). Both must produce (a) a non-2xx response AND (b) leave the
// db stub untouched -- unless the route is named in
// PUBLIC_BY_DESIGN_MUTATIONS below with a reason citing its own DEC. That
// ledger is asserted exact in both directions: every enumerated mutating
// route that touches the db (or returns 2xx) anonymously must be listed,
// and every listed entry must still match a currently-enumerated route (a
// deleted route can't leave a stale, unverifiable hole).
//
// A floor on the enumerated mutating-route count (see MIN_MUTATING_ROUTES
// below) keeps literalFor/the regex-substitution logic from silently
// narrowing the population it claims to cover.
//
// Finding from building this probe: the only routes that reach the db
// anonymously are the ones already documented as public by design --
// public CFP final submit (getEventBySlug runs before the in-body
// double-submit CSRF check, DEC-626) and the account-recovery/session
// endpoints (login, forgot, reset, claim, logout) whose own CSRF guard runs
// as route middleware BEFORE the handler and so never lets an anonymous,
// CSRF-less request reach a handler body at all -- they are listed below
// anyway for completeness/documentation, matching this task's expected
// membership, even though the "db untouched" half already holds for them
// without an entry. No new hole was found; nothing needed fixing.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";
import { parseIndexMounts } from "./helpers/index-mounts";

const CSRF_HEADER = "x-chq-csrf";

// ---------------------------------------------------------------------------
// PUBLIC_BY_DESIGN_MUTATIONS ledger -- every entry verified against its own
// route file's source comment/DEC before being added.
// ---------------------------------------------------------------------------

const PUBLIC_BY_DESIGN_MUTATIONS: { method: string; pattern: string; reason: string }[] = [
  {
    method: "POST",
    pattern: "/submit/:eventSlug",
    reason:
      "DEC-005/DEC-626: public CFP final submit -- getEventBySlug/getDefaultForm resolve the event/form before the in-body double-submit CSRF check runs (so the submitter's answers can be re-rendered rather than discarded on a CSRF failure); no login by design, same module as the GET probe's /submit/:eventSlug entry.",
  },
  {
    method: "POST",
    pattern: "/submit/:eventSlug/save-draft",
    reason:
      "DEC-005/DEC-422: public CFP draft save, same no-login module as final submit above; guarded by csrfForm as route middleware (throws before any db access) but listed for completeness alongside final submit.",
  },
  {
    method: "POST",
    pattern: "/login",
    reason:
      "DEC-012: public login form post -- must be reachable while anonymous by definition (src/routes/auth.tsx). Guarded by csrfForm as route middleware, which throws on a missing CSRF cookie before the handler ever touches the db.",
  },
  {
    method: "POST",
    pattern: "/logout",
    reason:
      "DEC-181: sign-out is reachable without a prior authenticated session check by design (a stale/expired cookie must still be clearable). Guarded by csrfFormOrHeader; when the CSRF check passes with no session cookie present the handler's own `if (token)` guard skips the db delete entirely.",
  },
  {
    method: "POST",
    pattern: "/claim/:token",
    reason:
      "DEC-014: invite-claim submission -- the token itself is the credential, not a session (src/routes/auth.tsx). Guarded by csrfForm as route middleware, which throws before the handler touches the db.",
  },
  {
    method: "POST",
    pattern: "/forgot",
    reason:
      "DEC-012-adjacent password-recovery entry point, must be reachable anonymously by definition (src/routes/auth.tsx). Guarded by csrfForm as route middleware, which throws before the handler touches the db.",
  },
  {
    method: "POST",
    pattern: "/reset/:token",
    reason:
      "Password-reset completion -- the reset token itself is the credential, not a session (src/routes/auth.tsx). Guarded by csrfForm as route middleware, which throws before the handler touches the db.",
  },
];

function patternMatches(pattern: string, actualPath: string): boolean {
  if (pattern.endsWith("/*")) {
    return actualPath.startsWith(pattern.slice(0, -1));
  }
  return pattern === actualPath;
}

// ---------------------------------------------------------------------------
// Throwing db stub -- copied technique from anonymous-route-probe.test.ts.
// ---------------------------------------------------------------------------

function makeThrowingDb(): { db: AppEnv["Variables"]["db"]; touched: () => boolean; reset: () => void } {
  let touched = false;
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        touched = true;
        throw new Error(`anonymous-mutation-probe: db.${String(prop)} accessed by an anonymous request`);
      },
    },
  ) as AppEnv["Variables"]["db"];
  return {
    db,
    touched: () => touched,
    reset: () => {
      touched = false;
    },
  };
}

// ---------------------------------------------------------------------------
// App composition -- mirrors src/index.ts's mount order/prefixes exactly,
// minus createBaseApp()'s sessionLoader (auth is deliberately never set).
// ---------------------------------------------------------------------------

async function buildAnonymousApp() {
  const { db, touched, reset } = makeThrowingDb();
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    // Deliberately no c.set("auth", ...) -- every request probed here is
    // genuinely anonymous.
    await next();
  });

  registerErrorHandler(app);

  const mounts = await parseIndexMounts();
  for (const { prefix, identifier, subApp } of mounts) {
    if (identifier === "devMailboxRoutes") {
      guardDevMailbox(app);
    }
    app.route(prefix, subApp);
  }

  return { app, touched, reset, mountCount: mounts.length };
}

// ---------------------------------------------------------------------------
// Route table enumeration + literal substitution (copied technique from
// anonymous-route-probe.test.ts's literalFor/toRequestPath).
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
      `anonymous-mutation-probe: no candidate literal satisfies param regex /${regexSrc}/ in segment '${segment}'`,
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

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface MutatingRoute {
  method: string;
  path: string;
}

function enumerateMutatingRoutes(app: Hono<AppEnv>): MutatingRoute[] {
  const seen = new Set<string>();
  const routes: MutatingRoute[] = [];
  for (const route of app.routes) {
    if (!MUTATING_METHODS.has(route.method)) continue;
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ method: route.method, path: route.path });
  }
  routes.sort((a, b) => (a.method === b.method ? a.path.localeCompare(b.path) : a.method.localeCompare(b.method)));
  return routes;
}

// A loose floor -- proves the composed app mounted every sub-app and the
// enumeration/substitution logic isn't silently narrowing the population.
const MIN_MUTATING_ROUTES = 80;

// ---------------------------------------------------------------------------
// The probe.
// ---------------------------------------------------------------------------

describe("anonymous-MUTATION authz probe (DEC-550)", () => {
  it("enumerates at least the mutating routes this task expects to exist (composition sanity)", async () => {
    const { app, mountCount } = await buildAnonymousApp();
    const routes = enumerateMutatingRoutes(app);
    expect(routes.length).toBeGreaterThanOrEqual(MIN_MUTATING_ROUTES);
    expect(mountCount).toBeGreaterThanOrEqual(35);
  });

  it("every enumerated mutating route refuses anonymously (with or without the CSRF header) or is an exact, justified PUBLIC_BY_DESIGN_MUTATIONS entry", async () => {
    const { app, touched, reset } = await buildAnonymousApp();
    const routes = enumerateMutatingRoutes(app);
    const matchedPatterns = new Set<string>();
    const failures: string[] = [];

    for (const { method, path } of routes) {
      const allowlistEntry = PUBLIC_BY_DESIGN_MUTATIONS.find(
        (entry) => entry.method === method && patternMatches(entry.pattern, path),
      );
      if (allowlistEntry) matchedPatterns.add(`${allowlistEntry.method} ${allowlistEntry.pattern}`);

      const requestPath = toRequestPath(path);

      // Pass 1: no CSRF header at all.
      reset();
      const res1 = await app.request(
        requestPath,
        {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        {} as unknown as AppEnv["Bindings"],
      );
      const nonAllowlistedTouch1 = !allowlistEntry && touched();
      const nonAllowlisted2xx1 = !allowlistEntry && res1.status >= 200 && res1.status < 300;
      if (nonAllowlistedTouch1) {
        failures.push(
          `${method} ${path} (requested as ${requestPath}, no CSRF header) touched the db as an anonymous request and is not in PUBLIC_BY_DESIGN_MUTATIONS`,
        );
      }
      if (nonAllowlisted2xx1) {
        failures.push(
          `${method} ${path} (requested as ${requestPath}, no CSRF header) returned ${res1.status} (2xx) to an anonymous request and is not in PUBLIC_BY_DESIGN_MUTATIONS`,
        );
      }

      // Pass 2: the csrfJson header contract -- proves a route whose only
      // refusal came from CSRF is still proven to refuse on authz.
      reset();
      const res2 = await app.request(
        requestPath,
        {
          method,
          headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
          body: JSON.stringify({}),
        },
        {} as unknown as AppEnv["Bindings"],
      );
      const nonAllowlistedTouch2 = !allowlistEntry && touched();
      const nonAllowlisted2xx2 = !allowlistEntry && res2.status >= 200 && res2.status < 300;
      if (nonAllowlistedTouch2) {
        failures.push(
          `${method} ${path} (requested as ${requestPath}, with ${CSRF_HEADER}:1) touched the db as an anonymous request and is not in PUBLIC_BY_DESIGN_MUTATIONS`,
        );
      }
      if (nonAllowlisted2xx2) {
        failures.push(
          `${method} ${path} (requested as ${requestPath}, with ${CSRF_HEADER}:1) returned ${res2.status} (2xx) to an anonymous request and is not in PUBLIC_BY_DESIGN_MUTATIONS`,
        );
      }
    }

    expect(failures).toEqual([]);

    // Exact in the other direction too: every ledger entry must still match
    // a currently-enumerated route.
    const staleEntries = PUBLIC_BY_DESIGN_MUTATIONS.filter(
      (entry) => !matchedPatterns.has(`${entry.method} ${entry.pattern}`),
    ).map((entry) => `${entry.method} ${entry.pattern}`);
    expect(staleEntries).toEqual([]);
  });
});
