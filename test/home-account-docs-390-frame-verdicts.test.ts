// w14-sg: per-frame 390 render verdicts for the last six SSR phone frames
// (DEC-976's wave-158 amendment: "the SSR half of the per-frame 390 render
// verdict -- a real Hono request through the mounted route, asserting the
// returned HTML string" -- see src/decisions-data/part4.ts's DEC_976
// constant, cited but not edited by this lane; DEC-976.md itself is owned
// by w14-sd this batch).
//
// Before this file, `test/home-phone-frames.test.ts` and
// `test/account-docs-phone-frames.test.ts` graded all six frames below by
// `grep -c 'app.request'` = 0 -- pure stylesheet-text scans that never
// dispatched a request. This file is a SEPARATE, ADDITIVE receipt: it does
// not replace or edit either of those files, it only mounts the real
// route, sends a real request, and asserts the returned HTML string
// against the frame's own anatomy.
//
// MEASUREMENT ONLY (task contract): this lane fixes nothing, and touches
// no route module and no .css.ts. Every harness below is copied, not
// re-authored, from an existing suite that already builds the same app
// (DEC-613 -- no new mock stack):
//   - Home's three states: test/home-hub.test.ts's fakeDb/fakeAssets/
//     eventRow/buildQueue/buildApp (mirrored in
//     test/public-home-state-actions.test.ts).
//   - Account's Sign-in card: test/account-signin-phone.test.ts's
//     buildApp shape (mount authRoutes over a fake db), with the SAME
//     queue-based fake db this file already builds for Home below --
//     loadSingleEventContext (src/routes/auth-helpers.ts) issues the
//     identical five-select getHubOrg+listHubEvents sequence root.tsx
//     issues, so no second fake-db shape is authored (DEC-613).
//     account-signin-phone.test.ts's own fakeDbNoDemoNoOrg always resolves
//     org to `[]`, which is the WRONG branch for :121 (it draws a named
//     event's subtitle and both "No account?" links, neither of which
//     render with no org) -- not reused here for that reason.
//   - Account's Change-password card: test/account-password.test.ts's
//     fake-db-with-real-drizzle-eq() harness (makeFakeDb/seedUser/
//     buildApp/login/sessionCookieFrom), reused verbatim to reach an
//     authenticated GET /account/password.
//   - Docs: test/docs-site.test.ts's buildApp (docsRoutes +
//     docsSiteRoutes, home-repo mocked out).
//
// RECEIPT RULE: every `docs/design/<file>.dc.html:<line>` citation is
// followed, in the same comment, by a backtick-quoted literal copied
// verbatim from that line, with a real `expect(` within 6 lines beneath
// whose subject is rendered PRODUCT bytes (never a re-read of the frame
// file itself).
//
// HOME VERDICTS (filed here per DEC-976 wave-105's note that Home carries
// no audit doc -- docs/design/audit/ has no home-v12.md):
//   1. "Event hub · phone" (Chautauqua Home.dc.html:113, GET / with an
//      open-CFP + published event) -- MATCHES. Hero h1, both action
//      sections (Submit a talk / Browse sessions), the archive section's
//      "Sessions ›" link, and the footer's "API docs" link all render.
//   2. "Between cycles · phone" (Chautauqua Home.dc.html:228, GET / with
//      only a past event) -- DIVERGES, and the divergence is ALREADY
//      FLAGGED in root.tsx's own Footer() comment (:271-278): the frame's
//      between-cycles footer draws the same right-hand "API docs" link
//      the full-hub frame draws (:261 quotes the identical anchor markup),
//      but root.tsx's `Footer` only renders `.chq-home-footer-link-end`
//      when `state === "full"` -- pinned by
//      test/public-home-state-actions.test.ts's "renders on the full hub
//      only" test, so this is a known, sourced gap, not a new finding.
//   3. "Fresh deploy · phone" (Chautauqua Home.dc.html:299, GET / with no
//      events) -- MATCHES. "Nothing here yet" hero, primary Sign in +
//      tertiary "API docs ›" action row, and (per the SAME state-gated
//      Footer) no footer API docs link -- the fresh frame's own footer
//      omits it too (:318 has no right-hand anchor), so this state's
//      omission is not a divergence.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { docsRoutes } from "../src/routes/docs";
import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader } from "../src/server/middleware";
import { hashPassword } from "../src/auth/password";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import * as schema from "../src/db/schema";

// -----------------------------------------------------------------------
// Home harness -- copied from test/home-hub.test.ts / test/public-home-
// state-actions.test.ts (same fakeDb/fakeAssets/eventRow/buildQueue/
// buildApp shape, duplicated in both those files already; this is the
// third instance of the same idiom, not a new one).
// -----------------------------------------------------------------------

function homeFakeDb(resultQueue: unknown[][]): Db {
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
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function fakeAssets(): Fetcher {
  return {
    async fetch() {
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

const ORG = { id: "org1", name: "DevFlow Conf 2027 Org" };

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
    startDate: "2027-10-09",
    endDate: "2027-10-10",
    location: "Fort Mason, San Francisco",
    timezone: "America/Los_Angeles",
    ...rest,
    openDate: openMs === null ? null : new Date(openMs),
    closeDate: closeMs === null ? null : new Date(closeMs),
  };
}

function homeBuildQueue(opts: {
  events: ReturnType<typeof eventRow>[];
  countRows?: { eventId: string; count: number }[];
}): unknown[][] {
  const hasEvents = opts.events.length > 0;
  const countRows = hasEvents ? (opts.countRows ?? []) : [];
  return [[ORG], opts.events, countRows, [], []];
}

function homeBuildApp(queue: unknown[][]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", homeFakeDb(queue));
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

describe("Home — GET / (SSR, three states)", () => {
  it(
    // Chautauqua Home.dc.html:124 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.042em; line-height:1.05">Events</h1>` --
    // 'Event hub · phone' (:113). MATCHES.
    "'Event hub · phone' (:113) MATCHES -- Events hero, both action sections, archive Sessions link, footer API docs link",
    async () => {
      const dayLabel = (offsetDays: number) => Math.floor(Date.now() / 86_400_000 + offsetDays) * 86_400_000;
      const events = [
        eventRow({ id: "e1", slug: "open-cfp-event", openMs: dayLabel(-2), closeMs: dayLabel(30) }),
        eventRow({ id: "e2", slug: "published-event", closeMs: dayLabel(-30) }),
      ];
      const app = homeBuildApp(homeBuildQueue({ events, countRows: [{ eventId: "e2", count: 5 }] }));
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<h1>Events</h1>");
      // Chautauqua Home.dc.html:137 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; margin-top:2px">Submit a talk</span>` -- the open-CFP row's primary action.
      expect(body).toContain('class="chq-home-action-primary" href="/submit/open-cfp-event"');
      // Chautauqua Home.dc.html:150 `<span style="border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#2E2A24; margin-top:2px">Browse sessions</span>` -- the published row's secondary action.
      expect(body).toContain('class="chq-home-action-secondary" href="/e/published-event/sessions"');
      // Chautauqua Home.dc.html:173 `<a href="#" style="margin-left:auto; font-size:12px; font-weight:700; min-height:44px; display:flex; align-items:center">API docs</a>` -- footer right-hand link, full state only.
      const footer = body.split("<footer")[1]?.split("</footer>")[0] ?? "";
      expect(footer).toMatch(/href="\/docs\/api"[^>]*>\s*API docs\s*<\/a>/);
    },
  );

  it(
    // Chautauqua Home.dc.html:239 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:29px; font-weight:700; letter-spacing:-0.042em; line-height:1.07">No open calls right now</h1>` --
    // 'Between cycles · phone' (:228). DIVERGES, already flagged (root.tsx :271-278) -- footer API docs link is frame-drawn but code-omitted for this state.
    "'Between cycles · phone' (:228) DIVERGES on the footer -- frame draws the API docs link, code omits it for this state (already flagged, root.tsx:271-278)",
    async () => {
      const events = [
        eventRow({
          id: "e1",
          startDate: "2020-01-01",
          endDate: "2020-01-02",
          closeMs: Math.floor(Date.now() / 86_400_000 - 2) * 86_400_000,
        }),
      ];
      const app = homeBuildApp(homeBuildQueue({ events, countRows: [{ eventId: "e1", count: 1 }] }));
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<h1>No open calls right now</h1>");
      // Chautauqua Home.dc.html:261 `<a href="#" style="margin-left:auto; font-size:12px; font-weight:700; min-height:44px; display:flex; align-items:center">API docs</a>` -- the frame draws this SAME anchor on the between-cycles footer as on the full-hub footer.
      const footer = body.split("<footer")[1]?.split("</footer>")[0] ?? "";
      expect(footer).not.toMatch(/href="\/docs\/api"/); // real render omits it -- the divergence.
    },
  );

  it(
    // Chautauqua Home.dc.html:310 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:29px; font-weight:700; letter-spacing:-0.042em; line-height:1.07">Nothing here yet</h1>` --
    // 'Fresh deploy · phone' (:299). MATCHES.
    "'Fresh deploy · phone' (:299) MATCHES -- Nothing-here-yet hero, primary Sign in + tertiary API docs row, no footer API docs link",
    async () => {
      const app = homeBuildApp(homeBuildQueue({ events: [] }));
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<h1>Nothing here yet</h1>");
      // Chautauqua Home.dc.html:314 `<a href="#" style="font-size:14px; font-weight:700; min-height:44px; display:flex; align-items:center">API docs ›</a>` -- the hero's own tertiary link.
      const signinRow = body.split('class="chq-home-signin-row"')[1]?.split("</main>")[0] ?? "";
      expect(signinRow).toContain('class="chq-home-action-tertiary" href="/docs/api">API docs ›</a>');
      const footer = body.split("<footer")[1]?.split("</footer>")[0] ?? "";
      expect(footer).not.toMatch(/href="\/docs\/api"/);
    },
  );
});

// -----------------------------------------------------------------------
// Account harness -- Sign in card. loadSingleEventContext (src/routes/
// auth-helpers.ts) calls the SAME getHubOrg + listHubEvents pair root.tsx
// calls, in the same five-select order (org, events, publishedSession
// countRows, trackCountRows, formatCountRows) -- so the Home harness's
// queue-based homeFakeDb/homeBuildQueue above is reused as-is (it resolves
// purely by call ORDER, never by table identity, so it needs no Account-
// specific branch) rather than authored a second time, mirroring test/
// account-signin-phone.test.ts's buildApp shape with rootRoutes's fake db
// swapped in for authRoutes.
// -----------------------------------------------------------------------

// GET /login calls loadDemoIdentitiesIfPresent BEFORE
// loadSingleEventContext (src/routes/auth-login.tsx:49-50), and that helper
// issues one `select().from(schema.user).where(...).limit(1)` per
// DEMO_IDENTITIES entry (src/server/repo/demo.ts's demoIdentitiesPresent) --
// three queue slots consumed ahead of getHubOrg/listHubEvents if left
// unhandled. This wrapper special-cases `.from(schema.user)` to resolve
// empty immediately (no demo identities seeded, matching every other
// login-door fixture in this file's sibling suites), so the underlying
// homeFakeDb queue starts exactly at getHubOrg's first select, unchanged.
function loginFakeDb(queue: unknown[][]): Db {
  const inner = homeFakeDb(queue);
  return {
    select: (fields?: unknown) => {
      const chain: any = {
        from: (table: unknown) => {
          if (table === schema.user) {
            return { where: () => ({ limit: async () => [] }) };
          }
          return (inner.select(fields as never) as any).from(table);
        },
      };
      return chain;
    },
  } as unknown as Db;
}

function accountSigninBuildApp(queue: unknown[][]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", loginFakeDb(queue));
    await next();
  });
  app.route("/", authRoutes);
  registerErrorHandler(app);
  return app;
}

function singleEventQueue(): unknown[][] {
  const events = [
    eventRow({
      id: "e1",
      slug: "devflow-conf-2027",
      openMs: Math.floor(Date.now() / 86_400_000 - 2) * 86_400_000,
      closeMs: Math.floor(Date.now() / 86_400_000 + 30) * 86_400_000,
    }),
  ];
  return homeBuildQueue({ events, countRows: [{ eventId: "e1", count: 5 }] });
}

describe("Account — GET /login ('Sign in · 390', Chautauqua Account.dc.html:121)", () => {
  it(
    // Chautauqua Account.dc.html:125 `<span style="font-size:14px; color:#565A4B">Sign in to DevFlow Conf 2027</span>` --
    // the single-event-scoped subtitle. MATCHES.
    "wordmark, event-scoped subtitle, Email/Password, Sign in, and both 'No account?' links MATCH the frame's drawn anatomy",
    async () => {
      const app = accountSigninBuildApp(singleEventQueue());
      const res = await app.request("/login");
      expect(res.status).toBe(200);
      const html = await res.text();
      // Chautauqua Account.dc.html:124 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">chautauqua</span>`
      expect(html).toContain('class="chq-auth-wordmark">chautauqua<');
      expect(html).toContain('class="chq-auth-subtitle">Sign in to DevFlow Conf 2027<');
      // Chautauqua Account.dc.html:137 `<a href="#" style="font-size:15px; font-weight:700; min-height:44px; display:flex; align-items:center">Submit a talk ›</a>`
      expect(html).toContain('href="/submit/devflow-conf-2027">Submit a talk');
      // Chautauqua Account.dc.html:138 `<a href="#" style="font-size:15px; font-weight:700; min-height:44px; display:flex; align-items:center">Browse the sessions ›</a>`
      expect(html).toContain('href="/e/devflow-conf-2027/sessions">Browse the sessions');
    },
  );

  it(
    // Chautauqua Account.dc.html:121 (the whole 390 sign-in card) draws NO
    // tertiary "Forgot your password?" link anywhere in the submit row --
    // grepped absent from :121-141 (confirmed against the file: the only
    // "Forgot your password?" text on this file sits at :50 and :317, both
    // in DESKTOP/error-state blocks, never inside the 390 card). The real
    // route renders it unconditionally (src/routes/auth-views.tsx:125-127)
    // -- a DIVERGENCE from :121's drawn anatomy, but a BLESSED one: DEC-919
    // (see src/decisions-data/part4.ts's DEC_919 constant's underlying .md,
    // "Amendment (wave 116)") RULED the link stays, re-lined beneath the
    // primary, because a 390 mockup drawing one large 'Sign in' shows a
    // submit row's proportions, not a mandate to delete the only phone
    // password-reset entry point.
    "DIVERGES from :121's drawn anatomy on the Forgot-password link -- BLESSED by DEC-919 (re-line, never remove)",
    async () => {
      const app = accountSigninBuildApp(singleEventQueue());
      const res = await app.request("/login");
      const html = await res.text();
      expect(html).toContain('class="chq-auth-tertiary" href="/forgot"');
      expect(html).toContain("Forgot your password?");
    },
  );

  // Watch item (task brief): the login door's status line is real and
  // correct at src/routes/auth-helpers.ts:168
  // (`if (params.get("signed-out") === "1") return "You have been signed
  // out.";`) -- but the :121 frame draws NO status line at all (no
  // .chq-auth-status element anywhere in its markup), so it is graded
  // against the bare GET /login above (MATCHES/DIVERGES as filed there).
  // This assertion verdicts the ?signed-out=1 REQUEST on its own terms,
  // separately from the frame (which is silent on this dynamic state) --
  // confirming the watch item's citation is accurate in the tree.
  it("GET /login?signed-out=1 renders 'You have been signed out.' (auth-helpers.ts:168, verified, not re-derived)", async () => {
    const app = accountSigninBuildApp(singleEventQueue());
    const res = await app.request("/login?signed-out=1");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-auth-status">You have been signed out.<');
  });
});

// -----------------------------------------------------------------------
// Account harness -- Change-password card, copied verbatim (fake-db-with-
// real-drizzle-eq(), seedUser, buildApp, login, sessionCookieFrom) from
// test/account-password.test.ts, trimmed to only what GET /account/
// password needs (no rate-limit/session-revocation machinery).
// -----------------------------------------------------------------------

function buildTableMap(table: Record<string, unknown>, tableRef: unknown, into: Map<unknown, unknown>) {
  for (const col of Object.values(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) into.set(col, tableRef);
  }
  return into;
}

function buildColumnMap(table: Record<string, unknown>): Map<unknown, string> {
  const map = new Map<unknown, string>();
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) {
      map.set(col, key);
    }
  }
  return map;
}

const COLUMN_KEYS = new Map<unknown, string>([
  ...buildColumnMap(schema.user as unknown as Record<string, unknown>),
  ...buildColumnMap(schema.authSession as unknown as Record<string, unknown>),
  ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
]);

const COLUMN_TABLES = new Map<unknown, unknown>();
for (const t of [schema.user, schema.authSession, schema.rateLimit]) {
  buildTableMap(t as unknown as Record<string, unknown>, t, COLUMN_TABLES);
}

function colKey(col: unknown): string {
  const key = COLUMN_KEYS.get(col);
  if (!key) throw new Error("unmapped column in fake db test helper");
  return key;
}

type Row = Record<string, unknown>;
const JOINED = Symbol("joined");
type JoinedRow = { [JOINED]: Map<unknown, Row> };

function isJoined(row: Row | JoinedRow): row is JoinedRow {
  return JOINED in row;
}

function valueOf(row: Row | JoinedRow, col: unknown): unknown {
  if (isJoined(row)) {
    const side = row[JOINED].get(COLUMN_TABLES.get(col));
    return side ? side[colKey(col)] : undefined;
  }
  return (row as Row)[colKey(col)];
}

function chunkLiteral(chunk: unknown): string | null {
  if (chunk && typeof chunk === "object" && "value" in (chunk as object)) {
    const v = (chunk as { value: unknown }).value;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return null;
}

function matches(cond: unknown, row: Row | JoinedRow): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  if (chunkLiteral(chunks[0]) === "(") {
    const inner = (chunks[1] as { queryChunks: unknown[] }).queryChunks;
    const results: boolean[] = [];
    let joiner: "and" | "or" = "and";
    for (const part of inner) {
      const literal = chunkLiteral(part);
      if (literal === " and ") {
        joiner = "and";
        continue;
      }
      if (literal === " or ") {
        joiner = "or";
        continue;
      }
      results.push(matches(part, row));
    }
    return joiner === "and" ? results.every(Boolean) : results.some(Boolean);
  }
  const column = chunks[1];
  const operator = chunkLiteral(chunks[2]) ?? " = ";
  const rawValue = chunks[3];
  const value = COLUMN_TABLES.has(rawValue)
    ? valueOf(row, rawValue)
    : rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
      ? (rawValue as { value: unknown }).value
      : rawValue;
  const actual = valueOf(row, column);
  if (operator === " <= ") return (actual as number | string | Date) <= (value as number | string | Date);
  if (operator === " >= ") return (actual as number | string | Date) >= (value as number | string | Date);
  return actual === value;
}

function project(row: Row | JoinedRow, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...(row as Row) };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = valueOf(row, col);
  return out;
}

function makePasswordFakeDb() {
  const state: { users: Row[]; sessions: Row[]; rateLimits: Row[] } = { users: [], sessions: [], rateLimits: [] };
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    if (table === schema.authSession) return state.sessions;
    if (table === schema.rateLimit) return state.rateLimits;
    if (table === schema.org) return [];
    throw new Error("unexpected table in fake db test helper");
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const limitFrom = (matched: (Row | JoinedRow)[]) => ({
            limit(n: number) {
              return Promise.resolve(matched.slice(0, n).map((r) => project(r, fields)));
            },
          });
          return {
            where(cond: unknown) {
              return limitFrom(rowsFor(table).filter((r) => matches(cond, r)));
            },
            orderBy() {
              return limitFrom(rowsFor(table));
            },
            innerJoin(joinTable: unknown, on: unknown) {
              const joined: JoinedRow[] = [];
              for (const left of rowsFor(table)) {
                for (const right of rowsFor(joinTable)) {
                  const row: JoinedRow = { [JOINED]: new Map([[table, left], [joinTable, right]]) };
                  if (matches(on, row)) joined.push(row);
                }
              }
              return { where: (cond: unknown) => limitFrom(joined.filter((r) => matches(cond, r))) };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
          // DEC-948: checkAndIncrementScopedLimit's atomic upsert against
          // rate_limit (POST /login always runs it, GET never does) --
          // copied from test/account-password.test.ts's identical branch.
          if (table === schema.rateLimit) {
            const existing = state.rateLimits.find((r) => r.key === row.key);
            return {
              onConflictDoUpdate: () => ({
                returning: async () => {
                  if (existing) {
                    existing.count = (existing.count as number) + 1;
                    return [{ count: existing.count }];
                  }
                  const inserted = { ...row };
                  state.rateLimits.push(inserted);
                  return [{ count: inserted.count }];
                },
                then: (resolve: (v: undefined) => void) => {
                  if (existing) existing.count = (existing.count as number) + 1;
                  else state.rateLimits.push({ ...row });
                  resolve(undefined);
                },
              }),
            };
          }
          rowsFor(table).push({ ...row });
          return Promise.resolve();
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Row) {
          return {
            where(cond: unknown) {
              for (const r of rowsFor(table)) if (matches(cond, r)) Object.assign(r, patch);
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where(cond: unknown) {
          const rows = rowsFor(table);
          const remaining = rows.filter((r) => !matches(cond, r));
          rows.length = 0;
          rows.push(...remaining);
          return Promise.resolve();
        },
      };
    },
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], state };
}

class InMemoryKV {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const EMAIL = "speaker@example.test";
const PASSWORD = "old-password-123";

async function seedUser(state: { users: Row[] }) {
  const passwordHash = await hashPassword(PASSWORD);
  state.users.push({
    id: "u_1",
    orgId: "org_1",
    email: EMAIL,
    passwordHash,
    role: "organizer" as const,
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function passwordBuildApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", authRoutes);
  app.route("/", accountRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function loginForPasswordPage(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
  const loginPage = await app.request("/login", {}, env);
  const csrfSet = loginPage.headers.get("set-cookie") ?? "";
  const csrfMatch = csrfSet.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!csrfMatch) throw new Error("no csrf cookie on /login");
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrfMatch[1]!, email: EMAIL, password: PASSWORD });
  const res = await app.request(
    "/login",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: `${CSRF_COOKIE_NAME}=${csrfMatch[1]}` },
      body: form.toString(),
    },
    env,
  );
  const sessionSet = res.headers.get("set-cookie") ?? "";
  const sessionMatch = sessionSet.match(/chq_session=([^;]+)/);
  if (!sessionMatch) throw new Error("no chq_session cookie on response");
  return `chq_session=${sessionMatch[1]}`;
}

describe("Account — GET /account/password ('Change password · 390', Chautauqua Account.dc.html:153)", () => {
  it(
    // Chautauqua Account.dc.html:156 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Change your password</h1>` --
    // 'Change password · 390' (:153). MATCHES.
    "'‹ Back' link, H1, all three fields, and the sunk dock's two buttons MATCH the frame's drawn anatomy",
    async () => {
      const { db, state } = makePasswordFakeDb();
      await seedUser(state);
      const { app, env } = passwordBuildApp(db);
      const sessionCookie = await loginForPasswordPage(app, env);
      const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
      expect(res.status).toBe(200);
      const html = await res.text();
      // Chautauqua Account.dc.html:155 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Back</a>`
      expect(html).toContain('class="chq-auth-back" href="/admin">');
      expect(html).toContain("‹ Back");
      expect(html).toContain('class="chq-auth-title">Change your password<');
      // Chautauqua Account.dc.html:160 `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Current password</span>`
      expect(html).toContain('class="chq-auth-label">Current password<');
      // Chautauqua Account.dc.html:165 `<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:50px; display:flex; align-items:center; padding:0 13px; font-size:16px; color:#565A4B">At least 12 characters</div>`
      expect(html).toContain('placeholder="At least 12 characters"');
      // Chautauqua Account.dc.html:168 `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">New password again</span>`
      expect(html).toContain('class="chq-auth-label">New password again<');
      // Chautauqua Account.dc.html:173 `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Change it</span>`
      expect(html).toMatch(/class="chq-btn chq-btn-primary">\s*Change it\s*<\/button>/);
      // Chautauqua Account.dc.html:174 `<span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Cancel</span>`
      expect(html).toMatch(/class="chq-btn chq-btn-secondary chq-auth-cancel"\s+href="\/admin">\s*Cancel\s*<\/a>/);
    },
  );

  it("adds one element the :153 dock is silent on -- a 'You stay signed in on this device' hint span, not itself a frame divergence (frame draws no hint at all, so it neither confirms nor forbids it)", async () => {
    const { db, state } = makePasswordFakeDb();
    await seedUser(state);
    const { app, env } = passwordBuildApp(db);
    const sessionCookie = await loginForPasswordPage(app, env);
    const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
    const html = await res.text();
    expect(html).toContain('class="chq-auth-hint">You stay signed in on this device<');
  });
});

// -----------------------------------------------------------------------
// Docs harness -- copied verbatim from test/docs-site.test.ts's buildApp
// (docsRoutes + docsSiteRoutes, public/home repo mocked to avoid touching
// D1, same as that file's own top-of-file vi.mock).
// -----------------------------------------------------------------------

function docsBuildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsRoutes);
  app.route("/", docsSiteRoutes);
  return app;
}

describe("Docs — GET /docs/:slug ('Docs · an article', Chautauqua Docs.dc.html:166)", () => {
  it(
    // Chautauqua Docs.dc.html:168 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Docs</a>` --
    // the phone toolbar's back link. MATCHES (src/routes/docs-site.tsx's
    // DEC-990 wave-128 comment already cites :167-169 for this exact bar).
    "phone toolbar ('‹ Docs' + 'Contents'), article eyebrow/H1/standfirst, and a heading block all MATCH the frame's drawn anatomy",
    async () => {
      const article = DOCS_ARTICLES.find((a) => a.slug === "reviewing-start-to-finish");
      expect(article).toBeDefined();
      const app = docsBuildApp();
      const res = await app.request(`/docs/${article!.slug}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('class="chq-docs-phone-back" href="/docs">');
      expect(html).toContain("‹ Docs");
      // Chautauqua Docs.dc.html:169 `<span style="margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">Contents</span>`
      expect(html).toMatch(/class="chq-docs-contents-toggle"[^>]*>\s*Contents\s*<\/label>/);
      // Chautauqua Docs.dc.html:173 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1.08">Triaging submissions</h1>` --
      // the frame's H1 text is illustrative mockup prose (no "Triaging
      // submissions" slug exists in DOCS_ARTICLES); the STRUCTURE it
      // draws (eyebrow span, <h1>, standfirst <p>) is what is graded.
      expect(html).toContain(`<h1>${article!.title}</h1>`);
      expect(html).toContain('class="chq-docs-article-eyebrow">');
      const headingBlock = article!.blocks.find((b) => b.kind === "heading") as { text: string } | undefined;
      expect(headingBlock).toBeDefined();
      // Chautauqua Docs.dc.html:186 `<h2 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em">Working through the queue</h2>`
      expect(html).toContain(`class="chq-docs-h2">${headingBlock!.text}</h2>`);
    },
  );
});
