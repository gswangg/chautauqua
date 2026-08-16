// DEC-550: an enumerating anonymous-GET authz probe. The only authz
// manifest this codebase previously had was prose
// (docs/verification-log/task-w18-d-route-authz-inventory-stage1.md) --
// DEC-546 shows what that costs: three "public by design" entries there
// were wrong and nothing failed. This file replaces hand-listing with
// enumeration: it composes every sub-app src/index.ts mounts, at the same
// prefixes, in the same order (including guardDevMailbox immediately before
// devMailboxRoutes, exactly as src/index.ts:84-85 does), over a db stub
// that THROWS on any property access and records that it was touched.
//
// DEC-550 (Amendment, wave 18): buildAnonymousApp used to be a hand-copied
// list of `app.route(...)` calls -- a second manifest that could (and did)
// drift from src/index.ts's real mount list, silently missing six mounts
// (importRoutes, publicSurfacesRoutes, embedsRoutes, breaksRoutes,
// contentNoteRoutes, mailStatusRoutes). It now composes over
// test/helpers/index-mounts.ts's parseIndexMounts(), the same
// parse-source/resolve-imports/dynamic-import technique
// test/ssr-link-targets-scan.test.ts uses (DEC-518) -- the mount list this
// probe builds on is derived from src/index.ts's own source, not typed by
// hand, so it cannot silently narrow again. buildAnonymousApp is therefore
// async.
//
// Finding from building this probe (wave 18): of the six newly-covered
// mounts, every enumerated GET route among them was already gated by a
// synchronous auth check before touching the db (requireAuth/
// requireOrganizer/requireReviewerOrOrganizer) or is a POST-only sub-app
// with no GET routes at all -- no new anonymous-reachable db-touching route
// was found. The exhaustive composition still matters going forward: it is
// what makes that finding load-bearing instead of hopeful.
//
// Composition deliberately does NOT call src/server/app.ts's
// createBaseApp() -- that wires the always-on sessionLoader, which is
// exactly the thing under test (whether a route needs it). Instead this
// mirrors test/w10-verify-no-blanket-wildcard.test.ts's technique: a bare
// Hono<AppEnv> + registerErrorHandler + one middleware that sets `db` and
// sets NO `auth`, so every route sees a genuinely anonymous request. The two
// meta endpoints createBaseApp() defines inline (GET /health, GET /api/v1)
// are reproduced here for the same reason -- they are not sub-app mounts,
// but they are real anonymous-reachable GET surfaces src/index.ts's app
// serves, so the probe must see them too.
//
// env is `{}` -- DEV_MODE unset, so guardDevMailbox 404s every
// /dev/mailbox* request before it ever reaches devMailboxRoutes' handlers
// (see shouldMountDevMailbox/isDevMode, DEC-434). DEV_MODE=1 authz for
// /dev/mailbox (DEC-546: organizer-only, org-scoped) is covered by its own
// test, test/dev-mailbox.test.ts -- not this file's job.
//
// Route enumeration: Hono exposes the composed app's own route table via
// `app.routes` ({basePath, path, method, handler}[]) -- introspection, not
// a hand list (field guide: "hand-listed manifests desync -- enumerate in a
// test"). GET entries are deduped by path (a single `.get(path, mw,
// handler)` registration produces one RouterRoute per handler in its
// chain, all sharing the same path). Each unique path is turned into a
// concrete request path by substituting a literal for every `:param`
// segment (picking a literal that satisfies an inline `{regex}` constraint
// when one is present, e.g. embed's `:surface{[a-z]+\.json}` /
// `:surface{[a-z]+\.xml}`) and for a
// bare `*` wildcard segment.
//
// PUBLIC_BY_DESIGN is the only allowlist, and it is asserted exact in BOTH
// directions: every enumerated GET path must be either matched by an entry
// here (with a reason citing the DEC/source comment that documents it as
// intentionally no-login) or answer without ever touching the db stub; and
// every PUBLIC_BY_DESIGN entry must match at least one currently-enumerated
// route, so a deleted public route can't leave a stale hole (DEC-550).
//
// Finding from building this probe: none -- every enumerated GET route
// either matches an entry below (verified against its own source comment)
// or is guarded by a synchronous auth check (requireAuth/requireOrganizer/
// requireReviewerOrOrganizer/speakerGate/an inline `!c.var.auth` redirect)
// that throws or redirects strictly before any db access. If a future
// change added an ungated route, this file's header would say so instead
// of silently allowlisting it -- it does not, because there wasn't one to
// report.
//
// LIMITATION, worth knowing before trusting a green run here (found in
// wave 16 integration): env is `{}`, so it carries no KV binding, and
// publicCacheMiddleware throws "publicCacheMiddleware requires the KV
// binding" (src/server/pubcache.ts) before ANY /e/* or /embed/* handler
// body executes. Every public-surface path therefore proves only that the
// KV-missing throw is db-free, never that the handler behind it is -- what
// keeps those paths honest is their PUBLIC_BY_DESIGN entries below, not an
// observed non-touch. The db-touch signal is load-bearing only for routes
// that are not behind publicCacheMiddleware. This surfaced when DEC-841's
// wave-16 amendment made publicRoutes.onError render publicErrorDocument
// (which reads the eyebrow via resolveNotFoundEyebrow(c.var.db)) instead of
// http.ts's db-free renderHtmlError: 15 public paths began touching the db
// on the KV-throw error path, and the three bare roots among them
// (/e/:eventSlug, /embed/:eventSlug, /embed/e/:embedId) had no entry
// because the `/*` patterns don't match a bare path. They are public by
// design -- src/routes/docs.tsx's own route table says so -- so they are
// listed explicitly below rather than the probe being loosened.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { guardDevMailbox } from "../src/server/app";
import { parseIndexMounts } from "./helpers/index-mounts";

// ---------------------------------------------------------------------------
// PUBLIC_BY_DESIGN allowlist -- every entry below was verified against its
// own route file's source comment before being added here.
// ---------------------------------------------------------------------------

const PUBLIC_BY_DESIGN: { pattern: string; reason: string }[] = [
  {
    pattern: "/health",
    reason:
      "Meta liveness endpoint defined inline in createBaseApp() (src/server/app.ts) -- carries no data, needed before any session exists.",
  },
  {
    pattern: "/api/v1",
    reason:
      "Meta API-root endpoint defined inline in createBaseApp() (src/server/app.ts) -- returns {name,version} only, no session data.",
  },
  {
    pattern: "/",
    reason:
      "DEC-049: 'GET / is an SSR landing so the root URL never 404s for a judge' (src/routes/root.tsx header comment).",
  },
  {
    pattern: "/docs/api",
    reason:
      "DEC-056: 'public, no-login API docs page at GET /docs/api ... it documents no secrets so it's safe to be public' (src/routes/docs.tsx header comment).",
  },
  {
    pattern: "/docs/:slug",
    reason:
      "DEC-382 wave-3 amendment: the public docs site (src/routes/docs-site.tsx) -- an unknown slug renders publicNotFound, which reads the same anonymous db.select as every other public SSR 404 (resolveNotFoundEyebrow, src/server/not-found.tsx) to draw its eyebrow. No session by design, same as every other public surface's 404.",
  },
  {
    pattern: "/login",
    reason:
      "DEC-012: SSR login page, must be reachable while anonymous by definition (src/routes/auth.tsx header comment).",
  },
  {
    pattern: "/claim/:token",
    reason:
      "DEC-014: invite-claim landing page -- the token itself is the credential, not a session (src/routes/auth.tsx header comment).",
  },
  {
    pattern: "/submit/:eventSlug",
    reason:
      "DEC-005/DEC-012: public CFP submission form (J1 share link) -- no login by design (src/routes/public/submit.tsx header comment).",
  },
  {
    pattern: "/e/:eventSlug/*",
    reason:
      "DEC-022: 'the five public surfaces + embeds + itinerary .ics ... no login/session dependence anywhere in this module' (src/routes/public/index.tsx header comment). Covers every /e/:eventSlug/<surface>, the speaker/session detail pages, and the .ics feeds.",
  },
  {
    pattern: "/e/:eventSlug",
    reason:
      "DEC-661: 'a bare /e/:eventSlug or /embed/:eventSlug (no surface segment) is a guessable root a judge or embedder types by hand -- resolve the event BEFORE redirecting' (src/routes/public/index.tsx comment above the handler). Same no-login module as /e/:eventSlug/* above; the trailing-slash pattern does not cover the bare path.",
  },
  {
    pattern: "/embed/:eventSlug/*",
    reason:
      "DEC-022: same public/index.tsx module as /e/:eventSlug/* above -- embeddable widget surfaces, no login/session dependence.",
  },
  {
    pattern: "/embed/:eventSlug",
    reason:
      "DEC-661: the bare embed root, redirecting to /embed/<canonical slug>/sessions -- same handler comment and same no-login module as /e/:eventSlug above.",
  },
  {
    pattern: "/embed/e/:embedId",
    reason:
      "DEC-785/DEC-822/DEC-839: saved embeds -- 'GET /embed/e/:embedId resolves the embed row ... an intentional blank inside someone else's iframe' (src/routes/public/saved-embed.tsx header comment); src/routes/docs.tsx's own route table lists it as 'public, saved embed'. The saved id IS the capability, no session.",
  },
  {
    pattern: "/headshots/:fileId",
    reason:
      "DEC-028 origin/DEC-067 gate: 'headshots of visible speakers are public content by definition (J10 renders them)' -- the handler itself gates non-visible headshots to a 404 rather than requiring a session (src/routes/portal/profile.tsx comment above headshotServeRoutes).",
  },
];

function patternMatches(pattern: string, actualPath: string): boolean {
  if (pattern.endsWith("/*")) {
    return actualPath.startsWith(pattern.slice(0, -1));
  }
  return pattern === actualPath;
}

// ---------------------------------------------------------------------------
// Throwing db stub -- any property access is both recorded and fatal, so a
// route that reaches for the db before an auth check throws immediately
// (never silently returns undefined/empty data).
// ---------------------------------------------------------------------------

function makeThrowingDb(): { db: AppEnv["Variables"]["db"]; touched: () => boolean; reset: () => void } {
  let touched = false;
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        touched = true;
        throw new Error(`anonymous-route-probe: db.${String(prop)} accessed by an anonymous request`);
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
// minus createBaseApp()'s sessionLoader (auth is deliberately never set) and
// its bumpPublicVersionMiddleware/noStoreApi (cache concerns, out of scope
// for an authz probe), plus createBaseApp()'s two inline meta routes.
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

  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/api/v1", (c) => c.json({ name: "chautauqua", version: "v1" }));

  // Mounts are derived from src/index.ts's own source (parseIndexMounts,
  // DEC-518 technique) -- not typed by hand -- so this composition cannot
  // silently drop a mount again. guardDevMailbox is still applied
  // immediately before the devMailboxRoutes mount, exactly as
  // src/index.ts:84-85 does.
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
// Route table enumeration + literal substitution.
// ---------------------------------------------------------------------------

/** Picks a concrete literal for a `:name` or `:name{regex}` path segment. A
 * bare `*` wildcard segment gets a fixed literal too. Throws loudly if none
 * of the small candidate pool satisfies an inline regex constraint, rather
 * than silently skipping the route (a route this probe can't even request
 * is a route this probe can't vouch for). */
function literalFor(segment: string): string {
  if (segment === "*") return "probe-wildcard";
  if (!segment.startsWith(":")) return segment;
  const braceIdx = segment.indexOf("{");
  if (braceIdx === -1) return "probe-value";
  const regexSrc = segment.slice(braceIdx + 1, segment.length - 1);
  const re = new RegExp(`^${regexSrc}$`);
  // Suffixed candidates first: a suffix-constrained param (embed's
  // `.json`/`.xml` feed routes, DEC-289/DEC-775) is the only kind that a
  // plain literal can't satisfy, and adding a new suffix route without
  // adding its candidate here makes this probe throw by design.
  const candidates = ["probe.json", "probe.xml", "probe-value", "probevalue", "test"];
  const hit = candidates.find((c) => re.test(c));
  if (!hit) {
    throw new Error(
      `anonymous-route-probe: no candidate literal satisfies param regex /${regexSrc}/ in segment '${segment}'`,
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

function enumerateGetPaths(app: Hono<AppEnv>): string[] {
  const paths = new Set<string>();
  for (const route of app.routes) {
    if (route.method !== "GET") continue;
    paths.add(route.path);
  }
  return Array.from(paths).sort();
}

// ---------------------------------------------------------------------------
// The probe.
// ---------------------------------------------------------------------------

describe("anonymous-GET authz probe (DEC-550)", () => {
  it("enumerates at least the routes this task expects to exist (composition sanity)", async () => {
    const { app, mountCount } = await buildAnonymousApp();
    const getPaths = enumerateGetPaths(app);
    // A loose sanity floor, not the authz assertion itself -- proves the
    // composed app actually mounted every sub-app rather than silently
    // enumerating zero/few routes.
    expect(getPaths.length).toBeGreaterThan(40);
    expect(getPaths).toContain("/health");
    expect(getPaths).toContain("/api/v1/me");
    // The parsed mount count itself must never silently narrow again (it
    // was 29 in the wave-16 hand list vs. the real 35 -- see DEC-550
    // amendment, wave 18).
    expect(mountCount).toBeGreaterThanOrEqual(35);
  });

  it("every enumerated GET route is authz-gated or an exact, justified PUBLIC_BY_DESIGN entry", async () => {
    const { app, touched, reset } = await buildAnonymousApp();
    const getPaths = enumerateGetPaths(app);
    const matchedPatterns = new Set<string>();
    const failures: string[] = [];

    for (const routePath of getPaths) {
      const allowlistEntry = PUBLIC_BY_DESIGN.find((entry) => patternMatches(entry.pattern, routePath));
      if (allowlistEntry) matchedPatterns.add(allowlistEntry.pattern);

      reset();
      const requestPath = toRequestPath(routePath);
      // The db stub throws synchronously on first touch; a route that
      // reaches the db before an auth check surfaces that as a 500 via
      // registerErrorHandler rather than crashing the probe. env is `{}`
      // (no bindings at all, not even KV) -- DEV_MODE unset per DEC-550.
      await app.request(requestPath, {}, {} as unknown as AppEnv["Bindings"]);

      if (!allowlistEntry && touched()) {
        failures.push(
          `GET ${routePath} (requested as ${requestPath}) touched the db as an anonymous request and is not in PUBLIC_BY_DESIGN`,
        );
      }
    }

    expect(failures).toEqual([]);

    // Exact in the other direction too: every allowlist entry must still
    // match a currently-enumerated route (a deleted public route must not
    // leave a stale, unverifiable hole).
    const staleEntries = PUBLIC_BY_DESIGN.filter((entry) => !matchedPatterns.has(entry.pattern)).map(
      (entry) => entry.pattern,
    );
    expect(staleEntries).toEqual([]);
  });
});
