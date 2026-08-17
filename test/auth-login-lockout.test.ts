// DEC-072 wave-54 amendment: the "login-user" rate-limit budget is now
// keyed on loginIdentityKey(email, ip) (src/routes/auth-helpers.ts), not
// the bare email. Before this amendment, 20 wrong-password POSTs against a
// known organizer address -- from ANY IP -- burned the account's entire
// shared budget and left no unlock path (max/window never expires quickly
// enough for a real user to just wait it out in practice, and there is no
// admin unlock action). Keying on email|ip confines that exhaustion to the
// attacker's own source IP: the victim's own IP still admits their login
// attempts, and a stranger has to control 20 distinct source IPs (or the
// same IP twenty times) to lock the victim out from that specific IP,
// never from every IP.
//
// Same in-memory node:sqlite + drizzle sqlite-proxy technique as
// test/password-reset-flow.test.ts -- real SELECT/INSERT/UPDATE statements
// run through the actual Hono app.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
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

class InMemoryKV implements KVStore {
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

const ORG_ID = "org_1";
const VICTIM_EMAIL = "victim@example.com";
const PASSWORD = "correct-password-123";

async function seedUser(sqlite: DatabaseSync) {
  const passwordHash = await hashPassword(PASSWORD);
  const now = 1_700_000_000_000;
  sqlite.exec(`insert into org (id, name) values ('${ORG_ID}', 'Acme')`);
  sqlite.exec(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
     values ('u_1', '${ORG_ID}', '${VICTIM_EMAIL}', '${passwordHash}', 'organizer', null, ${now}, ${now})`,
  );
}

function buildApp(db: Db) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  const env = {
    KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"],
    DEV_MODE: "1",
    PUBLIC_BASE_URL: "http://127.0.0.1:8787",
  };
  return { app, env };
}

async function getCsrf(app: Hono<AppEnv>, env: Record<string, unknown>, ip: string) {
  const res = await app.request("/login", { headers: { "cf-connecting-ip": ip } }, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function postLogin(
  app: Hono<AppEnv>,
  env: Record<string, unknown>,
  ip: string,
  fields: { email: string; password: string },
) {
  const { csrf, cookie } = await getCsrf(app, env, ip);
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, ...fields });
  return app.request(
    "/login",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie,
        "cf-connecting-ip": ip,
      },
      body: form.toString(),
    },
    env,
  );
}

describe("DEC-072 wave-54: the identity-keyed login budget no longer strands a victim from every IP", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  // DEC-072's budgets live in FIXED, epoch-aligned 15-minute windows --
  // windowBounds (src/server/repo/rate-limit.ts:41-45) floors Date.now() to
  // a multiple of the window and keys the counter row on that floor. So a
  // test that spends real wall-clock time walking a budget to its cap is
  // only correct while every attempt lands in the SAME window: if the run
  // straddles a boundary, the counter starts over mid-loop and the attempt
  // that should be the (max+1)th is merely the nth. That is a fact about
  // the clock, not about the code under test, and it failed CI's test-full
  // on 2026-08-17 ("the per-IP flood guard still trips at its cap":
  // expected 429, got 401) -- 101 password-verifying POSTs take long enough
  // on a shared runner to make the straddle a real probability every run.
  // Freezing Date.now at a fixed mid-window instant removes the wall clock
  // from the assertion entirely (86_400_000 is an exact multiple of the
  // 900_000ms window, so 12:07:30 UTC is 450s into a window, as far from
  // either edge as it gets). Nothing in the login path reads the clock for
  // anything but these buckets and session expiry.
  const FROZEN_NOW = Date.UTC(2027, 0, 15, 12, 7, 30);

  beforeEach(async () => {
    vi.spyOn(Date, "now").mockReturnValue(FROZEN_NOW);
    ({ db, sqlite } = makeTestDb());
    await seedUser(sqlite);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("20 failed attempts for the victim's email from IP A cap the 21st from IP A, but the first attempt for the same email from IP B still admits and signs in", async () => {
    const { app, env } = buildApp(db);
    const IP_A = "203.0.113.9";
    const IP_B = "198.51.100.42";

    for (let i = 0; i < 20; i++) {
      const res = await postLogin(app, env, IP_A, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const twentyFirst = await postLogin(app, env, IP_A, { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(twentyFirst.status).toBe(429);

    // Even a CORRECT password from the attacker's own exhausted IP is
    // blocked -- the per-identity budget applies before verification.
    const stillBlocked = await postLogin(app, env, IP_A, { email: VICTIM_EMAIL, password: PASSWORD });
    expect(stillBlocked.status).toBe(429);

    // But the victim, logging in from their OWN IP (B), is unaffected --
    // this is the fix: the old bare-email key would have 429'd this too.
    const firstFromB = await postLogin(app, env, IP_B, { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(firstFromB.status).toBe(401);

    const success = await postLogin(app, env, IP_B, { email: VICTIM_EMAIL, password: PASSWORD });
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe("/admin");
  });

  it("a successful login zeroes its own per-identity bucket, so a fresh 20-attempt window follows from the same IP", async () => {
    const { app, env } = buildApp(db);
    const ip = "203.0.113.9";

    for (let i = 0; i < 5; i++) {
      const res = await postLogin(app, env, ip, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const success = await postLogin(app, env, ip, { email: VICTIM_EMAIL, password: PASSWORD });
    expect(success.status).toBe(302);

    // Budget reset by the success above -- 20 MORE failures are all
    // admitted (non-429) before the 21st caps again.
    for (let i = 0; i < 20; i++) {
      const res = await postLogin(app, env, ip, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const capped = await postLogin(app, env, ip, { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(capped.status).toBe(429);
  });

  it("the per-IP flood guard still trips at its cap across many distinct emails from one IP", async () => {
    const { app, env } = buildApp(db);
    const ip = "203.0.113.9";

    for (let i = 0; i < 100; i++) {
      const res = await postLogin(app, env, ip, { email: `nobody-${i}@example.test`, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const res = await postLogin(app, env, ip, { email: "nobody-100@example.test", password: "wrong-password" });
    expect(res.status).toBe(429);
  });
});
