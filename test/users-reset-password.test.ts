// DEC-215/DEC-220 coverage: POST /api/v1/users/:id/reset-password. Uses the
// same small in-memory fake db as test/account-password.test.ts (dispatches
// by table identity, evaluates real drizzle eq()/and() conditions) plus the
// real /login route so the old-password-stops-working / new-password-works
// swap and the session-cookie revocation are both exercised end to end
// rather than mocked away. No self-target guard per DEC-220 (existence-
// hiding 404 covers unknown AND cross-org ids identically).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader, requireOrganizer, requireReviewer, requireSpeaker } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { usersRoutes } from "../src/routes/api/users";
import { hashPassword, verifyPassword } from "../src/auth/password";
import * as schema from "../src/db/schema";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv, AuthInfo } from "../src/server/env";

type Row = Record<string, unknown>;

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
  // DEC-948: the login door's rate limiter now reads/writes a D1
  // rate_limit row instead of KV.
  ...buildColumnMap(schema.rateLimit as unknown as Record<string, unknown>),
  // DEC-949: reset-password now also sweeps the target's bearer api_token
  // rows (repo.deleteApiTokensForUser), so the fake db needs to resolve
  // that table's columns too.
  ...buildColumnMap(schema.apiToken as unknown as Record<string, unknown>),
]);

function colKey(col: unknown): string {
  const key = COLUMN_KEYS.get(col);
  if (!key) throw new Error("unmapped column in fake db test helper");
  return key;
}

function unwrap(rawValue: unknown): unknown {
  return rawValue && typeof rawValue === "object" && "value" in (rawValue as object)
    ? (rawValue as { value: unknown }).value
    : rawValue;
}

// DEC-276 (wave 63): auth is now a single innerJoin (auth_session ⋈ user), so
// the fake db has to resolve a column against the correct side of a joined
// row — schema.user.id and schema.authSession.id share the key "id".
function buildTableMap(table: Record<string, unknown>, tableRef: unknown, into: Map<unknown, unknown>) {
  for (const col of Object.values(table)) {
    if (col && typeof col === "object" && "name" in (col as object)) into.set(col, tableRef);
  }
  return into;
}

const COLUMN_TABLES = new Map<unknown, unknown>();
for (const t of [schema.user, schema.authSession, schema.rateLimit, schema.apiToken]) {
  buildTableMap(t as unknown as Record<string, unknown>, t, COLUMN_TABLES);
}

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

// Evaluates a real drizzle eq()/and() condition tree against a row —
// getOrgUserById() builds an and(eq(id), eq(orgId)) clause, so a flat
// single-eq evaluator (as in the simplest fakes) isn't enough here.
function evalCond(cond: unknown, row: Row | JoinedRow): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  if (COLUMN_KEYS.has(chunks[1])) {
    // A join condition compares two columns (eq(a.x, b.y)).
    if (COLUMN_TABLES.has(chunks[3])) return valueOf(row, chunks[1]) === valueOf(row, chunks[3]);
    // inArray()'s chunks[3] is an array of Param values (DEC-865:
    // getOrgUserById now scopes by inArray(role, ORG_USER_ROLES)); eq()'s
    // chunks[3] is a single Param.
    if (Array.isArray(chunks[3])) {
      const values = (chunks[3] as unknown[]).map(unwrap);
      return values.includes(valueOf(row, chunks[1]));
    }
    return valueOf(row, chunks[1]) === unwrap(chunks[3]);
  }
  let any = false;
  let result = true;
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && Array.isArray((chunk as { queryChunks?: unknown }).queryChunks)) {
      any = true;
      result = result && evalCond(chunk, row);
    }
  }
  if (!any) throw new Error("evalCond: no matchable condition found in fake db test helper");
  return result;
}

function project(row: Row | JoinedRow, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...(row as Row) };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = valueOf(row, col);
  return out;
}

// NOTE: this fake db is one of ~10 copy-pasted clones (grep -rln 'fake db
// test helper' test/) -- test/auth-rate-limit-atomicity.test.ts,
// test/users-speaker-scope.test.ts, test/users-role-change.test.ts,
// test/account-desktop-frame-verdicts.test.ts, test/account-password.test.ts,
// test/session-rotation.test.ts, test/account-password-phone.test.ts,
// test/account-docs-phone-frames.render.test.ts,
// test/home-account-docs-390-frame-verdicts.test.ts, and
// test/users-api.test.ts. Only this file and test/users-api.test.ts needed
// the DEC-949 api_token table this wave; the others were not red and were
// left untouched.
function makeFakeDb() {
  const state: { users: Row[]; sessions: Row[]; rateLimits: Row[]; apiTokens: Row[] } = {
    users: [],
    sessions: [],
    rateLimits: [],
    apiTokens: [],
  };
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    if (table === schema.authSession) return state.sessions;
    if (table === schema.rateLimit) return state.rateLimits;
    // DEC-949: reset-password sweeps the target's bearer api_token rows
    // (repo.deleteApiTokensForUser) via db.delete(schema.apiToken)...
    // .returning({ id }) -- without this branch the sweep 500s.
    if (table === schema.apiToken) return state.apiTokens;
    throw new Error("unexpected table in fake db test helper");
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const whereOver = (rows: (Row | JoinedRow)[]) => (cond: unknown) => {
            const matched = rows.filter((r) => evalCond(cond, r));
            return {
              limit(n: number) {
                return Promise.resolve(matched.slice(0, n).map((r) => project(r, fields)));
              },
            };
          };
          return {
            where: whereOver(rowsFor(table)),
            innerJoin(joinTable: unknown, on: unknown) {
              const joined: JoinedRow[] = [];
              for (const left of rowsFor(table)) {
                for (const right of rowsFor(joinTable)) {
                  const row: JoinedRow = {
                    [JOINED]: new Map([
                      [table, left],
                      [joinTable, right],
                    ]),
                  };
                  if (evalCond(on, row)) joined.push(row);
                }
              }
              return { where: whereOver(joined) };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
          // DEC-948: checkAndIncrementScopedLimit's atomic upsert (insert
          // ... on conflict(key) do update set count = count + 1 returning
          // count) against the rate_limit table -- a real push-only insert
          // would wrongly reject a second attempt against the same window.
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
              for (const r of rowsFor(table)) {
                if (evalCond(cond, r)) Object.assign(r, patch);
              }
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
          const deleted = rows.filter((r) => evalCond(cond, r));
          const remaining = rows.filter((r) => !evalCond(cond, r));
          rows.length = 0;
          rows.push(...remaining);
          return {
            // DEC-949/DEC-948: deleteApiTokensForUser counts
            // `.returning({ id }).length` rather than a `.meta.changes`
            // stat the sqlite-proxy test driver never forwards -- the
            // fake db has to actually return the deleted rows' ids.
            returning(fields?: Record<string, unknown>) {
              return Promise.resolve(deleted.map((r) => project(r, fields)));
            },
            then(resolve: (v: undefined) => void) {
              resolve(undefined);
            },
          };
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

const ORG_A = "org-a";
const ORG_B = "org-b";
const TARGET_EMAIL = "reviewer-reset@example.test";
const OLD_PASSWORD = "old-password-999";

async function seedTargetUser(state: { users: Row[] }, orgId = ORG_A) {
  const passwordHash = await hashPassword(OLD_PASSWORD);
  const user = {
    id: "target-user-1",
    orgId,
    email: TARGET_EMAIL,
    passwordHash,
    role: "reviewer",
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.users.push(user);
  return user;
}

function seedApiToken(state: { apiTokens: Row[] }, id: string, createdByUserId: string, orgId = ORG_A) {
  state.apiTokens.push({
    id,
    orgId,
    name: `token-${id}`,
    tokenHash: `hash-${id}`,
    tokenPrefix: `pfx-${id}`,
    createdByUserId,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function buildFullApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", authRoutes);
  app.route("/", usersRoutes);
  // Stand-in protected route to prove session revocation, mirroring
  // test/account-password.test.ts's pattern.
  app.get("/api/v1/organizer-ping", requireOrganizer, (c) => c.json({ ok: true }));
  app.get("/api/v1/reviewer-ping", requireReviewer, (c) => c.json({ ok: true }));
  app.get("/api/v1/speaker-ping", requireSpeaker, (c) => c.json({ ok: true }));
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

function organizerApp(db: AppEnv["Variables"]["db"], auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/", usersRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

async function login(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, email: string, password: string) {
  const csrfRes = await app.request("/login", {}, env);
  const setCookie = csrfRes.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("no csrf cookie on /login");
  const csrf = match[1]!;
  const cookie = `${CSRF_COOKIE_NAME}=${csrf}`;
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email, password });
  return app.request(
    "/login",
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
    env,
  );
}

function sessionCookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/chq_session=([^;]+)/);
  if (!match) throw new Error("no chq_session cookie on response");
  return `chq_session=${match[1]}`;
}

function resetPassword(
  app: Hono<AppEnv>,
  targetId: string,
  headers: Record<string, string> = { "content-type": "application/json", "x-chq-csrf": "1" },
  env: { KV: AppEnv["Bindings"]["KV"] } = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] },
) {
  return app.request(`/api/v1/users/${targetId}/reset-password`, { method: "POST", headers, body: "{}" }, env);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/users/:id/reset-password (DEC-215/DEC-220)", () => {
  it("(1) organizer resets a reviewer: 200 with a fresh well-formed password whose hash verifies and differs from the old hash", async () => {
    const { db, state } = makeFakeDb();
    const target = await seedTargetUser(state);
    const oldHash = target.passwordHash as string;
    const { app: org, env: orgEnv } = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await resetPassword(org, target.id as string, undefined, orgEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string; role: string; password: string };
    expect(body.id).toBe(target.id);
    expect(body.email).toBe(TARGET_EMAIL);
    expect(body.role).toBe("reviewer");
    expect(body.password).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/);

    const stored = state.users.find((u) => u.id === target.id)!;
    const newHash = stored.passwordHash as string;
    expect(newHash).not.toBe(oldHash);
    expect(await verifyPassword(body.password, newHash)).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD, newHash)).toBe(false);
  });

  it("(2) the target's pre-existing session cookie stops working after reset", async () => {
    const { db, state } = makeFakeDb();
    await seedTargetUser(state);
    const { app, env } = buildFullApp(db);

    const targetLogin = await login(app, env, TARGET_EMAIL, OLD_PASSWORD);
    expect(targetLogin.status).toBe(302);
    const targetSessionCookie = sessionCookieFrom(targetLogin);

    // Confirm the session works pre-reset.
    const preCheck = await app.request("/api/v1/reviewer-ping", { headers: { cookie: targetSessionCookie } }, env);
    expect(preCheck.status).toBe(200);

    const { app: org, env: orgEnv } = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });
    const resetRes = await resetPassword(org, "target-user-1", undefined, orgEnv);
    expect(resetRes.status).toBe(200);
    expect(state.sessions).toHaveLength(0);

    const postCheck = await app.request("/api/v1/reviewer-ping", { headers: { cookie: targetSessionCookie } }, env);
    expect(postCheck.status).toBe(401);
  });

  it("(2b) DEC-949: sweeps every api_token the target minted (revokedApiTokens counted from the real delete), and leaves a different user's token alone", async () => {
    const { db, state } = makeFakeDb();
    const target = await seedTargetUser(state);
    const otherUser = await seedTargetUser(state, ORG_A);
    otherUser.id = "other-user-1";
    otherUser.email = "other-user@example.test";
    seedApiToken(state, "token-1", target.id as string);
    seedApiToken(state, "token-2", target.id as string);
    seedApiToken(state, "token-3", otherUser.id as string);
    const { app: org, env: orgEnv } = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await resetPassword(org, target.id as string, undefined, orgEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { revokedApiTokens: number };
    expect(body.revokedApiTokens).toBe(2);

    const remainingTokenIds = state.apiTokens.map((t) => t.id);
    expect(remainingTokenIds).toEqual(["token-3"]);
  });

  it("(3) 404s for a cross-org target and an unknown id — existence-hiding, same status either way", async () => {
    const { db, state } = makeFakeDb();
    await seedTargetUser(state, ORG_B);
    const { app: org, env: orgEnv } = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const crossOrgRes = await resetPassword(org, "target-user-1", undefined, orgEnv);
    expect(crossOrgRes.status).toBe(404);

    const unknownRes = await resetPassword(org, "does-not-exist", undefined, orgEnv);
    expect(unknownRes.status).toBe(404);
  });

  it("(4) rejects reviewer, speaker, and anonymous callers", async () => {
    const { db, state } = makeFakeDb();
    await seedTargetUser(state);

    const { app: reviewerApp, env: reviewerEnv } = organizerApp(db, { userId: "u1", role: "reviewer", orgId: ORG_A });
    expect((await resetPassword(reviewerApp, "target-user-1", undefined, reviewerEnv)).status).toBe(403);

    const { app: speakerApp, env: speakerEnv } = organizerApp(db, { userId: "u2", role: "speaker", orgId: ORG_A });
    expect((await resetPassword(speakerApp, "target-user-1", undefined, speakerEnv)).status).toBe(403);

    const anonApp = new Hono<AppEnv>();
    registerErrorHandler(anonApp);
    anonApp.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    anonApp.route("/", usersRoutes);
    expect((await resetPassword(anonApp, "target-user-1")).status).toBe(401);
  });

  it("(5) rejects a missing CSRF header", async () => {
    const { db, state } = makeFakeDb();
    await seedTargetUser(state);
    const { app: org, env: orgEnv } = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await resetPassword(org, "target-user-1", { "content-type": "application/json" }, orgEnv);
    expect(res.status).toBe(400);
  });

  it("(6) never sends an email — mailer.send is not called by a reset", async () => {
    const sends: unknown[] = [];
    vi.doMock("../src/server/context", async () => {
      const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
      return {
        ...actual,
        makeMailer: vi.fn(() => ({
          send: vi.fn(async (m: unknown) => {
            sends.push(m);
          }),
        })),
      };
    });

    const { usersRoutes: freshUsersRoutes } = await import("../src/routes/api/users");
    const { db, state } = makeFakeDb();
    const target = await seedTargetUser(state);

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", { userId: "org-admin", role: "organizer", orgId: ORG_A });
      await next();
    });
    app.route("/", freshUsersRoutes);

    const res = await resetPassword(app, target.id as string);
    expect(res.status).toBe(200);
    // Reset-password never calls the mailer (contrast POST /api/v1/users'
    // welcome email, which does) — no email_log row is ever inserted for
    // this action, and the dev mailbox therefore shows nothing new either.
    expect(sends).toHaveLength(0);

    vi.doUnmock("../src/server/context");
    vi.resetModules();
  });
});
