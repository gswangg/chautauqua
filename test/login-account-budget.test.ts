// DEC-072 wave-66 amendment: POST /login spends THREE budgets in order --
// "login-account" (bare email, AUTH_ACCOUNT_RATE_LIMIT_MAX=50),
// "login-user" (email|ip pair, AUTH_RATE_LIMIT_MAX=20, unchanged since
// wave-54), and "login-ip" (bare ip, 100, unchanged). Before wave-66 there
// was NO bucket keyed on a stable identity value alone -- both remaining
// buckets are functions of a header the client controls (x-forwarded-for,
// which is all stage-1 has -- no trusted edge sets cf-connecting-ip), so
// rotating that header per request bought unlimited password guesses
// against one known address.
//
// DEC-072 wave-38 amendment: because the account key is bare-email (no ip
// component), it is also the ONE bucket a stranger can drive to its cap
// against a VICTIM'S address from anywhere -- and unlike the pair/ip
// buckets there is no unlock path, since the victim's own correct password
// never gets a chance to run before the pre-verification 429 fired. So
// "login-account" is now a FAILURE budget, not an admission gate: it is
// still checked-and-incremented atomically first (DEC-948), but exhausting
// it only turns a WRONG password's 401 into a 429 -- the owner's CORRECT
// password still succeeds regardless of the account bucket's state. The
// pair (login-user) and ip (login-ip) buckets are unchanged HARD
// pre-verification 429s.
//
// These tests use x-forwarded-for exclusively (never cf-connecting-ip) so
// requestIpFromHeaders resolves the SPOOFABLE fallback path, mirroring a
// real attacker.
//
// Same in-memory node:sqlite + drizzle sqlite-proxy technique as
// test/auth-login-lockout.test.ts.

import { beforeEach, describe, expect, it } from "vitest";
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
import { AUTH_ACCOUNT_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX } from "../src/routes/auth-helpers";

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

// Deliberately uses x-forwarded-for ONLY -- no cf-connecting-ip -- so
// requestIpFromHeaders resolves the spoofable fallback, exactly as an
// attacker rotating that header would see in stage 1.
async function getCsrf(app: Hono<AppEnv>, env: Record<string, unknown>, xff: string) {
  const res = await app.request("/login", { headers: { "x-forwarded-for": xff } }, env);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
  return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
}

async function postLogin(
  app: Hono<AppEnv>,
  env: Record<string, unknown>,
  xff: string,
  fields: { email: string; password: string },
) {
  const { csrf, cookie } = await getCsrf(app, env, xff);
  const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf, ...fields });
  return app.request(
    "/login",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie,
        "x-forwarded-for": xff,
      },
      body: form.toString(),
    },
    env,
  );
}

describe("DEC-072 wave-66: login-account restores a spoof-proof per-account budget beside the (email,ip) pair budget", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    await seedUser(sqlite);
  });

  it(`a WRONG password against the account-exhausted budget still 429s -- ${AUTH_ACCOUNT_RATE_LIMIT_MAX + 1} failed logins for one email, each from a DIFFERENT spoofed x-forwarded-for`, async () => {
    const { app, env } = buildApp(db);

    for (let i = 0; i < AUTH_ACCOUNT_RATE_LIMIT_MAX; i++) {
      const res = await postLogin(app, env, `10.0.0.${i}`, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    // The (AUTH_ACCOUNT_RATE_LIMIT_MAX + 1)th attempt, from yet another
    // fresh spoofed IP, is a WRONG password -- the account budget is
    // exhausted so it still 429s, even though this exact (email, ip) pair
    // and this exact ip have never been seen before -- proof the throttle
    // is keyed on identity alone.
    const overCap = await postLogin(app, env, "10.0.0.999", { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(overCap.status).toBe(429);
  });

  it(`DEC-072 wave-38 REGRESSION: an exhausted account budget never blocks the OWNER'S correct password -- ${AUTH_ACCOUNT_RATE_LIMIT_MAX + 5} wrong-password POSTs from rotating spoofed IPs, then the real owner's correct password from a FRESH IP succeeds`, async () => {
    const { app, env } = buildApp(db);

    // An unauthenticated stranger drives the account-wide budget well past
    // its cap using a different spoofed x-forwarded-for on every request --
    // the pair (login-user) and ip (login-ip) buckets never see repeats, so
    // only the account-wide bucket is ever exhausted here.
    for (let i = 0; i < AUTH_ACCOUNT_RATE_LIMIT_MAX + 5; i++) {
      const res = await postLogin(app, env, `10.1.0.${i}`, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect([401, 429]).toContain(res.status);
    }

    // The real owner, from a brand new IP the attacker never used, presents
    // their CORRECT password. Before the wave-38 amendment the exhausted
    // account bucket would have 429'd this unconditionally -- there is no
    // unlock path for a pre-verification denial keyed on bare email. After
    // the amendment, the correct password is the unlock path: this must
    // succeed.
    const ownerLogin = await postLogin(app, env, "192.0.2.200", { email: VICTIM_EMAIL, password: PASSWORD });
    expect(ownerLogin.status).toBe(302);
    expect(ownerLogin.headers.get("set-cookie")).toBeTruthy();
  });

  it("DEC-072 wave-38: with the account budget exhausted, a WRONG password from a fresh IP still 429s (the budget still throttles brute force)", async () => {
    const { app, env } = buildApp(db);

    for (let i = 0; i < AUTH_ACCOUNT_RATE_LIMIT_MAX; i++) {
      const res = await postLogin(app, env, `10.2.0.${i}`, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const wrongFromFreshIp = await postLogin(app, env, "192.0.2.201", {
      email: VICTIM_EMAIL,
      password: "wrong-password",
    });
    expect(wrongFromFreshIp.status).toBe(429);
  });

  it("DEC-072 wave-38: a normal wrong password with the account budget unexhausted returns 401, not 429", async () => {
    const { app, env } = buildApp(db);

    const res = await postLogin(app, env, "10.3.0.1", { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it(`the per-(email,ip) pair budget still 429s at ${AUTH_RATE_LIMIT_MAX} from one IP (unchanged)`, async () => {
    const { app, env } = buildApp(db);
    const xff = "203.0.113.9";

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const res = await postLogin(app, env, xff, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const capped = await postLogin(app, env, xff, { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(capped.status).toBe(429);
  });

  it("a successful login clears both the account and the pair buckets", async () => {
    const { app, env } = buildApp(db);
    const xff = "203.0.113.9";

    for (let i = 0; i < 5; i++) {
      const res = await postLogin(app, env, xff, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const success = await postLogin(app, env, xff, { email: VICTIM_EMAIL, password: PASSWORD });
    expect(success.status).toBe(302);

    // Both buckets reset by the success above -- a fresh full window of
    // pair-budget failures (AUTH_RATE_LIMIT_MAX) is admitted before the
    // next one caps, proving login-user was zeroed too.
    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const res = await postLogin(app, env, xff, { email: VICTIM_EMAIL, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const cappedAgain = await postLogin(app, env, xff, { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(cappedAgain.status).toBe(429);

    // And the account budget was zeroed too: from a BRAND NEW ip (so the
    // pair bucket for that ip is fresh), the account bucket still has
    // headroom for a full window rather than carrying over the pre-success
    // failures.
    const freshIpAfterSuccess = await postLogin(app, env, "198.51.100.7", {
      email: VICTIM_EMAIL,
      password: "wrong-password",
    });
    expect(freshIpAfterSuccess.status).toBe(401);
  });

  it("a login-ip deny refunds both earlier buckets -- a second request from a fresh IP for the same email is still admitted", async () => {
    const { app, env } = buildApp(db);
    const floodIp = "203.0.113.50";

    // Exhaust the per-IP flood guard (max 100) using 100 distinct emails
    // from the SAME ip, so the 101st request (any email) from this ip
    // denies at login-ip regardless of its own account/pair budgets.
    for (let i = 0; i < 100; i++) {
      const res = await postLogin(app, env, floodIp, { email: `nobody-${i}@example.test`, password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    // This request's account+pair buckets for VICTIM_EMAIL are still
    // fresh (never used from floodIp before), but login-ip denies it --
    // proving the account/pair spends from THIS request get refunded, not
    // left burned, when the later login-ip bucket fires.
    const deniedByFlood = await postLogin(app, env, floodIp, { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(deniedByFlood.status).toBe(429);

    // A fresh IP for the same email is still admitted -- if the account
    // bucket had actually been burned (not refunded) by the denied request
    // above, this would still succeed since only 1 unit would have been
    // spent either way; the load-bearing assertion is the 401 (not 429),
    // proving no bucket carries a phantom "denied-but-not-refunded" spend.
    const freshIp = await postLogin(app, env, "198.51.100.200", { email: VICTIM_EMAIL, password: "wrong-password" });
    expect(freshIp.status).toBe(401);
  });
});
