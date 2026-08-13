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

// Evaluates a real drizzle eq()/and() condition tree against a row —
// getOrgUserById() builds an and(eq(id), eq(orgId)) clause, so a flat
// single-eq evaluator (as in the simplest fakes) isn't enough here.
function evalCond(cond: unknown, row: Row): boolean {
  const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
  if (COLUMN_KEYS.has(chunks[1])) {
    // inArray()'s chunks[3] is an array of Param values (DEC-865:
    // getOrgUserById now scopes by inArray(role, ORG_USER_ROLES)); eq()'s
    // chunks[3] is a single Param.
    if (Array.isArray(chunks[3])) {
      const values = (chunks[3] as unknown[]).map(unwrap);
      return values.includes(row[colKey(chunks[1])]);
    }
    return row[colKey(chunks[1])] === unwrap(chunks[3]);
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

function project(row: Row, fields?: Record<string, unknown>): Row {
  if (!fields) return { ...row };
  const out: Row = {};
  for (const [key, col] of Object.entries(fields)) out[key] = row[colKey(col)];
  return out;
}

function makeFakeDb() {
  const state: { users: Row[]; sessions: Row[] } = { users: [], sessions: [] };
  function rowsFor(table: unknown): Row[] {
    if (table === schema.user) return state.users;
    if (table === schema.authSession) return state.sessions;
    throw new Error("unexpected table in fake db test helper");
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            where(cond: unknown) {
              const matched = rowsFor(table).filter((r) => evalCond(cond, r));
              return {
                limit(n: number) {
                  return Promise.resolve(matched.slice(0, n).map((r) => project(r, fields)));
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: Row) {
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
          const remaining = rows.filter((r) => !evalCond(cond, r));
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
  return app;
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

function resetPassword(app: Hono<AppEnv>, targetId: string, headers: Record<string, string> = { "content-type": "application/json", "x-chq-csrf": "1" }) {
  return app.request(`/api/v1/users/${targetId}/reset-password`, { method: "POST", headers, body: "{}" });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/users/:id/reset-password (DEC-215/DEC-220)", () => {
  it("(1) organizer resets a reviewer: 200 with a fresh well-formed password whose hash verifies and differs from the old hash", async () => {
    const { db, state } = makeFakeDb();
    const target = await seedTargetUser(state);
    const oldHash = target.passwordHash as string;
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await resetPassword(org, target.id as string);
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

    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });
    const resetRes = await resetPassword(org, "target-user-1");
    expect(resetRes.status).toBe(200);
    expect(state.sessions).toHaveLength(0);

    const postCheck = await app.request("/api/v1/reviewer-ping", { headers: { cookie: targetSessionCookie } }, env);
    expect(postCheck.status).toBe(401);
  });

  it("(3) 404s for a cross-org target and an unknown id — existence-hiding, same status either way", async () => {
    const { db, state } = makeFakeDb();
    await seedTargetUser(state, ORG_B);
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const crossOrgRes = await resetPassword(org, "target-user-1");
    expect(crossOrgRes.status).toBe(404);

    const unknownRes = await resetPassword(org, "does-not-exist");
    expect(unknownRes.status).toBe(404);
  });

  it("(4) rejects reviewer, speaker, and anonymous callers", async () => {
    const { db, state } = makeFakeDb();
    await seedTargetUser(state);

    const reviewerApp = organizerApp(db, { userId: "u1", role: "reviewer", orgId: ORG_A });
    expect((await resetPassword(reviewerApp, "target-user-1")).status).toBe(403);

    const speakerApp = organizerApp(db, { userId: "u2", role: "speaker", orgId: ORG_A });
    expect((await resetPassword(speakerApp, "target-user-1")).status).toBe(403);

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
    const org = organizerApp(db, { userId: "org-admin", role: "organizer", orgId: ORG_A });

    const res = await resetPassword(org, "target-user-1", { "content-type": "application/json" });
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
