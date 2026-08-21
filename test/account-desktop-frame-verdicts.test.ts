// ACCOUNT — DESKTOP (1600) per-frame render verdicts (task w24-f, DEC-613
// wave-24 amendment, DEC-651 wave-24 amendment). MEASUREMENT ONLY: this
// file fixes nothing, touches no route module and no .css.ts, and moves no
// desktop byte.
//
// Every harness below is COPIED, never re-authored (DEC-613 wave-24
// amendment: "a desktop SSR verdict COPIES an existing buildApp harness
// verbatim -- a fifth mock stack is a second vocabulary, and an unreached
// frame is a more honest artefact than a bespoke one"):
//   - the Sign-in card and its rejected-credentials state reuse
//     test/home-account-docs-390-frame-verdicts.test.ts's queue-based
//     homeFakeDb/homeBuildQueue/loginFakeDb/accountSigninBuildApp shape
//     (itself mirroring test/account-signin-phone.test.ts's buildApp),
//     copied verbatim below (that file exports nothing, so its functions
//     are re-declared here rather than imported).
//   - the Change-password card reuses that same file's real-drizzle-eq()
//     fake db (makeFakeDb/seedUser/buildApp/login/sessionCookieFrom,
//     itself lifted from test/account-password.test.ts), copied verbatim.
//   - the four password-reset states reuse test/password-reset-flow.test.ts's
//     in-memory node:sqlite + drizzle sqlite-proxy harness (makeTestDb/
//     seed/seedUser/buildApp/getCsrf/postForm), copied verbatim -- that
//     harness already owns org+event+user+auth_session+rate_limit+
//     email_log tables and every reset route (/forgot, /reset/:token).
//   - "Not found · /admin/*" (a STATE frame per DEC-651 wave-24 amendment:
//     "a Modal/Menu/STATE frame is verdicted by operating the control that
//     opens it on the real route -- a direct component mount verdicts the
//     component, not the screen") is reached by dispatching a real,
//     unmatched GET /admin/* request through the SAME reset-flow sqlite
//     harness with sessionLoader + registerNotFoundHandler layered on, an
//     organizer session established via the real POST /login flow -- never
//     a direct NotFoundDocument() component mount.
//   - "Sign in · rejected" (also a STATE frame, DEC-651) is reached the
//     same way: a real POST /login with a wrong password, never a direct
//     LoginPage({error: LOGIN_REJECTED}) mount.
//
// RECEIPT RULE: every `docs/design/Chautauqua Account.dc.html:<line>`
// citation is followed, in the same comment, by a backtick-quoted literal
// copied verbatim from that line, with a real `expect(` within 6 lines
// beneath whose subject is rendered PRODUCT bytes (never a re-read of the
// frame file itself).
//
// Full prose lives in docs/design/audit/account-desktop-v12.md.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { registerErrorHandler } from "../src/server/http";
import { registerNotFoundHandler } from "../src/server/not-found";
import { sessionLoader } from "../src/server/middleware";
import { hashPassword } from "../src/auth/password";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import type { KVStore } from "../src/auth/claim";
import * as schema from "../src/db/schema";

const REPO_ROOT = join(__dirname, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Account.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- copied from
 * test/public-390-frame-verdicts.test.ts's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// -----------------------------------------------------------------------
// Sign-in-card harness -- copied verbatim from
// test/home-account-docs-390-frame-verdicts.test.ts (homeFakeDb/
// homeBuildQueue/loginFakeDb/accountSigninBuildApp/singleEventQueue).
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

// GET /login calls loadDemoIdentitiesIfPresent BEFORE
// loadSingleEventContext -- three queue slots would be consumed ahead of
// getHubOrg/listHubEvents if left unhandled; this wrapper special-cases
// `.from(schema.user)` to resolve empty immediately, matching every other
// login-door fixture in the copied source file.
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

describe("Sign in · a card, not a stretched phone (Chautauqua Account.dc.html:28) -- GET /login", () => {
  it("MATCHES -- .chq-auth-card is bounded to max-width:460px and self-centred, never a full-bleed stretch", async () => {
    // Chautauqua Account.dc.html:28 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Sign in · a card, not a stretched phone</span>` -- the frame's own caption is the verdict's subject.
    verbatimLine(
      28,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Sign in · a card, not a stretched phone</span>',
    );
    // Chautauqua Account.dc.html:29 `<div style="width:1600px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px; overflow:hidden; box-shadow:0 18px 44px rgba(27,29,23,0.13); display:flex; flex-direction:column">` --
    // the 1600 stage; the frame's inner card at :30 caps `max-width:460px`.
    // An SSR HTML string carries no computed layout (jsdom applies no
    // stylesheet either), so the "card, not a stretched phone" claim is
    // verdicted against auth.css.ts's own stylesheet TEXT, the same idiom
    // docs/design/audit/speakers-desktop-v12.md's grid-weight-inversion
    // finding uses for an inherently-CSS fact.
    const { AUTH_CSS } = await import("../src/routes/auth.css");
    expect(AUTH_CSS).toMatch(/\.chq-auth-card\s*\{[^}]*max-width:\s*460px/);
    expect(AUTH_CSS).toMatch(/\.chq-auth-card\s*\{[^}]*align-self:\s*center/);

    const app = accountSigninBuildApp(singleEventQueue());
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<main class="chq-auth-card">');
    expect(html).toContain('class="chq-auth-wordmark">chautauqua<');
    expect(html).toContain('class="chq-auth-subtitle">Sign in to DevFlow Conf 2027<');
  });
});

// -----------------------------------------------------------------------
// Change-password harness -- copied verbatim from
// test/home-account-docs-390-frame-verdicts.test.ts (the fake-db-with-
// real-drizzle-eq() block: buildTableMap/buildColumnMap/COLUMN_KEYS/
// COLUMN_TABLES/colKey/JOINED/isJoined/valueOf/chunkLiteral/matches/
// project/makePasswordFakeDb/InMemoryKV/EMAIL/PASSWORD/seedUser/
// passwordBuildApp/loginForPasswordPage), trimmed to what this file needs.
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

describe("Change password · /account/password (Chautauqua Account.dc.html:69) -- authenticated GET /account/password", () => {
  it("MATCHES -- '‹ Back' link, H1, all three fields, and the Change it/Cancel row", async () => {
    // Chautauqua Account.dc.html:69 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Change password · /account/password</span>`
    verbatimLine(
      69,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Change password · /account/password</span>',
    );
    const { db, state } = makePasswordFakeDb();
    await seedUser(state);
    const { app, env } = passwordBuildApp(db);
    const sessionCookie = await loginForPasswordPage(app, env);
    const res = await app.request("/account/password", { headers: { cookie: sessionCookie } }, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Chautauqua Account.dc.html:71 `<a href="#" style="font-size:13px; font-weight:700">‹ Back</a>`
    expect(html).toContain('class="chq-auth-back" href="/admin">');
    expect(html).toContain("‹ Back");
    // Chautauqua Account.dc.html:72 `<span style="display:block; margin-top:8px; font-family:'Familjen Grotesk', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Change your password</span>`
    expect(html).toContain('class="chq-auth-title">Change your password<');
    // Chautauqua Account.dc.html:75 `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Current password</span>`
    expect(html).toContain('class="chq-auth-label">Current password<');
    // Chautauqua Account.dc.html:79 `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">New password</span>`
    expect(html).toContain('class="chq-auth-label">New password<');
    // Chautauqua Account.dc.html:83 `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">New password again</span>`
    const labelMatches = [...html.matchAll(/class="chq-auth-label">New password again</g)];
    expect(labelMatches.length).toBeGreaterThanOrEqual(1);
    // Chautauqua Account.dc.html:87 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:48px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Change it</span>`
    expect(html).toMatch(/class="chq-btn chq-btn-primary">\s*Change it\s*<\/button>/);
    // Chautauqua Account.dc.html:88 `<span style="font-size:13px; color:#565A4B">You stay signed in on this device</span>`
    expect(html).toContain('class="chq-auth-hint">You stay signed in on this device<');
  });
});

// -----------------------------------------------------------------------
// Reset-flow + Not-found + rejected-signin harness -- copied verbatim from
// test/password-reset-flow.test.ts (DDL/makeTestDb/InMemoryKV/seed/
// seedUser/getCsrf/postForm), extended with sessionLoader +
// registerNotFoundHandler + accountRoutes for the two STATE frames
// (DEC-651 wave-24 amendment).
// -----------------------------------------------------------------------

const DDL = `
create table org (
  id text primary key,
  name text
);
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
create table user (
  id text primary key,
  org_id text,
  email text,
  password_hash text,
  role text,
  name text,
  contact_id text,
  created_at integer,
  updated_at integer
);
create table auth_session (
  id text primary key,
  user_id text,
  token_hash text,
  expires_at integer,
  created_at integer,
  updated_at integer
);
create table form (
  id text primary key,
  event_id text,
  is_default integer,
  open_date text,
  close_date text
);
create table rate_limit (
  key text primary key,
  count integer not null,
  expires_at integer not null
);
create table email_log (
  id text primary key,
  event_id text,
  template_id text,
  contact_id text,
  batch_id text,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  ics_text text,
  ics_filename text,
  provider text,
  status text,
  sent_at integer,
  created_at integer
);
`;

function makeResetTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

class ResetInMemoryKV implements KVStore {
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

const RESET_ORG_ID = "org_1";
const RESET_EVENT_ID = "event_1";
const RESET_EVENT_NAME = "DevFlow Conf 2027";
const RESET_EMAIL = "sbek-speaker@example.test";
const RESET_OLD_PASSWORD = "old-password-123";
const RESET_NEW_PASSWORD = "new-password-456";

function seedResetOrgAndEvent(sqlite: DatabaseSync) {
  const now = 1_700_000_000_000;
  sqlite.exec(`insert into org (id, name) values ('${RESET_ORG_ID}', 'Acme')`);
  sqlite.exec(
    `insert into event (id, org_id, name, slug, start_date, end_date, location, timezone, record_prefix, created_at, updated_at)
     values ('${RESET_EVENT_ID}', '${RESET_ORG_ID}', '${RESET_EVENT_NAME}', 'devflow-2027', '2027-01-01', '2027-01-03', null, 'UTC', 'SES', ${now}, ${now})`,
  );
  return now;
}

async function seedResetUser(sqlite: DatabaseSync, role: string = "speaker") {
  const passwordHash = await hashPassword(RESET_OLD_PASSWORD);
  const now = 1_700_000_000_000;
  sqlite.exec(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
     values ('u_1', '${RESET_ORG_ID}', '${RESET_EMAIL}', '${passwordHash}', '${role}', null, ${now}, ${now})`,
  );
}

/** Reset-route-only app (no sessionLoader, no accountRoutes, no not-found
 * handler) -- used by the four reset-state frames, exactly the shape
 * test/password-reset-flow.test.ts's own buildApp uses. */
function resetOnlyBuildApp(db: Db, kv: ResetInMemoryKV) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  const env = {
    KV: kv as unknown as AppEnv["Bindings"]["KV"],
    DEV_MODE: "1",
    PUBLIC_BASE_URL: "http://127.0.0.1:8787",
  };
  return { app, env };
}

/** Full app (sessionLoader + authRoutes + accountRoutes + the shared
 * app.notFound() handler) -- used by the two STATE frames (rejected
 * sign-in, /admin/* not-found), DEC-651 wave-24 amendment. */
function fullResetBuildApp(db: Db, kv: ResetInMemoryKV) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", authRoutes);
  app.route("/", accountRoutes);
  registerNotFoundHandler(app);
  const env = {
    KV: kv as unknown as AppEnv["Bindings"]["KV"],
    DEV_MODE: "1",
    PUBLIC_BASE_URL: "http://127.0.0.1:8787",
  };
  return { app, env };
}

async function getCsrf(app: Hono<AppEnv>, env: Record<string, unknown>, path: string) {
  const res = await app.request(path, {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

function postForm(
  app: Hono<AppEnv>,
  env: Record<string, unknown>,
  path: string,
  cookie: string,
  fields: Record<string, string>,
) {
  const form = new URLSearchParams(fields);
  return app.request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: form.toString(),
    },
    env,
  );
}

describe("Reset · ask for a link (Chautauqua Account.dc.html:182) -- GET /forgot", () => {
  it("MATCHES -- 'Reset your password' heading, the email field, and the ‹ Back to sign in / Email me a link row", async () => {
    // Chautauqua Account.dc.html:182 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Reset · ask for a link</span>`
    verbatimLine(
      182,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Reset · ask for a link</span>',
    );
    const { db, sqlite } = makeResetTestDb();
    seedResetOrgAndEvent(sqlite);
    const { app, env } = resetOnlyBuildApp(db, new ResetInMemoryKV());
    const res = await app.request("/forgot", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Chautauqua Account.dc.html:188 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Reset your password</span>`
    expect(html).toContain('class="chq-auth-title">Reset your password<');
    // Chautauqua Account.dc.html:189 `<span style="font-size:14px; line-height:1.6; color:#3F4237">We will email you a link to set a new one.</span>`
    expect(html).toContain('class="chq-auth-subtitle">We will email you a link to set a new one.<');
    // Chautauqua Account.dc.html:198 `<a href="#" style="font-size:13px; font-weight:700">‹ Back to sign in</a>`
    expect(html).toContain("‹ Back to sign in");
    // Chautauqua Account.dc.html:199 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 22px; font-size:14px; font-weight:700">Email me a link</span>`
    expect(html).toMatch(/>\s*Email me a link\s*<\/button>/);
  });
});

describe("Reset · link sent (Chautauqua Account.dc.html:209) -- POST /forgot", () => {
  it("MATCHES -- 'Check your email' heading, the identical-response-regardless-of-match copy, and the two footer actions", async () => {
    // Chautauqua Account.dc.html:209 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Reset · link sent</span>`
    verbatimLine(
      209,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Reset · link sent</span>',
    );
    const { db, sqlite } = makeResetTestDb();
    seedResetOrgAndEvent(sqlite);
    await seedResetUser(sqlite);
    const { app, env } = resetOnlyBuildApp(db, new ResetInMemoryKV());
    const { csrf, cookie } = await getCsrf(app, env, "/forgot");
    const res = await postForm(app, env, "/forgot", cookie, { [CSRF_COOKIE_NAME]: csrf, email: RESET_EMAIL });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Chautauqua Account.dc.html:215 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Check your email</span>`
    expect(html).toContain('class="chq-auth-title">Check your email<');
    // Chautauqua Account.dc.html:219 `<span style="font-size:13px; color:#565A4B; line-height:1.6">Nothing arrived? Check spam, then try again.</span>`
    expect(html).toContain('class="chq-auth-hint">Nothing arrived? Check spam, then try again.<');
    // Chautauqua Account.dc.html:222 `<a href="#" style="font-size:13px; font-weight:700">Use a different address</a>`
    expect(html).toContain("Use a different address");
    // Chautauqua Account.dc.html:223 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 22px; font-size:14px; font-weight:700">Back to sign in</span>`
    expect(html).toContain("Back to sign in");
  });
});

describe("Reset · choose a new one (Chautauqua Account.dc.html:235) -- GET /reset/:token", () => {
  it("MATCHES -- 'Choose a new password' heading, the emailed identity line, both password fields, and 'Save and sign in'", async () => {
    // Chautauqua Account.dc.html:235 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Reset · choose a new one</span>`
    verbatimLine(
      235,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Reset · choose a new one</span>',
    );
    const { db, sqlite } = makeResetTestDb();
    seedResetOrgAndEvent(sqlite);
    await seedResetUser(sqlite);
    const { app, env } = resetOnlyBuildApp(db, new ResetInMemoryKV());
    const { csrf, cookie } = await getCsrf(app, env, "/forgot");
    await postForm(app, env, "/forgot", cookie, { [CSRF_COOKIE_NAME]: csrf, email: RESET_EMAIL });
    const logRows = await db.select().from(schema.emailLog);
    const token = logRows[0]!.bodyText.match(/\/reset\/([A-Za-z0-9_-]+)/)![1]!;
    const res = await app.request(`/reset/${token}`, {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Chautauqua Account.dc.html:241 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Choose a new password</span>`
    expect(html).toContain('class="chq-auth-title">Choose a new password<');
    // Chautauqua Account.dc.html:242 `<span style="font-size:14px; line-height:1.6; color:#3F4237">Signing in as sbek-speaker@example.com.</span>` -- frame's illustrative address; the tree renders the REAL seeded email in the same structural slot.
    expect(html).toContain(`Signing in as ${RESET_EMAIL}.`);
    // Chautauqua Account.dc.html:250 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 22px; font-size:14px; font-weight:700">Save and sign in</span>`
    expect(html).toMatch(/>\s*Save and sign in\s*<\/button>/);
  });
});

describe("Reset · link no longer valid (Chautauqua Account.dc.html:266) -- POST /reset/:token on a consumed token", () => {
  it("MATCHES -- 'That link has expired' heading, the used-or-replaced body copy, and ‹ Back to sign in / Send a fresh link", async () => {
    // Chautauqua Account.dc.html:266 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Reset · link no longer valid</span>`
    verbatimLine(
      266,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Reset · link no longer valid</span>',
    );
    const { db, sqlite } = makeResetTestDb();
    seedResetOrgAndEvent(sqlite);
    await seedResetUser(sqlite);
    const { app, env } = resetOnlyBuildApp(db, new ResetInMemoryKV());
    const { csrf: forgotCsrf, cookie: forgotCookie } = await getCsrf(app, env, "/forgot");
    await postForm(app, env, "/forgot", forgotCookie, { [CSRF_COOKIE_NAME]: forgotCsrf, email: RESET_EMAIL });
    const logRows = await db.select().from(schema.emailLog);
    const token = logRows[0]!.bodyText.match(/\/reset\/([A-Za-z0-9_-]+)/)![1]!;
    const { csrf: c1, cookie: cookie1 } = await getCsrf(app, env, `/reset/${token}`);
    const firstPost = await postForm(app, env, `/reset/${token}`, cookie1, {
      [CSRF_COOKIE_NAME]: c1,
      next: RESET_NEW_PASSWORD,
      confirm: RESET_NEW_PASSWORD,
    });
    expect(firstPost.status).toBe(302);
    // Reuse the double-submit cookie/value pair -- not scoped to a URL, and
    // the now-consumed token's own GET carries no fresh CSRF-minting form.
    const secondPost = await postForm(app, env, `/reset/${token}`, forgotCookie, {
      [CSRF_COOKIE_NAME]: forgotCsrf,
      next: "yet-another-password",
      confirm: "yet-another-password",
    });
    expect(secondPost.status).toBe(410);
    const html = await secondPost.text();
    // Chautauqua Account.dc.html:272 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">That link has expired</span>`
    expect(html).toContain('class="chq-auth-title">That link has expired<');
    // Chautauqua Account.dc.html:273 `<span style="font-size:14px; line-height:1.6; color:#3F4237">This link has already been used, or it has been replaced by a newer one.</span>`
    expect(html).toContain("This link has already been used, or it has been replaced by a newer one.");
    // Chautauqua Account.dc.html:276 `<a href="#" style="font-size:13px; font-weight:700">‹ Back to sign in</a>`
    expect(html).toContain("‹ Back to sign in");
    // Chautauqua Account.dc.html:277 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 22px; font-size:14px; font-weight:700">Send a fresh link</span>`
    expect(html).toContain("Send a fresh link");
  });
});

describe("Sign in · rejected (Chautauqua Account.dc.html:290) -- POST /login with bad credentials (STATE frame, DEC-651 wave-24 amendment)", () => {
  it("MATCHES -- the refusal band renders via a real POST /login, never a direct error-view mount", async () => {
    // Chautauqua Account.dc.html:290 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Sign in · rejected</span>`
    verbatimLine(
      290,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Sign in · rejected</span>',
    );
    // No org/event seeded -- loadSingleEventContext's getHubOrg(db)
    // short-circuits to null (subtitle falls back to "Sign in to your
    // account" instead of an event-scoped one, not itself this frame's
    // subject), which keeps listHubEvents's submission/submission_track/
    // submission_answer joins (tables this reset-flow DDL does not
    // declare) from ever running. Verdicted structure below is the
    // refusal band, LOGIN_REJECTED's own headline/detail and the
    // unconditional Forgot-password link -- none of which depend on org
    // context.
    const { db, sqlite } = makeResetTestDb();
    await seedResetUser(sqlite);
    const { app, env } = fullResetBuildApp(db, new ResetInMemoryKV());
    const { csrf, cookie } = await getCsrf(app, env, "/login");
    const res = await postForm(app, env, "/login", cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      email: RESET_EMAIL,
      password: "wrong-password-entirely",
    });
    expect(res.status).toBe(401);
    const html = await res.text();
    // Chautauqua Account.dc.html:303 `<span style="font-size:14px; font-weight:700; line-height:1.5">That email and password do not match</span>` -- src/routes/auth-helpers.ts's LOGIN_REJECTED headline is committed verbatim to this exact frame line (its own comment cites the same span).
    expect(html).toMatch(/<div class="chq-error-summary" role="alert">\s*<h2>That email and password do not match<\/h2>/);
    // Chautauqua Account.dc.html:304 `<span style="font-size:13px; color:#3F4237; line-height:1.55">Check both, or reset your password.</span>`
    expect(html).toContain("Check both, or reset your password.");
    // Chautauqua Account.dc.html:317 `<a href="#" style="font-size:13px; font-weight:700">Forgot your password?</a>`
    expect(html).toContain("Forgot your password?");
  });
});

describe("Not found · /admin/* (Chautauqua Account.dc.html:101) -- GET an unmatched /admin/* path (STATE frame, DEC-651 wave-24 amendment)", () => {
  it("MATCHES -- 'That page isn't here' heading, the stale-link body copy, and the organizer Overview/Submissions footer links", async () => {
    // Chautauqua Account.dc.html:101 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Not found · /admin/*</span>`
    verbatimLine(
      101,
      '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Not found · /admin/*</span>',
    );
    const { db, sqlite } = makeResetTestDb();
    // No org/event seeded -- resolveNotFoundEyebrow's getHubOrg(db) short-
    // circuits to null (eyebrow falls back to "Not found"), so this reset-
    // flow DDL's missing form/submission/track tables (which a seeded org
    // would force listHubEvents to query) are never touched. The frame's
    // own "DevFlow Conf 2027" eyebrow is illustrative mockup content, same
    // treatment test/home-account-docs-390-frame-verdicts.test.ts's Docs
    // verdict gives the frame's illustrative H1 text.
    await seedResetUser(sqlite, "organizer");
    const { app, env } = fullResetBuildApp(db, new ResetInMemoryKV());
    const { csrf, cookie } = await getCsrf(app, env, "/login");
    const loginRes = await postForm(app, env, "/login", cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      email: RESET_EMAIL,
      password: RESET_OLD_PASSWORD,
    });
    expect(loginRes.status).toBe(302);
    const sessionSet = loginRes.headers.get("set-cookie") ?? "";
    const sessionMatch = sessionSet.match(/chq_session=([^;]+)/);
    if (!sessionMatch) throw new Error("no chq_session cookie on login response");
    const sessionCookie = `chq_session=${sessionMatch[1]}`;

    const res = await app.request("/admin/no-such-route", { headers: { cookie: sessionCookie } }, env);
    expect(res.status).toBe(404);
    const html = await res.text();
    // Chautauqua Account.dc.html:107 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1.06">That page isn't here</span>`
    expect(html).toContain('class="chq-auth-title">That page isn&#39;t here<');
    // Chautauqua Account.dc.html:108 `<span style="font-size:15px; line-height:1.65; color:#3F4237">The link may be old, or the event may have been switched since it was saved.</span>`
    expect(html).toContain("The link may be old, or the event may have been switched since it was saved.");
    // Chautauqua Account.dc.html:110 `<a href="#" style="font-size:14px; font-weight:700">Overview ›</a>`
    expect(html).toContain('href="/admin/overview">Overview');
    // Chautauqua Account.dc.html:111 `<a href="#" style="font-size:14px; font-weight:700">Submissions ›</a>`
    expect(html).toContain('href="/admin/submissions">Submissions');
  });
});
