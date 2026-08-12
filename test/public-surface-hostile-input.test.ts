// DEC-459 enumeration lane #2 (task w18-e): hostile-input sweep of every
// unauthenticated surface reachable from src/index.ts's mounts. Table-driven
// so the enumerated route population is visible in one place (the ROUTES
// table below) -- see docs/verification-log/task-w18-e-public-hostile-input-
// stage1.md for the full enumeration-with-citations and findings narrative.
//
// Population (18 routes), each cited by its src/index.ts mount + own
// file:line (also restated in the verification log):
//  - src/routes/public/index.tsx: GET /e/:eventSlug/{sessions,speakers,
//    agenda,schedule,gallery} (:105), GET /e/:eventSlug/speakers/:contactId
//    (:125), GET /e/:eventSlug/sessions/:sessionId (:139),
//    GET /embed/:eventSlug/:surface.json (:160), GET /embed/:eventSlug/:surface
//    (:174), GET /e/:eventSlug/schedule.ics (:197), GET /e/:eventSlug/agenda.ics
//    (:234) -- mounted via `app.route("/", publicRoutes)` in src/index.ts.
//  - src/routes/public/submit.tsx: GET /submit/:eventSlug (:410),
//    POST /submit/:eventSlug/save-draft (:466), POST /submit/:eventSlug (:554)
//    -- mounted via `app.route("/", publicSubmitRoutes)`.
//  - src/routes/auth.tsx: GET /login (:152), POST /login (:158, minus the
//    two cases DEC-459 assigns to w18-c: oversized-email body and oversized
//    x-forwarded-for), POST /logout (:226, reachable with no session -- it
//    just no-ops the cookie clear), GET /claim/:token (:237), POST
//    /claim/:token (:249) -- mounted via `app.route("/", authRoutes)`.
//  - src/routes/root.tsx: GET / (:130) -- mounted via `app.route("/", rootRoutes)`.
//  - src/routes/docs.tsx: GET /docs/api (:332) -- mounted via
//    `app.route("/", docsRoutes)`.
//  - src/routes/portal/profile.tsx: GET /headshots/:fileId (:406) -- the one
//    file-serving path reachable without a session (public headshots);
//    mounted via `app.route("/", headshotServeRoutes)`. GET /files/:fileId
//    (src/routes/files.ts:385) is NOT in this population -- it calls
//    requireAuth() as its first line and 401s unconditionally with no
//    session, so it never reaches any hostile-input parsing.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { publicRoutes } from "../src/routes/public";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { authRoutes } from "../src/routes/auth";
import { rootRoutes } from "../src/routes/root";
import { docsRoutes } from "../src/routes/docs";
import { headshotServeRoutes } from "../src/routes/portal/profile";

// ---------------------------------------------------------------------------
// Fake db: a generic drizzle-chain double (same shape as test/public.test.ts's
// makeChain). The FIRST db.select() in any request resolves to a valid event
// row (so eventSlug/token-shaped hostile path segments reach real handler
// logic -- query-param parsing, repo calls, template building -- instead of
// short-circuiting on a plain "event not found"); every subsequent select()
// resolves empty (so nothing beyond that first lookup is ever "found",
// keeping every route's real branches shallow and mock-cheap).
// ---------------------------------------------------------------------------

// DEC-516: offset() is a real chain step (not merely a terminal after
// limit()) since the public sessions/speakers repo queries now chain
// .limit().offset() for a windowed JSON feed page.
// DEC-548: as() is likewise a real chain step -- getPublicAgenda builds its
// unwindowed count(*) as a selectDistinct(...).as("agenda_rows") subquery, so
// a double without it throws a TypeError mid-handler (which this file's whole
// point is that no hostile input should ever be able to provoke).
function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    as: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function makeDb() {
  let selectCall = 0;
  return {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      return makeChain([]);
    },
    selectDistinct: () => makeChain([]),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: "new-id" }],
      }),
    }),
  } as unknown as AppEnv["Variables"]["db"];
}

// Auth routes (login/claim) query completely different row shapes on their
// first select() than the event-by-slug lookup above (schema.user,
// schema.contact) -- reusing EVENT_ROW there would hand verifyPassword() an
// object with no passwordHash, which is a MOCK bug, not a product one.
// These probes use a plain always-empty db instead: "no such user"/"no such
// contact" are exactly the safe not-found branches every one of these
// handlers already has to hit for a stranger's hostile input anyway.
function makeEmptyDb() {
  return {
    select: () => makeChain([]),
    selectDistinct: () => makeChain([]),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: "new-id" }],
      }),
    }),
  } as unknown as AppEnv["Variables"]["db"];
}

// ---------------------------------------------------------------------------
// Fake KV: default get() -> null (so rate limiters see an empty window and
// claim/draft lookups see "not found"), except one pre-seeded claim record
// so POST /claim/:token's hostile-password probes reach validateAnswers-
// adjacent logic instead of 404ing at the token lookup.
// ---------------------------------------------------------------------------

const KNOWN_TOKEN = "w18e-known-token";
// sha256("w18e-known-token") hex, precomputed (readClaimToken hashes the
// token before the KV lookup -- see src/auth/claim.ts:63-67).
const KNOWN_TOKEN_HASH = "c5be188b6ec1568014625a8dbe13f048abff8e26f50f21604057546a7563a98f";

function fakeKv() {
  const store = new Map<string, string>();
  store.set(
    `claim:${KNOWN_TOKEN_HASH}`,
    JSON.stringify({ contactId: "contact-1", eventId: "ev1" }),
  );
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function buildApp(dbFactory: () => AppEnv["Variables"]["db"] = makeDb) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", dbFactory());
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  app.route("/", publicSubmitRoutes);
  app.route("/", authRoutes);
  app.route("/", rootRoutes);
  app.route("/", docsRoutes);
  app.route("/", headshotServeRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Hostile input fixtures
// ---------------------------------------------------------------------------

const LONG_100K = "a".repeat(100_000);
const LONG_SLUG_5K = "s".repeat(5000);
const EMOJI = "\u{1F600}".repeat(200); // 4-byte unicode, repeated
const TRAVERSAL = "../../../etc/passwd";
const ENCODED_TRAVERSAL = "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd";
const HOSTILE_NUMERICS = ["1e308", "NaN", "-1", "0", "9007199254740992" /* 2**53 */, "Infinity"];

function csrfCookiePair(token = "w18e-csrf-token"): { cookie: string; field: string } {
  return { cookie: `chq_csrf=${token}`, field: token };
}

/** Every response asserted here: never a 5xx, and never leaks internals. */
async function assertSafe(res: Response, label: string): Promise<void> {
  expect(res.status, `${label} status`).toBeGreaterThanOrEqual(200);
  expect(res.status, `${label} status should never be 5xx`).toBeLessThan(500);
  const text = await res.clone().text().catch(() => "");
  expect(text, `${label} body must not contain a stack trace frame`).not.toMatch(/at .+:\d+:\d+/);
  expect(text, `${label} body must not contain an absolute source path`).not.toMatch(/\/(Users|home|src)\/[^\s"']*\.(ts|tsx|js)/);
  expect(text.toLowerCase(), `${label} body must not name a raw exception type`).not.toMatch(
    /typeerror|referenceerror|rangeerror|syntaxerror(?!:|")/,
  );
}

// ---------------------------------------------------------------------------
// GET routes taking a hostile path segment
// ---------------------------------------------------------------------------

type PathProbe = { name: string; path: (hostile: string) => string };

const PATH_PROBES: PathProbe[] = [
  { name: "GET /e/:eventSlug/sessions", path: (h) => `/e/${h}/sessions` },
  { name: "GET /e/:eventSlug/speakers", path: (h) => `/e/${h}/speakers` },
  { name: "GET /e/:eventSlug/agenda", path: (h) => `/e/${h}/agenda` },
  { name: "GET /e/:eventSlug/schedule", path: (h) => `/e/${h}/schedule` },
  { name: "GET /e/:eventSlug/gallery", path: (h) => `/e/${h}/gallery` },
  { name: "GET /e/:eventSlug/speakers/:contactId", path: (h) => `/e/conf/speakers/${h}` },
  { name: "GET /e/:eventSlug/sessions/:sessionId", path: (h) => `/e/conf/sessions/${h}` },
  { name: "GET /embed/:eventSlug/:surface.json", path: (h) => `/embed/${h}/sessions.json` },
  { name: "GET /embed/:eventSlug/:surface", path: (h) => `/embed/${h}/sessions` },
  { name: "GET /e/:eventSlug/schedule.ics", path: (h) => `/e/${h}/schedule.ics` },
  { name: "GET /e/:eventSlug/agenda.ics", path: (h) => `/e/${h}/agenda.ics` },
  { name: "GET /submit/:eventSlug", path: (h) => `/submit/${h}` },
  { name: "GET /claim/:token", path: (h) => `/claim/${h}` },
  { name: "GET /headshots/:fileId", path: (h) => `/headshots/${h}` },
];

const HOSTILE_PATH_VALUES: Record<string, string> = {
  "100k-char": LONG_100K,
  "5k-char slug": LONG_SLUG_5K,
  "unicode/emoji": EMOJI,
  "traversal (raw ../)": TRAVERSAL,
  "traversal (percent-encoded)": ENCODED_TRAVERSAL,
};

describe("hostile path segments never 5xx or leak internals (DEC-459)", () => {
  for (const probe of PATH_PROBES) {
    for (const [hostileName, hostileValue] of Object.entries(HOSTILE_PATH_VALUES)) {
      it(`${probe.name} with ${hostileName}`, async () => {
        installFakeCaches();
        const app = buildApp();
        const encoded = encodeURIComponent(hostileValue).replace(/%2F/gi, hostileName === "traversal (percent-encoded)" ? "%2f" : "%2F");
        const path = probe.path(hostileName.startsWith("traversal") ? hostileValue : encoded);
        const res = await app.request(path, {}, TEST_ENV);
        await assertSafe(res, `${probe.name} [${hostileName}]`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// GET routes: hostile query params (page/limit/ids numerics, repeated
// params, unicode search text, wrong-type array encodings, missing params)
// ---------------------------------------------------------------------------

type QueryProbe = { name: string; path: string };

const QUERY_PROBES: QueryProbe[] = [
  { name: "GET /e/:slug/sessions", path: "/e/conf/sessions" },
  { name: "GET /e/:slug/speakers", path: "/e/conf/speakers" },
  { name: "GET /e/:slug/agenda", path: "/e/conf/agenda" },
  { name: "GET /embed/:slug/sessions", path: "/embed/conf/sessions" },
  { name: "GET /embed/:slug/sessions.json", path: "/embed/conf/sessions.json" },
  { name: "GET /e/:slug/schedule.ics", path: "/e/conf/schedule.ics" },
];

describe("hostile numeric query params never 5xx (DEC-459: page/limit/ids)", () => {
  for (const probe of QUERY_PROBES) {
    for (const numeric of HOSTILE_NUMERICS) {
      it(`${probe.name} ?page=${numeric}`, async () => {
        installFakeCaches();
        const app = buildApp();
        const res = await app.request(`${probe.path}?page=${encodeURIComponent(numeric)}`, {}, TEST_ENV);
        await assertSafe(res, `${probe.name} ?page=${numeric}`);
      });

      it(`${probe.name} ?limit=${numeric}`, async () => {
        installFakeCaches();
        const app = buildApp();
        const res = await app.request(`${probe.path}?limit=${encodeURIComponent(numeric)}`, {}, TEST_ENV);
        await assertSafe(res, `${probe.name} ?limit=${numeric}`);
      });
    }
  }

  for (const numeric of HOSTILE_NUMERICS) {
    it(`GET /e/:slug/schedule.ics ?ids=${numeric}`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(`/e/conf/schedule.ics?ids=${encodeURIComponent(numeric)}`, {}, TEST_ENV);
      await assertSafe(res, `schedule.ics ?ids=${numeric}`);
    });
  }

  it("GET /e/:slug/schedule.ics ?ids= 100k-char value", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request(`/e/conf/schedule.ics?ids=${LONG_100K}`, {}, TEST_ENV);
    await assertSafe(res, "schedule.ics ?ids=100k-char");
  });

  it("GET /e/:slug/schedule.ics ?ids= repeated 50 times", async () => {
    installFakeCaches();
    const app = buildApp();
    const qs = Array.from({ length: 50 }, (_, i) => `ids=id${i}`).join("&");
    const res = await app.request(`/e/conf/schedule.ics?${qs}`, {}, TEST_ENV);
    await assertSafe(res, "schedule.ics ids repeated 50x");
  });
});

describe("hostile query params: repeated params, wrong types, unicode, 100k values (DEC-459)", () => {
  for (const probe of QUERY_PROBES) {
    it(`${probe.name} ?q= repeated 50 times`, async () => {
      installFakeCaches();
      const app = buildApp();
      const qs = Array.from({ length: 50 }, (_, i) => `q=term${i}`).join("&");
      const res = await app.request(`${probe.path}?${qs}`, {}, TEST_ENV);
      await assertSafe(res, `${probe.name} q x50`);
    });

    it(`${probe.name} ?q= 100k-char`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(`${probe.path}?q=${LONG_100K}`, {}, TEST_ENV);
      await assertSafe(res, `${probe.name} q=100k`);
    });

    it(`${probe.name} ?q= unicode/emoji`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(`${probe.path}?q=${encodeURIComponent(EMOJI)}`, {}, TEST_ENV);
      await assertSafe(res, `${probe.name} q=emoji`);
    });

    it(`${probe.name} ?page[]=1&page[]=2 (array where string expected)`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(`${probe.path}?page[]=1&page[]=2`, {}, TEST_ENV);
      await assertSafe(res, `${probe.name} page[]=array`);
    });

    it(`${probe.name} with no query params at all (missing optional params)`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(probe.path, {}, TEST_ENV);
      await assertSafe(res, `${probe.name} bare`);
    });
  }

  it("GET /embed/:slug/:surface ?accent= 100k-char", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request(`/embed/conf/sessions?accent=${LONG_100K}`, {}, TEST_ENV);
    await assertSafe(res, "embed accent=100k");
  });

  it("GET /e/:slug/sessions ?fields= 100k-char CSV", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request(`/e/conf/sessions?fields=${LONG_100K}`, {}, TEST_ENV);
    await assertSafe(res, "sessions fields=100k");
  });

  it("GET /e/:slug/agenda ?day= hostile non-date value (100k-char)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request(`/e/conf/agenda?day=${LONG_100K}`, {}, TEST_ENV);
    await assertSafe(res, "agenda day=100k");
  });

  it("GET /e/:slug/speakers/:contactId ?from= hostile 100k-char value", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request(`/e/conf/speakers/c1?from=${LONG_100K}`, {}, TEST_ENV);
    await assertSafe(res, "speaker detail from=100k");
  });
});

// ---------------------------------------------------------------------------
// GET /login, GET / , GET /docs/api: no dynamic segments, but exercised with
// a giant/unicode query string tail to confirm bare SSR pages never 5xx.
// ---------------------------------------------------------------------------

describe("static SSR surfaces with a hostile query tail (DEC-459)", () => {
  const STATIC_GETS = ["/login", "/", "/docs/api"];
  for (const path of STATIC_GETS) {
    it(`GET ${path} with a 100k-char query string`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(`${path}?x=${LONG_100K}`, {}, TEST_ENV);
      await assertSafe(res, `GET ${path} 100k query`);
    });

    it(`GET ${path} with a repeated param x50`, async () => {
      installFakeCaches();
      const app = buildApp();
      const qs = Array.from({ length: 50 }, (_, i) => `x=${i}`).join("&");
      const res = await app.request(`${path}?${qs}`, {}, TEST_ENV);
      await assertSafe(res, `GET ${path} x50`);
    });

    it(`GET ${path} with unicode/emoji query`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(`${path}?x=${encodeURIComponent(EMOJI)}`, {}, TEST_ENV);
      await assertSafe(res, `GET ${path} emoji`);
    });
  }
});

// ---------------------------------------------------------------------------
// POST routes: malformed JSON bodies, wrong-typed/oversized form fields,
// missing required fields, unicode, repeated fields.
//
// Per DEC-459's explicit scope carve-out, the oversized-email POST /login
// case and the oversized x-forwarded-for cases are NOT probed here -- see
// task-w18-c, which owns them.
// ---------------------------------------------------------------------------

describe("POST /login hostile bodies never 5xx (DEC-459, minus w18-c's two carve-outs)", () => {
  const { cookie, field } = csrfCookiePair();

  it("missing password field", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field, email: "a@b.com" });
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /login missing password");
  });

  it("missing email field", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field, password: "hunter22222" });
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /login missing email");
  });

  it("100k-char password field", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field, email: "a@b.com", password: LONG_100K });
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /login password=100k");
  });

  it("unicode/emoji email + password", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field, email: `${EMOJI}@example.com`, password: EMOJI });
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /login unicode email/password");
  });

  it("repeated email field x50 (wrong shape: array where string expected)", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const qs = [`chq_csrf=${field}`, ...Array.from({ length: 50 }, () => `email=a@b.com`), "password=hunter22222"].join("&");
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: qs },
      TEST_ENV,
    );
    await assertSafe(res, "POST /login email x50");
  });

  it("malformed JSON body (wrong content-type entirely)", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const res = await app.request(
      "/login",
      { method: "POST", headers: { "content-type": "application/json", cookie }, body: "{not-valid-json" },
      TEST_ENV,
    );
    await assertSafe(res, "POST /login malformed JSON body");
  });
});

describe("POST /claim/:token hostile bodies never 5xx (DEC-459)", () => {
  const { cookie, field } = csrfCookiePair();

  it("known token, missing password field", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field });
    const res = await app.request(
      `/claim/${KNOWN_TOKEN}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /claim known token, no password");
  });

  it("known token, 100k-char password", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field, password: LONG_100K });
    const res = await app.request(
      `/claim/${KNOWN_TOKEN}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /claim known token, password=100k");
  });

  it("unknown/garbage token (hostile path segment), any body", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const body = new URLSearchParams({ chq_csrf: field, password: "hunter22222" });
    const res = await app.request(
      `/claim/${encodeURIComponent(TRAVERSAL)}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: body.toString() },
      TEST_ENV,
    );
    await assertSafe(res, "POST /claim traversal token");
  });

  it("malformed JSON body (wrong content-type entirely)", async () => {
    installFakeCaches();
    const app = buildApp(makeEmptyDb);
    const res = await app.request(
      `/claim/${KNOWN_TOKEN}`,
      { method: "POST", headers: { "content-type": "application/json", cookie }, body: "[1,2,{broken" },
      TEST_ENV,
    );
    await assertSafe(res, "POST /claim malformed JSON body");
  });
});

describe("POST /logout never 5xx even with no session and hostile CSRF value (DEC-459)", () => {
  it("no cookies at all", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/logout", { method: "POST" }, TEST_ENV);
    await assertSafe(res, "POST /logout no cookies");
  });

  it("100k-char CSRF cookie value with mismatched form field", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request(
      "/logout",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `chq_csrf=${LONG_100K}` },
        body: "chq_csrf=different",
      },
      TEST_ENV,
    );
    await assertSafe(res, "POST /logout 100k csrf cookie");
  });
});

describe("POST /submit/:eventSlug and save-draft: hostile bodies never 5xx (DEC-459)", () => {
  const { cookie, field } = csrfCookiePair();

  for (const path of ["/submit/conf", "/submit/conf/save-draft"]) {
    it(`${path}: 100k-char form field + oversized array-shaped field`, async () => {
      installFakeCaches();
      const app = buildApp();
      const qs = [`chq_csrf=${field}`, `title=${LONG_100K}`, "trackIds=a", "trackIds=b", "trackIds=c"].join("&");
      const res = await app.request(
        path,
        { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: qs },
        TEST_ENV,
      );
      await assertSafe(res, `POST ${path} 100k field + array trackIds`);
    });

    it(`${path}: unicode/emoji field values`, async () => {
      installFakeCaches();
      const app = buildApp();
      const qs = [`chq_csrf=${field}`, `title=${encodeURIComponent(EMOJI)}`, `speaker_email=${encodeURIComponent(EMOJI)}@example.com`].join(
        "&",
      );
      const res = await app.request(
        path,
        { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: qs },
        TEST_ENV,
      );
      await assertSafe(res, `POST ${path} unicode fields`);
    });

    it(`${path}: no body at all (missing every field)`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(
        path,
        { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: `chq_csrf=${field}` },
        TEST_ENV,
      );
      await assertSafe(res, `POST ${path} empty body`);
    });

    it(`${path}: malformed JSON body (wrong content-type entirely)`, async () => {
      installFakeCaches();
      const app = buildApp();
      const res = await app.request(
        path,
        { method: "POST", headers: { "content-type": "application/json", cookie }, body: "{\"a\":" },
        TEST_ENV,
      );
      await assertSafe(res, `POST ${path} malformed JSON body`);
    });
  }

  it("hostile eventSlug path segment (traversal) on POST /submit/:eventSlug", async () => {
    installFakeCaches();
    const app = buildApp();
    const qs = `chq_csrf=${field}`;
    const res = await app.request(
      `/submit/${encodeURIComponent(TRAVERSAL)}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: qs },
      TEST_ENV,
    );
    await assertSafe(res, "POST /submit traversal eventSlug");
  });
});
