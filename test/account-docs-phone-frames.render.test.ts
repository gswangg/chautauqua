// Task w28-f (DEC-976 wave-28): REQUEST verdicts for the three remaining
// v12 390 phone frames drawn across docs/design/Chautauqua Account.dc.html
// and docs/design/Chautauqua Docs.dc.html -- "Sign in · 390", "Change
// password · 390", and "Docs · an article · 390". test/account-docs-
// phone-frames.test.ts (companion, untouched by this task) already pins
// these three frames' CSS-TEXT (source-scans of auth.css.ts / docs-
// site.css.ts) but issues zero requests, so nothing in that file can see
// whether the drawn MARKUP -- the H1, the drawn back link, the drawn
// control labels -- actually renders. This file issues real requests
// (mirroring test/account-password-phone.test.ts's own buildApp/fakeDb
// harness for the auth routes, and a bare Hono mount for the docs routes,
// which read no db at all -- DEC-613: reuse the existing request
// vocabulary, no third harness) and asserts against the response body.
//
// Frame population derived per the task's own grammar: a label line is
// font-size:19px + `>TITLE</`, its extent runs to the next label line, and
// it is a phone frame iff the extent contains both width:390px and
// height:844. That yields exactly two phone frames in Chautauqua
// Account.dc.html -- "Sign in · 390" (:118, extent [121,150)) and "Change
// password · 390" (:150, extent [153,182)) -- and exactly one in
// Chautauqua Docs.dc.html -- "Docs · an article" (:162, extent [166,210)).
// (Chautauqua Account.dc.html's other :28/:69/:101/:182/:209/:235/:266/:290
// labels and Chautauqua Docs.dc.html's :28/:119/:210/:226 labels either
// have no width:390px sibling in their extent -- desktop/1600 frames -- or
// are non-frame section headings, so none of them qualifies.)
//
// The Docs article's H1 and pager labels are dynamic per-article content;
// the frame's own "Triaging submissions"/"‹ Previous"/"Next ›" literals are
// placeholder copy for a fictional article, not a fixed vocabulary string
// the app ships (mirrors the Home hub's fictional "DevFlow Workshops" event
// name). This file therefore asserts the STRUCTURE the frame draws --
// exactly one <h1> whose text is the requested article's own real title,
// and a pager whose prev/next anchors carry the real neighbouring
// articles' titles -- against a real seeded article/neighbour pair, rather
// than a literal string match on the frame's placeholder text. Recorded as
// a MATCHES (structural) row in docs/design/audit/account-docs-v12.md, not
// a divergence.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { authRoutes } from "../src/routes/auth";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";

const REPO_ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------
// "Sign in · 390" (frame extent 121-149 of Chautauqua Account.dc.html) --
// GET /login. Queue mirrors src/routes/auth-login.tsx's own call order:
// loadDemoIdentitiesIfPresent (one point-lookup select, empty here so it
// short-circuits false with no further lookups) THEN loadSingleEventContext
// (getHubOrg + listHubEvents' org/events/count/track-count/format-count
// selects) -- the SAME queue shape test/public-home-phone.test.ts's
// buildQueue uses for listHubEvents, reused rather than re-derived.
// ---------------------------------------------------------------------

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
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function buildAuthApp(queue: unknown[][]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb(queue));
    await next();
  });
  app.route("/", authRoutes);
  registerErrorHandler(app);
  return app;
}

async function renderLogin(): Promise<string> {
  const now = Date.now();
  const dayLabel = (offsetDays: number) => Math.floor(now / 86_400_000 + offsetDays) * 86_400_000;
  const org = { id: "org1", name: "Chautauqua Demo Org" };
  const event = {
    id: "e1",
    name: "DevFlow Conf 2027",
    slug: "devflow-conf-2027",
    startDate: "2027-10-09",
    endDate: "2027-10-10",
    location: "Fort Mason, San Francisco",
    timezone: "America/Los_Angeles",
    openDate: new Date(dayLabel(-2)),
    closeDate: new Date(dayLabel(30)),
  };
  // demoIdentitiesPresent: one select per DEMO_IDENTITIES email, short-
  // circuits false on the first empty result -- queue only needs one [].
  const queue: unknown[][] = [
    [], // demoIdentitiesPresent's first lookup: no row, so demoIdentities = []
    [org], // getHubOrg
    [event], // listHubEvents' event rows
    [{ eventId: "e1", count: 5 }], // publishedSessionCount (submission count) -> hasPublished
    [], // trackCountRows
    [], // formatCountRows
  ];
  const app = buildAuthApp(queue);
  const res = await app.request("/login", {});
  expect(res.status).toBe(200);
  return res.text();
}

function h1sOf(body: string): string[] {
  return [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1]!.trim());
}

describe("v12 phone frame 'Sign in · 390' (docs/design/Chautauqua Account.dc.html:121-149) -- REQUEST verdict", () => {
  it("docs/design/Chautauqua Account.dc.html:124 `<span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1\">chautauqua</span>` -- exactly one <h1>, text 'chautauqua' (the wordmark is the frame's own H1-styled headline)", async () => {
    const body = await renderLogin();
    const h1s = h1sOf(body);
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toBe("chautauqua");
  });

  it("docs/design/Chautauqua Account.dc.html:121 `<div style=\"flex:1; min-height:0; overflow-y:auto; padding:28px 20px 20px; display:flex; flex-direction:column; gap:22px\">` -- no back link and no dock band: the frame's own card draws neither (it is the top of the anonymous surface, not a drill-in)", async () => {
    const body = await renderLogin();
    expect(body).not.toContain("data-chq-phone-dock");
    expect(body).not.toContain("&lsaquo; Back");
  });

  it("docs/design/Chautauqua Account.dc.html:136 `<span style=\"background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:50px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700\">Sign in</span>` -- the submit control's own label 'Sign in' present", async () => {
    const body = await renderLogin();
    expect(body).toMatch(/<button[^>]*>\s*Sign in\s*<\/button>/);
  });

  it("docs/design/Chautauqua Account.dc.html:140 `<a href=\"#\" style=\"font-size:15px; font-weight:700; min-height:44px; display:flex; align-items:center\">Submit a talk ›</a>` -- 'Submit a talk ›' present (single visible event, CFP open)", async () => {
    const body = await renderLogin();
    expect(body).toContain("Submit a talk");
  });

  it("docs/design/Chautauqua Account.dc.html:141 `<a href=\"#\" style=\"font-size:15px; font-weight:700; min-height:44px; display:flex; align-items:center\">Browse the sessions ›</a>` -- 'Browse the sessions ›' present (single visible event, sessions published)", async () => {
    const body = await renderLogin();
    expect(body).toContain("Browse the sessions");
  });
});

// ---------------------------------------------------------------------
// "Change password · 390" (frame extent 153-181 of Chautauqua Account.dc.html)
// -- GET /account/password, reusing test/account-password-phone.test.ts's
// own login+session harness so the request carries a real session cookie
// (the route redirects anonymous callers to /login).
// ---------------------------------------------------------------------

function buildColumnMap(table: Record<string, unknown>): Map<unknown, string> {
  const map = new Map<unknown, string>();
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) {
      map.set(col, key);
    }
  }
  return map;
}

async function renderChangePassword(): Promise<string> {
  const schema = await import("../src/db/schema");
  const { sessionLoader } = await import("../src/server/middleware");
  const { accountRoutes } = await import("../src/routes/account");
  const { authRoutes: authRoutesForSession } = await import("../src/routes/auth");
  const { hashPassword } = await import("../src/auth/password");
  const { CSRF_COOKIE_NAME } = await import("../src/auth/cookies");

  const COLUMN_KEYS = new Map<unknown, string>([
    ...buildColumnMap(schema.user as unknown as Record<string, unknown>),
    ...buildColumnMap(schema.authSession as unknown as Record<string, unknown>),
    ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
  ]);
  function colKey(col: unknown): string {
    const key = COLUMN_KEYS.get(col);
    if (!key) throw new Error("unmapped column in fake db test helper");
    return key;
  }
  const COLUMN_TABLES = new Map<unknown, unknown>();
  for (const t of [schema.user, schema.authSession, schema.rateLimit]) {
    for (const col of Object.values(t as unknown as Record<string, unknown>)) {
      if (col && typeof col === "object" && "name" in (col as object)) COLUMN_TABLES.set(col, t);
    }
  }
  const JOINED = Symbol("joined");
  type Row = Record<string, unknown>;
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
  function makeFakeDb() {
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

  const EMAIL = "phone-render@example.test";
  const PASSWORD = "old-password-render-123";

  const { db, state } = makeFakeDb();
  const passwordHash = await hashPassword(PASSWORD);
  state.users.push({
    id: "u_1",
    orgId: "org_1",
    email: EMAIL,
    passwordHash,
    role: "organizer",
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as Db);
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", authRoutesForSession);
  app.route("/", accountRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };

  const loginGet = await app.request("/login", {}, env);
  const setCookie = loginGet.headers.get("set-cookie") ?? "";
  const csrfMatch = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!csrfMatch) throw new Error("no csrf cookie on /login");
  const cookie = `${CSRF_COOKIE_NAME}=${csrfMatch[1]}`;
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrfMatch[1]!, email: EMAIL, password: PASSWORD });
  const loginRes = await app.request(
    "/login",
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
    env,
  );
  const loginSetCookie = loginRes.headers.get("set-cookie") ?? "";
  const sessionMatch = loginSetCookie.match(/chq_session=([^;]+)/);
  if (!sessionMatch) throw new Error("no chq_session cookie on login response");
  const sessionCookie = `chq_session=${sessionMatch[1]}`;

  const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
  expect(res.status).toBe(200);
  return res.text();
}

describe("v12 phone frame 'Change password · 390' (docs/design/Chautauqua Account.dc.html:153-181) -- REQUEST verdict", () => {
  it("docs/design/Chautauqua Account.dc.html:156 `<h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05\">Change your password</h1>` -- exactly one <h1>, text 'Change your password'", async () => {
    const body = await renderChangePassword();
    const h1s = h1sOf(body);
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toBe("Change your password");
  });

  it("docs/design/Chautauqua Account.dc.html:155 `<a href=\"#\" style=\"font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">‹ Back</a>` -- the drawn back link is present, no dock band (this footer is the frame's own action bar, not the shell's tab-bar-suppressing dock)", async () => {
    const body = await renderChangePassword();
    expect(body).toContain("‹ Back");
    expect(body).not.toContain("data-chq-phone-dock");
  });

  it("docs/design/Chautauqua Account.dc.html:173 `<span style=\"flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700\">Change it</span>` -- footer 'Change it' control present", async () => {
    const body = await renderChangePassword();
    expect(body).toMatch(/<button[^>]*>\s*Change it\s*<\/button>/);
  });

  it("docs/design/Chautauqua Account.dc.html:174 `<span style=\"border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600\">Cancel</span>` -- footer 'Cancel' control present, pointed at the organizer's back-href", async () => {
    const body = await renderChangePassword();
    expect(body).toContain('class="chq-btn chq-btn-secondary chq-auth-cancel" href="/admin"');
    expect(body).toContain(">Cancel<");
  });
});

// ---------------------------------------------------------------------
// "Docs · an article · 390" (frame extent 166-209 of Chautauqua Docs.dc.html)
// -- GET /docs/:slug. The docs routes read no db, so a bare Hono mount is
// enough (no fake db needed).
// ---------------------------------------------------------------------

function buildDocsApp() {
  const app = new Hono<AppEnv>();
  app.route("/", docsSiteRoutes);
  registerErrorHandler(app);
  return app;
}

// "call-for-papers-and-submissions" is DOCS_ARTICLES[1]: it has both a real
// prev (start-here) and a real next (speakers-tasks-and-content) neighbour,
// and its own blocks include a `kind: "figure"` block -- matching the
// frame's own H1 + figure + pager membership without needing a synthetic
// article fixture.
const ARTICLE = DOCS_ARTICLES[1]!;
if (ARTICLE.slug !== "call-for-papers-and-submissions") {
  throw new Error(
    `expected DOCS_ARTICLES[1] to be call-for-papers-and-submissions (has both prev+next neighbours and a figure block), got '${ARTICLE.slug}' -- DOCS_ARTICLES order changed, pick a different seeded article`,
  );
}
const DOCS_NAV_TS = readFileSync(join(REPO_ROOT, "src/routes/docs-content/nav.ts"), "utf-8");
void DOCS_NAV_TS; // referenced only to keep this file's own import graph honest under future refactors

async function renderArticle(): Promise<string> {
  const app = buildDocsApp();
  const res = await app.request(`/docs/${ARTICLE.slug}`, {});
  expect(res.status).toBe(200);
  return res.text();
}

describe("v12 phone frame 'Docs · an article · 390' (docs/design/Chautauqua Docs.dc.html:166-209) -- REQUEST verdict", () => {
  it("docs/design/Chautauqua Docs.dc.html:174 `<h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1.08\">Triaging submissions</h1>` -- exactly one <h1> (the frame's placeholder title is fictional; the app's own is asserted verbatim)", async () => {
    const body = await renderArticle();
    const h1s = h1sOf(body);
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toBe(ARTICLE.title);
  });

  it("docs/design/Chautauqua Docs.dc.html:168 `<a href=\"#\" style=\"font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">‹ Docs</a>` -- the drawn back link '‹ Docs' is present, no dock band (this is a page-owned toolbar, not the shell's tab-bar-suppressing dock)", async () => {
    const body = await renderArticle();
    expect(body).toContain("‹ Docs");
    expect(body).not.toContain("data-chq-phone-dock");
  });

  it("docs/design/Chautauqua Docs.dc.html:169 `<span style=\"margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">Contents</span>` -- the drawn 'Contents' disclosure toggle is present", async () => {
    const body = await renderArticle();
    expect(body).toContain(">Contents<");
  });

  it('docs/design/Chautauqua Docs.dc.html:166 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">` -- the frame\'s figure block renders (screenshot-frame class present)', async () => {
    const body = await renderArticle();
    expect(body).toContain('class="chq-docs-figure"');
  });

  it("docs/design/Chautauqua Docs.dc.html:201 `<span style=\"flex:1; border:1px solid #CFC7B7; border-radius:6px; background:#F4F1E8; color:#2E2A24; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600\">‹ Previous</span>` -- the pager's prev control is present, carrying the real neighbour's own title (the frame's 'Previous' is placeholder copy)", async () => {
    const body = await renderArticle();
    expect(body).toMatch(/class="chq-docs-pager-prev"[^>]*>[^<]*Start here/);
  });

  it("docs/design/Chautauqua Docs.dc.html:202 `<span style=\"flex:1; border:1px solid #CFC7B7; border-radius:6px; background:#F4F1E8; color:#2E2A24; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600\">Next ›</span>` -- the pager's next control is present, carrying the real neighbour's own title (the frame's 'Next' is placeholder copy)", async () => {
    const body = await renderArticle();
    expect(body).toMatch(/class="chq-docs-pager-next"[^>]*>[^<]*Speakers, tasks and content/);
  });
});
