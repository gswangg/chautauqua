// POST /forgot response-path parity (task-w44-c, DEC-004 wave-44 amendment).
//
// The wave-27 amendment already made the response BYTES byte-identical
// between a known and an unknown address. This closes the remaining TIMING
// oracle: the known-address branch used to await a KV write (createResetToken),
// a D1 read (listEventsForOrg) and a mailer send before returning, while the
// unknown branch paid one hashResetToken -- the wall clock leaked existence
// even though the bytes matched.
//
// Per DEC-004 wave-58's own rule, this test asserts OPERATION COUNTS
// observed at response time (and after the scheduled work settles), never
// wall-clock. It uses the same in-memory node:sqlite + drizzle sqlite-proxy
// technique as test/password-reset-flow.test.ts, and a fake ExecutionContext
// that captures the promises handed to waitUntil instead of running them
// immediately, so "counts at response time" vs "counts after settling" are
// observably different instants.

import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import type { ExecutionContext } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv } from "../src/server/env";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { hashPassword } from "../src/auth/password";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { KVStore } from "../src/auth/claim";

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

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
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

class CountingKV implements KVStore {
  private readonly store = new Map<string, string>();
  putCount = 0;

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.putCount += 1;
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/** Captures the promises handed to waitUntil instead of running them
 * immediately, so a test can observe "counts at response time" (before any
 * captured promise is awaited) as a distinct instant from "counts after the
 * scheduled work settles" (after awaiting them). */
class CapturingExecutionContext implements ExecutionContext {
  readonly captured: Promise<unknown>[] = [];
  props: unknown = undefined;
  waitUntil(promise: Promise<unknown>): void {
    this.captured.push(promise);
  }
  passThroughOnException(): void {
    // not exercised by this handler
  }
  async settle(): Promise<void> {
    await Promise.all(this.captured);
  }
}

const ORG_ID = "org_1";
const EVENT_ID = "event_1";
const EVENT_NAME = "DevFlow Conf 2027";
const EMAIL = "speaker@example.test";
const PASSWORD = "old-password-123";

function seed(sqlite: DatabaseSync) {
  const now = 1_700_000_000_000;
  sqlite.exec(`insert into org (id, name) values ('${ORG_ID}', 'Acme')`);
  sqlite.exec(
    `insert into event (id, org_id, name, slug, start_date, end_date, location, timezone, record_prefix, created_at, updated_at)
     values ('${EVENT_ID}', '${ORG_ID}', '${EVENT_NAME}', 'devflow-2027', '2027-01-01', '2027-01-03', null, 'UTC', 'SES', ${now}, ${now})`,
  );
}

async function seedUser(sqlite: DatabaseSync) {
  const passwordHash = await hashPassword(PASSWORD);
  const now = 1_700_000_000_000;
  sqlite.exec(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
     values ('u_1', '${ORG_ID}', '${EMAIL}', '${passwordHash}', 'speaker', null, ${now}, ${now})`,
  );
}

function buildApp(db: Db, kv: CountingKV) {
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

async function getCsrf(app: Hono<AppEnv>, env: Record<string, unknown>, path: string) {
  const res = await app.request(path, {}, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function postForgot(
  app: Hono<AppEnv>,
  env: Record<string, unknown>,
  cookie: string,
  csrf: string,
  email: string,
  ctx?: ExecutionContext,
) {
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, email });
  return app.request(
    "/forgot",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: form.toString(),
    },
    env,
    ctx,
  );
}

describe("POST /forgot response-path parity (DEC-004 wave-44 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    seed(sqlite);
    await seedUser(sqlite);
  });

  it("known address: zero sends/puts observed at response time, both appear once the scheduled work settles", async () => {
    const kv = new CountingKV();
    const { app, env } = buildApp(db, kv);
    const ctx = new CapturingExecutionContext();

    const { csrf, cookie } = await getCsrf(app, env, "/forgot");
    const res = await postForgot(app, env, cookie, csrf, EMAIL, ctx);
    expect(res.status).toBe(200);

    // Nothing has run yet: the branch work was scheduled, not awaited.
    expect(kv.putCount).toBe(0);
    const rowsAtResponse = await db.select().from(schema.emailLog);
    expect(rowsAtResponse).toHaveLength(0);

    // Exactly one piece of work was scheduled.
    expect(ctx.captured).toHaveLength(1);
    await ctx.settle();

    // createResetToken issues two puts (the token key and the per-user
    // "newest live grant" index key) -- see src/auth/password-reset.ts.
    expect(kv.putCount).toBe(2);
    const rowsAfterSettle = await db.select().from(schema.emailLog);
    expect(rowsAfterSettle).toHaveLength(1);
    expect(rowsAfterSettle[0]!.toEmail).toBe(EMAIL);
  });

  it("unknown address: the same zero counts at response time as a known address", async () => {
    const kv = new CountingKV();
    const { app, env } = buildApp(db, kv);
    const ctx = new CapturingExecutionContext();

    const { csrf, cookie } = await getCsrf(app, env, "/forgot");
    const res = await postForgot(app, env, cookie, csrf, "nobody@example.test", ctx);
    expect(res.status).toBe(200);

    expect(kv.putCount).toBe(0);
    const rowsAtResponse = await db.select().from(schema.emailLog);
    expect(rowsAtResponse).toHaveLength(0);

    // Exactly one piece of work was scheduled here too -- the dummy-hash
    // branch -- so both branches present the SAME shape to the scheduler.
    expect(ctx.captured).toHaveLength(1);
    await ctx.settle();

    // The unknown branch never puts to KV or sends mail, even after its
    // scheduled work settles.
    expect(kv.putCount).toBe(0);
    const rowsAfterSettle = await db.select().from(schema.emailLog);
    expect(rowsAfterSettle).toHaveLength(0);
  });

  it("with no ExecutionContext, the inline fallback still mints the token and sends the mail synchronously", async () => {
    const kv = new CountingKV();
    const { app, env } = buildApp(db, kv);

    const { csrf, cookie } = await getCsrf(app, env, "/forgot");
    // No 4th arg -- app.request()'s executionCtx is undefined, so
    // c.executionCtx throws and executionCtxOf(c) falls back to awaiting
    // the branch work inline (mirroring servePublicGet's fallback).
    const res = await postForgot(app, env, cookie, csrf, EMAIL);
    expect(res.status).toBe(200);

    expect(kv.putCount).toBe(2);
    const rows = await db.select().from(schema.emailLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.toEmail).toBe(EMAIL);
  });
});
