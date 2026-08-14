// Password reset (DEC-014 wave-25 amendment / DEC-154 / DEC-180 / DEC-994)
// end-to-end coverage. Runs the real repo/route code against a real
// (in-memory) SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy
// driver (same technique as test/submission-touch-on-write.test.ts) so the
// actual SELECT/INSERT/UPDATE/DELETE statements the routes issue are
// exercised, not hand-simulated — including the email_log write DevSinkMailer
// performs and the auth_session revocation POST /reset/:token performs.

import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv } from "../src/server/env";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import {
  createResetToken,
  readResetToken,
  hashResetToken,
  resetKvKey,
  resetIndexKey,
} from "../src/auth/password-reset";
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
  has(key: string): boolean {
    return this.store.has(key);
  }
}

const ORG_ID = "org_1";
const EVENT_ID = "event_1";
const EVENT_NAME = "DevFlow Conf 2027";
const EMAIL = "speaker@example.test";
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

function seed(sqlite: DatabaseSync, opts: { role?: string } = {}) {
  const now = 1_700_000_000_000;
  sqlite.exec(`insert into org (id, name) values ('${ORG_ID}', 'Acme')`);
  sqlite.exec(
    `insert into event (id, org_id, name, slug, start_date, end_date, location, timezone, record_prefix, created_at, updated_at)
     values ('${EVENT_ID}', '${ORG_ID}', '${EVENT_NAME}', 'devflow-2027', '2027-01-01', '2027-01-03', null, 'UTC', 'SES', ${now}, ${now})`,
  );
  return now;
}

async function seedUser(sqlite: DatabaseSync, role: string = "speaker") {
  const passwordHash = await hashPassword(OLD_PASSWORD);
  const now = 1_700_000_000_000;
  sqlite.exec(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
     values ('u_1', '${ORG_ID}', '${EMAIL}', '${passwordHash}', '${role}', null, ${now}, ${now})`,
  );
}

function buildApp(db: Db, kv: InMemoryKV) {
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

describe("password reset — real round trip (DEC-014 wave-25 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  let kv: InMemoryKV;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    kv = new InMemoryKV();
    seed(sqlite);
    await seedUser(sqlite);
  });

  it("request -> captured mail body carries /reset/<token> -> GET renders the Set card naming the account -> POST sets the password and leaves ZERO prior auth_session rows -> a second use of the same token renders the 410 card", async () => {
    const { app, env } = buildApp(db, kv);

    // 1. Seed a live session directly (bypassing GET/POST /login, which
    // also queries the unrelated public-hub tables this DDL doesn't carry)
    // so there's something for the reset's issueSessionRevokingAll call to
    // prove it revoked.
    await db.insert(schema.authSession).values({
      id: "sess_prior",
      userId: "u_1",
      tokenHash: await hashResetToken("prior-session-token"),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const priorSessionRows = await db.select().from(schema.authSession).where(eq(schema.authSession.userId, "u_1"));
    expect(priorSessionRows.length).toBeGreaterThan(0);

    // 2. Request a reset.
    const { csrf: forgotCsrf, cookie: forgotCookie } = await getCsrf(app, env, "/forgot");
    const forgotRes = await postForm(app, env, "/forgot", forgotCookie, {
      [CSRF_COOKIE_NAME]: forgotCsrf,
      email: EMAIL,
    });
    expect(forgotRes.status).toBe(200);
    const forgotBody = await forgotRes.text();
    expect(forgotBody).toContain("Check your email");
    expect(forgotBody).toContain(EMAIL);

    // 3. The captured mail body carries /reset/<token>.
    const rows = await db.select().from(schema.emailLog);
    expect(rows).toHaveLength(1);
    const sentRow = rows[0]!;
    expect(sentRow.toEmail).toBe(EMAIL);
    const match = sentRow.bodyText.match(/\/reset\/([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("mail body did not carry a /reset/<token> link");
    const token = match[1]!;
    expect(sentRow.bodyHtml ?? "").toContain(`/reset/${token}`);

    // 4. GET /reset/:token renders the Set card, naming the account.
    const getRes = await app.request(`/reset/${token}`, {}, env);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.text();
    expect(getBody).toContain("Choose a new password");
    expect(getBody).toContain(EMAIL);

    // 5. POST sets the password and leaves ZERO prior auth_session rows.
    const { csrf: resetCsrf, cookie: resetCookie } = await getCsrf(app, env, `/reset/${token}`);
    const postRes = await postForm(app, env, `/reset/${token}`, resetCookie, {
      [CSRF_COOKIE_NAME]: resetCsrf,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(postRes.status).toBe(302);
    expect(postRes.headers.get("location")).toBe("/portal"); // seeded role is "speaker"

    const userRows = await db.select().from(schema.user).where(eq(schema.user.id, "u_1"));
    const passwordOk = await verifyPassword(NEW_PASSWORD, userRows[0]!.passwordHash);
    expect(passwordOk).toBe(true);

    const sessionRowsAfter = await db.select().from(schema.authSession).where(eq(schema.authSession.userId, "u_1"));
    // Exactly the one FRESH row minted by issueSessionRevokingAll survives —
    // every prior row (the login-time one) is gone.
    expect(sessionRowsAfter).toHaveLength(1);
    const freshTokenHash = sessionRowsAfter[0]!.tokenHash;
    const priorHashes = priorSessionRows.map((r) => r.tokenHash);
    expect(priorHashes).not.toContain(freshTokenHash);

    // 6. A second use of the same (now-consumed) token renders the 410 card.
    const replayRes = await app.request(`/reset/${token}`, {}, env);
    expect(replayRes.status).toBe(410);
    const replayBody = await replayRes.text();
    expect(replayBody).toContain("That link has expired");
  });

  it("redirects an organizer to /admin (the round-trip test above covers the speaker -> /portal case)", async () => {
    const passwordHash = await hashPassword(OLD_PASSWORD);
    sqlite.exec(
      `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
       values ('u_organizer', '${ORG_ID}', 'organizer@example.test', '${passwordHash}', 'organizer', null, 1700000000000, 1700000000000)`,
    );
    const { app, env } = buildApp(db, kv);
    const token = await createResetToken(kv, "u_organizer");

    const { csrf, cookie } = await getCsrf(app, env, `/reset/${token}`);
    const res = await postForm(app, env, `/reset/${token}`, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("POST /forgot returns an identical status and body for a known and an unknown address", async () => {
    const { app, env } = buildApp(db, kv);

    const { csrf: csrf1, cookie: cookie1 } = await getCsrf(app, env, "/forgot");
    const knownRes = await postForm(app, env, "/forgot", cookie1, {
      [CSRF_COOKIE_NAME]: csrf1,
      email: EMAIL,
    });
    const { csrf: csrf2, cookie: cookie2 } = await getCsrf(app, env, "/forgot");
    const unknownRes = await postForm(app, env, "/forgot", cookie2, {
      [CSRF_COOKIE_NAME]: csrf2,
      email: "nobody@example.test",
    });

    expect(knownRes.status).toBe(unknownRes.status);
    const knownBody = await knownRes.text();
    const unknownBody = await unknownRes.text();
    // Normalize the two submitted addresses out of the echoed body — every
    // OTHER byte (including the csrf-cookie-free static markup) must match.
    const normalize = (html: string) => html.replace(EMAIL, "ADDR").replace("nobody@example.test", "ADDR");
    expect(normalize(knownBody)).toBe(normalize(unknownBody));

    // Only the known address actually queued a send.
    const rows = await db.select().from(schema.emailLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.toEmail).toBe(EMAIL);
  });

  it("a too-short new password is rejected without leaving the token consumed unusably (still names the account, error text present)", async () => {
    const { app, env } = buildApp(db, kv);
    const token = await createResetToken(kv, "u_1");

    const { csrf, cookie } = await getCsrf(app, env, `/reset/${token}`);
    const res = await postForm(app, env, `/reset/${token}`, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      next: "short",
      confirm: "short",
    });
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("at least");
  });
});

describe("password-reset token module (src/auth/password-reset.ts)", () => {
  it("stores under pwreset:<sha256(token)>, never the raw token", async () => {
    const kv = new InMemoryKV();
    const token = await createResetToken(kv, "u_1");
    const hash = await hashResetToken(token);
    expect(kv.has(resetKvKey(hash))).toBe(true);
    expect(kv.has(`pwreset:${token}`)).toBe(false);
  });

  it("minting twice leaves only the newest hash live (hard-delete, no supersede grace)", async () => {
    const kv = new InMemoryKV();
    const first = await createResetToken(kv, "u_1");
    const firstHash = await hashResetToken(first);
    const second = await createResetToken(kv, "u_1");

    expect(second).not.toBe(first);

    // The prior record is HARD-DELETED, not re-put with a grace TTL —
    // reading the old token now resolves to nothing.
    await expect(readResetToken(kv, first)).resolves.toBeNull();
    expect(kv.has(resetKvKey(firstHash))).toBe(false);

    // The index points only at the newest hash.
    await expect(kv.get(resetIndexKey("u_1"))).resolves.toBe(await hashResetToken(second));
    await expect(readResetToken(kv, second)).resolves.toEqual({ userId: "u_1" });
  });
});
