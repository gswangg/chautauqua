// DEC-049/DEC-581/DEC-582: GET / is now the anonymous event hub -- signed-in
// organizer/reviewer/speaker sessions redirect away, and anonymous visitors
// get the org's own hub, built from getHubOrg/listHubEvents (src/server/
// repo/public/home.ts) + groupHubEvents/hubState (src/lib/home-hub.ts).
//
// The fake Db below is a generic drizzle-shaped query-chain stub: every
// db.select() call returns the next array off a queue, regardless of which
// columns/from/where/orderBy/limit/groupBy calls are chained on top -- the
// real column-shape/predicate contract is covered by
// test/home-hub.test.ts (pure grouping logic) and the real-D1 integration
// suite (test/public.test.ts's sibling, per DEC-012). This file only proves
// root.tsx wires auth redirects + the hub render correctly given whatever
// rows the repo layer hands back.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import { HUB_CANDIDATE_LIMIT } from "../src/server/repo/public/home";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";

function fakeAssets(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = typeof input === "string" || input instanceof URL ? new URL(input) : new URL(input.url);
      if (url.pathname === "/admin/index.html") {
        return new Response("<html>admin shell</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

// DEC-268: simulates the fresh-clone / never-built state where
// public/admin/index.html doesn't exist and the ASSETS binding 404s it.
function fakeAssetsMissingAdmin(): Fetcher {
  return {
    async fetch() {
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

/** A generic drizzle-shaped query-chain fake: each db.select() call pops the
 * next row array off `resultQueue`, in call order, regardless of which
 * from/leftJoin/where/orderBy/limit/groupBy calls follow -- awaiting the
 * chain at any point resolves to that array. */
function fakeDb(resultQueue: unknown[][]): Db {
  let i = 0;
  return {
    select: () => {
      const results = resultQueue[i++] ?? [];
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

const ORG = { id: "org1", name: "Chautauqua Demo Org" };

const DAY = 86_400_000;
// root.tsx computes nowMs via its own Date.now() call at request time (not
// injectable) -- NOW here is captured at test-file load, close enough to
// the request-time value that all offsets below (days) stay unambiguous.
const NOW = Date.now();

// listHubEvents reads form.openDate/closeDate as Drizzle timestamp_ms
// columns, i.e. JS Date objects (see src/db/schema.ts) -- `openMs`/`closeMs`
// below are plain epoch-ms test inputs, converted to Date here so the fake
// db hands back the same shape the real column would.
function eventRow(overrides: {
  id?: string;
  name?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  timezone?: string;
  openMs?: number | null;
  closeMs?: number | null;
}) {
  const { openMs = null, closeMs = null, ...rest } = overrides;
  return {
    id: "e1",
    name: "DevFlow Conf 2027",
    slug: "devflow-conf-2027",
    startDate: "2027-05-12",
    endDate: "2027-05-14",
    location: "Moscone West, San Francisco",
    timezone: "America/Los_Angeles",
    ...rest,
    openDate: openMs === null ? null : new Date(openMs),
    closeDate: closeMs === null ? null : new Date(closeMs),
  };
}

/** Builds the [orgRows, eventRows, countRows, trackCountRows, formatCountRows]
 * queue listHubEvents/getHubOrg consume, in call order. `countRows`/
 * `trackCountRows`/`formatCountRows` may be omitted for a zero-event fixture
 * (listHubEvents skips all three grouped queries when eventIds is empty). */
function buildQueue(opts: {
  events: ReturnType<typeof eventRow>[];
  countRows?: { eventId: string; count: number }[];
  trackCountRows?: { eventId: string; count: number }[];
  formatCountRows?: { eventId: string; count: number }[];
}): unknown[][] {
  const hasEvents = opts.events.length > 0;
  const countRows = hasEvents ? (opts.countRows ?? []) : [];
  const trackCountRows = hasEvents ? (opts.trackCountRows ?? []) : [];
  const formatCountRows = hasEvents ? (opts.formatCountRows ?? []) : [];
  return [[ORG], opts.events, countRows, trackCountRows, formatCountRows];
}

function buildApp(opts: { auth?: AuthInfo; queue?: unknown[][] }) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb(opts.queue ?? buildQueue({ events: [] })));
    if (opts.auth) c.set("auth", opts.auth);
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "o1" };
const REVIEWER: AuthInfo = { userId: "u3", role: "reviewer", orgId: "o1" };
const SPEAKER: AuthInfo = { userId: "u2", role: "speaker", orgId: "o1", contactId: "c1" };

describe("GET /admin and /admin/*", () => {
  it("redirects anonymous requests to /login", async () => {
    const app = buildApp({});
    const res = await app.request("/admin/submissions", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("redirects a speaker session to /portal?from=admin", async () => {
    const app = buildApp({ auth: SPEAKER });
    const res = await app.request("/admin/submissions", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal?from=admin");
  });

  it("serves the admin shell for an organizer session", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin/submissions", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("serves the bare /admin route for a reviewer session too", async () => {
    const app = buildApp({ auth: REVIEWER });
    const res = await app.request("/admin", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("fails loudly with a 500 and an actionable message when the admin bundle is missing (DEC-268)", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin", {}, { ASSETS: fakeAssetsMissingAdmin() });
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("npm run build");
  });

  it("proxies /admin/assets/* to ASSETS regardless of auth", async () => {
    const app = buildApp({});
    const res = await app.request("/admin/assets/index-abc.js", {}, { ASSETS: fakeAssets() });
    // fakeAssets 404s anything but /admin/index.html — the point here is
    // that it was never redirected to /login.
    expect(res.status).toBe(404);
  });
});

describe("GET / — role redirects (DEC-582)", () => {
  it("redirects an organizer session to /admin", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  // DEC-918/DEC-022 amendment (wave 69): a signed-in role redirect must
  // never be cached -- publicCacheMiddleware isn't mounted on "/" at all,
  // but the response itself must still refuse caching so a shared proxy/
  // browser-back never replays a stale redirect for a since-signed-out
  // session.
  it("both role redirects carry Cache-Control: no-store", async () => {
    const organizerRes = await buildApp({ auth: ORGANIZER }).request("/", {}, { ASSETS: fakeAssets() });
    expect(organizerRes.status).toBe(302);
    expect(organizerRes.headers.get("cache-control")).toBe("no-store");

    const speakerRes = await buildApp({ auth: SPEAKER }).request("/", {}, { ASSETS: fakeAssets() });
    expect(speakerRes.status).toBe(302);
    expect(speakerRes.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects a reviewer session to /admin", async () => {
    const app = buildApp({ auth: REVIEWER });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("redirects a speaker session to /portal", async () => {
    const app = buildApp({ auth: SPEAKER });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");
  });
});

describe("GET / — anonymous hub (DEC-581)", () => {
  it("fresh state: no events at all -- sign-in only, org name in masthead", async () => {
    const app = buildApp({ queue: buildQueue({ events: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Chautauqua Demo Org");
    expect(body).toContain("Nothing here yet");
    expect(body).toContain('href="/login"');
  });

  // DEC-918/DEC-022 amendment (wave 69), DEC-099 wave-34 amendment: GET /
  // gets the same public cache contract as every other anonymous public GET
  // (setCacheHeaders, imported from ./public/shell so the value can't drift,
  // now also sets Vary: Cookie itself) -- but is NOT mounted under
  // publicCacheMiddleware (see the header comment on the route for why: it's
  // a now-derived page with no purge hook, and the middleware answers before
  // the auth-redirect branch could ever run).
  it("anonymous GET / carries the 60s public cache contract and Vary: Cookie", async () => {
    const app = buildApp({ queue: buildQueue({ events: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=300");
    expect(res.headers.get("vary")).toBe("Cookie");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("between_cycles state: only a past event -- archive leads, sign-in note shown", async () => {
    const events = [
      eventRow({
        id: "e1",
        name: "DevFlow Conf 2026",
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        openMs: null,
        closeMs: null,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events, countRows: [{ eventId: "e1", count: 5 }] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("No open calls right now");
    expect(body).toContain("Already happened");
    expect(body).toContain("DevFlow Conf 2026");
    expect(body).toContain("Organisers and reviewers");
  });

  it("full state: an open-CFP event renders 'Submit a talk' linking to /submit/:slug", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("Events");
    expect(body).toContain("Open for submissions");
    expect(body).toContain("No account needed");
    expect(body).toContain('href="/submit/devflow-conf-2027"');
  });

  it("full state: a published (non-open-CFP) event links to the public programme, not /submit", async () => {
    const events = [
      eventRow({
        id: "e2",
        name: "DevFlow Workshops",
        slug: "devflow-workshops",
        startDate: "2027-10-09",
        endDate: "2027-10-10",
        openMs: null,
        closeMs: null, // form has no close date but is not open (see below)
      }),
    ];
    // closeDate null + openDate null would compute cfpOpen=true via
    // formWindowState; force a closed window instead via a past close date.
    (events[0] as { closeDate: Date | null }).closeDate = new Date(NOW - 30 * DAY);
    const app = buildApp({ queue: buildQueue({ events, countRows: [{ eventId: "e2", count: 12 }] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("Programme published");
    expect(body).toContain("DevFlow Workshops");
    expect(body).toContain('href="/e/devflow-workshops/sessions"');
    expect(body).not.toContain('href="/submit/devflow-workshops"');
  });

  it("never lists an event with a not_yet_open CFP and zero published sessions", async () => {
    const events = [
      eventRow({
        id: "e3",
        name: "Hidden Future Summit",
        slug: "hidden-future-summit",
        startDate: "2028-01-01",
        endDate: "2028-01-02",
        openMs: NOW + 60 * DAY,
        closeMs: NOW + 90 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events, countRows: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).not.toContain("Hidden Future Summit");
  });

  it("never renders a submission-count or review-progress string", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events, countRows: [{ eventId: "e1", count: 40 }] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text().then((t) => t.toLowerCase());
    // "Open for submissions" (the DEC-581 section heading) legitimately
    // contains the word "submission" -- what must never appear is an actual
    // count/progress metric (docs/design's "Kept off every row" panel).
    expect(body).not.toContain("submission count");
    expect(body).not.toContain("submissions received");
    expect(body).not.toContain("review progress");
    expect(body).not.toContain("acceptance rate");
    expect(body).not.toContain("speaker-task health");
    expect(body).not.toContain("last activity");
  });

  it("carries the GitHub attribution footer and never says 'chautauqua' outside it", async () => {
    // deliberately an org name that does NOT itself contain "chautauqua" --
    // the fixture org in other tests is named "Chautauqua Demo Org", which
    // would make this assertion trivially pass/fail on the wrong signal.
    const queue = buildQueue({ events: [] });
    queue[0] = [{ id: "org1", name: "Example Org" }];
    const app = buildApp({ queue });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("Running on");
    expect(body).toContain("github.com/gswangg/chautauqua");
    // the masthead carries the org's name, not the product's
    const beforeFooter = body.split("chq-home-footer")[0] ?? "";
    expect(beforeFooter.toLowerCase()).not.toContain("chautauqua");
  });

  // DEC-374 escaping trap, inherited from test/tools-surfaces.test.ts when
  // DEC-582 moved / off the DEC-382 operator-chrome list: every inlined CSS
  // module (ThemeStyles, PUBLIC_CSS, HOME_CSS) must go in via
  // dangerouslySetInnerHTML, never as a hono/jsx text child, or quoted CSS
  // values round-trip as HTML entities and the stylesheet silently breaks.
  it("inlines every style block unescaped (DEC-374)", async () => {
    const app = buildApp({ queue: buildQueue({ events: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    const body = await res.text();
    const blocks = [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
    expect(blocks.length).toBeGreaterThan(0);
    const css = blocks.map((m) => m[1]).join("\n");
    expect(css).toContain("Familjen Grotesk");
    expect(css).not.toContain("&#39;");
    expect(css).not.toContain("&quot;");
    expect(css).not.toContain("&gt;");
  });

  // DEC-670: capped is a fact about the fetched window, never a disclosing
  // org-wide count -- an org with hidden (no open CFP, no published
  // sessions) events beyond the 2 visible ones must never leak that hidden
  // count anywhere in the page, and under the candidate limit there is no
  // cap note at all.
  it("renders no cap note, and never a digit equal to the hidden-event count, when under the candidate limit", async () => {
    const HIDDEN_COUNT = 7;
    const hidden = Array.from({ length: HIDDEN_COUNT }, (_, i) =>
      eventRow({
        id: `hidden-${i}`,
        name: `Hidden Event ${i}`,
        slug: `hidden-event-${i}`,
        startDate: "2028-01-01",
        endDate: "2028-01-02",
        openMs: NOW + 60 * DAY,
        closeMs: NOW + 90 * DAY,
      }),
    );
    // The visible rows print a "· N DAYS LEFT" numeral derived from NOW
    // (= Date.now()), so their close offset must be chosen so that numeral
    // can never equal HIDDEN_COUNT -- otherwise this test fails purely on
    // the wall-clock time of day. A 6-day offset rounds up to "7 DAYS LEFT"
    // when the suite runs late enough in the day, which is a false positive
    // for a leak. 60 days out can render only 60 or 61, neither of which
    // contains a standalone 7.
    const VISIBLE_CLOSE_OFFSET_DAYS = 60;
    const visible = [
      eventRow({ id: "v1", slug: "visible-one", startDate: "2027-05-12", endDate: "2027-05-14", openMs: null, closeMs: NOW + VISIBLE_CLOSE_OFFSET_DAYS * DAY }),
      eventRow({ id: "v2", slug: "visible-two", startDate: "2027-06-12", endDate: "2027-06-14", openMs: null, closeMs: NOW + VISIBLE_CLOSE_OFFSET_DAYS * DAY }),
    ];
    const events = [...visible, ...hidden];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    // the stylesheet unconditionally defines .chq-home-cap-note (it's also
    // used by the between_cycles sign-in row) -- what must never render is
    // the note element itself, i.e. the "Showing ..." sentence.
    expect(body).not.toContain("Showing");
    const total = events.length; // N+2
    expect(body).not.toContain(`of ${total}`);
    // scope the digit check to the rendered body content (footer/scripts/CSS
    // legitimately contain stray digits, e.g. the GitHub SVG path data) --
    // the count would only ever be disclosed inside the hub body.
    const bodyOnly = body.split('class="chq-home-body"')[1]?.split("chq-home-footer")[0] ?? "";
    expect(bodyOnly).not.toMatch(new RegExp(`\\b${HIDDEN_COUNT}\\b`));
  });

  it("renders the capped note when the candidate set returns exactly HUB_CANDIDATE_LIMIT rows", async () => {
    const events = Array.from({ length: HUB_CANDIDATE_LIMIT }, (_, i) =>
      eventRow({
        id: `e${i}`,
        slug: `event-${i}`,
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    );
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("chq-home-cap-note");
    expect(body).toContain(`Showing the ${HUB_CANDIDATE_LIMIT} most recent events.`);
  });
});

// w15-d: closing the six r2-home fixes (mandate item 31).
describe("GET / — footer (mandate item 31a/31b)", () => {
  it("never emits a stray gear glyph before the GitHub mark, and links API docs to /docs/api", async () => {
    const app = buildApp({ queue: buildQueue({ events: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).not.toContain("⚙");
    // G13 lane-D fix (12-home--04): the fresh deploy carries the affordance
    // once, as the hero tertiary -- the footer's right edge stays empty.
    expect(body).toContain('href="/docs/api"');
    expect(body).toContain("API docs ›");
    expect(body).not.toContain(">API docs<");
  });
});

describe("GET / — open-CFP row has exactly one action (mandate item 31c)", () => {
  it("never renders a Speakers link in an open-CFP row, even when sessions are published", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events, countRows: [{ eventId: "e1", count: 4 }] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain('href="/submit/devflow-conf-2027"');
    expect(body).not.toContain('href="/e/devflow-conf-2027/speakers"');
  });
});

describe("GET / — British date grammar (mandate item 31d)", () => {
  it("renders a same-month range as 'DD–DD Month YYYY' with the month printed once, no comma", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("12–14 May 2027");
    expect(body).not.toContain("12 May–14 May 2027");
  });

  it("renders a cross-month range with the month printed on both ends", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-04-28",
        endDate: "2027-05-02",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("28 Apr–2 May 2027");
  });

  it("renders a single-day event as one date, not a range", async () => {
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-05-12",
        endDate: "2027-05-12",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("12 May 2027");
    expect(body).not.toContain("–");
  });

  it("renders the CFP closes line uppercase, no comma: 'CLOSES SUN 16 AUG · N DAYS LEFT'", async () => {
    // 2026-08-16 is a Sunday; timezone left as America/Los_Angeles (DEC-408
    // uses the event's own IANA zone) with a close instant safely inside
    // that calendar day in both UTC and Pacific time.
    const closeMs = Date.UTC(2026, 7, 16, 20, 0, 0);
    const events = [
      eventRow({
        id: "e1",
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toMatch(/CLOSES SUN 16 AUG · \d+ DAYS? LEFT/);
    expect(body).not.toMatch(/CLOSES SUN, 16 AUG/);
  });
});

describe("GET / — hero summary spells counts one through nine (mandate item 31e)", () => {
  it("spells a single open CFP as 'One'", async () => {
    const events = [
      eventRow({ id: "e1", startDate: "2027-05-12", endDate: "2027-05-14", openMs: null, closeMs: NOW + 6 * DAY }),
    ];
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("One call for papers is open.");
  });

  it("spells nine open CFPs as 'Nine'", async () => {
    const events = Array.from({ length: 9 }, (_, i) =>
      eventRow({
        id: `e${i}`,
        slug: `event-${i}`,
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    );
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("Nine calls for papers are open.");
  });

  it("renders ten open CFPs spelled out (DEC-925: the shared spellCount spells 0-10, not just 1-9)", async () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      eventRow({
        id: `e${i}`,
        slug: `event-${i}`,
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    );
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("Ten calls for papers are open.");
  });

  it("renders eleven open CFPs as the numeral '11' (falls back above ten)", async () => {
    const events = Array.from({ length: 11 }, (_, i) =>
      eventRow({
        id: `e${i}`,
        slug: `event-${i}`,
        startDate: "2027-05-12",
        endDate: "2027-05-14",
        openMs: null,
        closeMs: NOW + 6 * DAY,
      }),
    );
    const app = buildApp({ queue: buildQueue({ events }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("11 calls for papers are open.");
  });
});

describe("GET / — row meta: shape while live, size once past (DEC-943)", () => {
  it("an open-CFP row renders the shape line ('Three tracks · five formats'), not a session count", async () => {
    const events = [
      eventRow({ id: "e1", startDate: "2027-05-12", endDate: "2027-05-14", openMs: null, closeMs: NOW + 6 * DAY }),
    ];
    const app = buildApp({
      queue: buildQueue({
        events,
        countRows: [{ eventId: "e1", count: 12 }],
        trackCountRows: [{ eventId: "e1", count: 3 }],
        formatCountRows: [{ eventId: "e1", count: 5 }],
      }),
    });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("Three tracks · five formats");
    expect(body).not.toContain("12 sessions");
  });

  it("a published row renders 'N sessions · full programme up', not the shape line", async () => {
    const events = [
      eventRow({
        id: "e2",
        name: "DevFlow Workshops",
        slug: "devflow-workshops",
        startDate: "2027-10-09",
        endDate: "2027-10-10",
        openMs: null,
        closeMs: null,
      }),
    ];
    (events[0] as { closeDate: Date | null }).closeDate = new Date(NOW - 30 * DAY);
    const app = buildApp({
      queue: buildQueue({
        events,
        countRows: [{ eventId: "e2", count: 12 }],
        trackCountRows: [{ eventId: "e2", count: 1 }],
        formatCountRows: [{ eventId: "e2", count: 0 }],
      }),
    });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("12 sessions · full programme up");
    expect(body).not.toContain("One track");
    expect(body).not.toContain("formats");
  });

  it("an archive row renders 'N sessions · M tracks' (numeral sessions, spelled tracks)", async () => {
    const events = [
      eventRow({
        id: "e1",
        name: "DevFlow Conf 2026",
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        openMs: null,
        closeMs: null,
      }),
    ];
    const app = buildApp({
      queue: buildQueue({
        events,
        countRows: [{ eventId: "e1", count: 48 }],
        trackCountRows: [{ eventId: "e1", count: 3 }],
        formatCountRows: [{ eventId: "e1", count: 6 }],
      }),
    });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain("48 sessions · three tracks");
    // format count is never surfaced on the archive row.
    expect(body).not.toContain("formats");
  });

  it("an archive row with zero sessions and zero tracks renders no meta line at all", async () => {
    const events = [
      eventRow({
        id: "e1",
        name: "DevFlow Conf 2026",
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        openMs: null,
        closeMs: null,
      }),
    ];
    const app = buildApp({ queue: buildQueue({ events, countRows: [], trackCountRows: [], formatCountRows: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    // the stylesheet unconditionally defines .chq-home-meta -- what must
    // never render is the element itself.
    expect(body).not.toContain('class="chq-home-meta"');
  });
});

describe("GET / — footer/signin links carry no underline (mandate item 31f)", () => {
  it("declares text-decoration: none for .chq-home-signin and .chq-home-footer-link in the inlined stylesheet", async () => {
    const app = buildApp({ queue: buildQueue({ events: [] }) });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    const blocks = [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
    const css = blocks.map((m) => m[1]).join("\n");
    expect(css).toMatch(/\.chq-home-signin\s*\{[^}]*text-decoration:\s*none/);
    expect(css).toMatch(/\.chq-home-footer-link\s*\{[^}]*text-decoration:\s*none/);
  });
});
