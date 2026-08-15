// Password-reset ROUTES + screens (task-w27-b, on top of task-w27-a's
// src/auth/password-reset.ts) — end-to-end coverage against the real Hono
// app, per DEC-949/DEC-004/DEC-994's wave-27 amendments:
//   - POST /forgot renders the IDENTICAL "Sent" screen for a known and an
//     unknown email, with no branch in status code, redirect or body.
//   - A full round trip: request -> capture the dev-sink message -> GET the
//     link -> POST -> old session cookie is dead -> new password signs in.
//   - A second POST of the same (now-consumed) token renders the
//     no-longer-valid screen.
//   - The login card renders exactly one "Forgot your password?" link
//     resolving to a route the Worker actually serves.
//
// Same in-memory node:sqlite + drizzle sqlite-proxy technique as
// test/password-reset-token.test.ts's sibling route tests
// (test/account-password.test.ts), so the real SELECT/INSERT/UPDATE/DELETE
// statements the routes issue are exercised, not hand-simulated.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv } from "../src/server/env";
import { authRoutes, loginStatusLine } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../src/auth/cookies";
import { hashResetToken } from "../src/auth/password-reset";
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
}

const ORG_ID = "org_1";
const EVENT_ID = "event_1";
const EVENT_NAME = "DevFlow Conf 2027";
const EMAIL = "speaker@example.test";
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

function seed(sqlite: DatabaseSync) {
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

describe("GET /forgot", () => {
  it("renders the Ask card with the DEC-committed copy", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite);
    const { app, env } = buildApp(db, new InMemoryKV());
    const res = await app.request("/forgot", {}, env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("We will email you a link to set a new one.");
  });
});

describe("POST /forgot — byte-identical response regardless of match (DEC-004 wave-27 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    seed(sqlite);
    await seedUser(sqlite);
  });

  it("known and unknown email produce byte-identical 'Sent' HTML and the same status", async () => {
    const { app, env } = buildApp(db, new InMemoryKV());

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

    expect(knownRes.status).toBe(200);
    expect(knownRes.status).toBe(unknownRes.status);
    const knownBody = await knownRes.text();
    const unknownBody = await unknownRes.text();
    expect(knownBody).toBe(unknownBody);
    expect(knownBody).toContain("If that address has an account, a reset link is on its way.");

    // Only the known address actually queued a send.
    const rows = await db.select().from(schema.emailLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.toEmail).toBe(EMAIL);
    expect(rows[0]!.subject).toBe("Set a new password");
  });
});

describe("full round trip: request -> dev-sink message -> GET link -> POST -> old cookie dead -> new password signs in", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  let kv: InMemoryKV;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    kv = new InMemoryKV();
    seed(sqlite);
    await seedUser(sqlite);
  });

  it("round-trips end to end and revokes the prior session", async () => {
    const { app, env } = buildApp(db, kv);

    // 1. Seed a live prior session (as if the user were signed in on
    // another device before requesting the reset).
    await db.insert(schema.authSession).values({
      id: "sess_prior",
      userId: "u_1",
      tokenHash: await hashResetToken("prior-session-token"),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const priorRows = await db.select().from(schema.authSession).where(eq(schema.authSession.userId, "u_1"));
    expect(priorRows).toHaveLength(1);

    // 2. Request a reset.
    const { csrf: forgotCsrf, cookie: forgotCookie } = await getCsrf(app, env, "/forgot");
    const forgotRes = await postForm(app, env, "/forgot", forgotCookie, {
      [CSRF_COOKIE_NAME]: forgotCsrf,
      email: EMAIL,
    });
    expect(forgotRes.status).toBe(200);

    // 3. Capture the dev-sink message and pull the /reset/<token> link out
    // of it.
    const logRows = await db.select().from(schema.emailLog);
    expect(logRows).toHaveLength(1);
    const sentRow = logRows[0]!;
    expect(sentRow.toEmail).toBe(EMAIL);
    const match = sentRow.bodyText.match(/\/reset\/([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("dev-sink message did not carry a /reset/<token> link");
    const token = match[1]!;
    expect(sentRow.bodyHtml ?? "").toContain(`/reset/${token}`);

    // 4. GET the link.
    const getRes = await app.request(`/reset/${token}`, {}, env);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.text();
    expect(getBody).toContain(EMAIL);

    // 5. POST the new password.
    const { csrf: resetCsrf, cookie: resetCookie } = await getCsrf(app, env, `/reset/${token}`);
    const postRes = await postForm(app, env, `/reset/${token}`, resetCookie, {
      [CSRF_COOKIE_NAME]: resetCsrf,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(postRes.status).toBe(302);
    expect(postRes.headers.get("location")).toBe("/login?password-reset=1");
    // No session cookie is minted for this anonymous request — the user
    // signs back in themselves.
    expect(postRes.headers.get("set-cookie")).toBeNull();

    // 6. Old session cookie is dead: exactly the fresh row minted (and
    // discarded) by issueSessionRevokingAll survives, and it is not any of
    // the prior tokens.
    const sessionRowsAfter = await db.select().from(schema.authSession).where(eq(schema.authSession.userId, "u_1"));
    expect(sessionRowsAfter).toHaveLength(1);
    const priorHashes = priorRows.map((r) => r.tokenHash);
    expect(priorHashes).not.toContain(sessionRowsAfter[0]!.tokenHash);

    // 7. The login card carries the status line named by loginStatusLine.
    expect(loginStatusLine("/login?password-reset=1")).toBe("Your password has been changed. Sign in with it.");

    // 8. New password signs in.
    const userRows = await db.select().from(schema.user).where(eq(schema.user.id, "u_1"));
    const passwordOk = await verifyPassword(NEW_PASSWORD, userRows[0]!.passwordHash);
    expect(passwordOk).toBe(true);
  });

  it("a second POST of the same (now-consumed) token renders the no-longer-valid screen", async () => {
    const { app, env } = buildApp(db, kv);

    const { csrf: forgotCsrf, cookie: forgotCookie } = await getCsrf(app, env, "/forgot");
    await postForm(app, env, "/forgot", forgotCookie, { [CSRF_COOKIE_NAME]: forgotCsrf, email: EMAIL });
    const logRows = await db.select().from(schema.emailLog);
    const token = logRows[0]!.bodyText.match(/\/reset\/([A-Za-z0-9_-]+)/)![1]!;

    const { csrf: c1, cookie: cookie1 } = await getCsrf(app, env, `/reset/${token}`);
    const firstPost = await postForm(app, env, `/reset/${token}`, cookie1, {
      [CSRF_COOKIE_NAME]: c1,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(firstPost.status).toBe(302);

    // The now-consumed token's GET renders the 410 card, which carries no
    // form (nothing to set a fresh CSRF cookie for) -- reuse the earlier
    // double-submit cookie/value pair, which is not scoped to a URL.
    const secondPost = await postForm(app, env, `/reset/${token}`, forgotCookie, {
      [CSRF_COOKIE_NAME]: forgotCsrf,
      next: "yet-another-password",
      confirm: "yet-another-password",
    });
    expect(secondPost.status).toBe(410);
    const body = await secondPost.text();
    expect(body).toContain("This link has already been used, or it has been replaced by a newer one.");
    expect(body).toContain("Send a fresh link");

    // A GET against the same dead token renders the same 410 card.
    const getRes = await app.request(`/reset/${token}`, {}, env);
    expect(getRes.status).toBe(410);
  });
});

describe("validate-then-consume (task-w34-c): a mistyped retry doesn't burn the token", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  let kv: InMemoryKV;

  beforeEach(async () => {
    ({ db, sqlite } = makeTestDb());
    kv = new InMemoryKV();
    seed(sqlite);
    await seedUser(sqlite);
  });

  async function mintToken(app: Hono<AppEnv>, env: Record<string, unknown>) {
    const { csrf: forgotCsrf, cookie: forgotCookie } = await getCsrf(app, env, "/forgot");
    await postForm(app, env, "/forgot", forgotCookie, { [CSRF_COOKIE_NAME]: forgotCsrf, email: EMAIL });
    const logRows = await db.select().from(schema.emailLog);
    return logRows[logRows.length - 1]!.bodyText.match(/\/reset\/([A-Za-z0-9_-]+)/)![1]!;
  }

  it("a mismatched confirm 400s and the SAME token then succeeds on a corrected retry", async () => {
    const { app, env } = buildApp(db, kv);
    const token = await mintToken(app, env);

    const { csrf, cookie } = await getCsrf(app, env, `/reset/${token}`);

    const badPost = await postForm(app, env, `/reset/${token}`, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      next: NEW_PASSWORD,
      confirm: "does-not-match",
    });
    expect(badPost.status).toBe(400);
    const badBody = await badPost.text();
    expect(badBody).toContain("New password and confirmation do not match.");

    // The token is still live: a GET renders the form, not the 410 card.
    const getRes = await app.request(`/reset/${token}`, {}, env);
    expect(getRes.status).toBe(200);

    const goodPost = await postForm(app, env, `/reset/${token}`, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(goodPost.status).toBe(302);
    expect(goodPost.headers.get("location")).toBe("/login?password-reset=1");

    const userRows = await db.select().from(schema.user).where(eq(schema.user.id, "u_1"));
    const passwordOk = await verifyPassword(NEW_PASSWORD, userRows[0]!.passwordHash);
    expect(passwordOk).toBe(true);
  });

  it("a too-short password 400s and the SAME token then succeeds on a corrected retry", async () => {
    const { app, env } = buildApp(db, kv);
    const token = await mintToken(app, env);

    const { csrf, cookie } = await getCsrf(app, env, `/reset/${token}`);

    const badPost = await postForm(app, env, `/reset/${token}`, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      next: "short",
      confirm: "short",
    });
    expect(badPost.status).toBe(400);
    const badBody = await badPost.text();
    expect(badBody).toContain("New password must be at least");

    const getRes = await app.request(`/reset/${token}`, {}, env);
    expect(getRes.status).toBe(200);

    const goodPost = await postForm(app, env, `/reset/${token}`, cookie, {
      [CSRF_COOKIE_NAME]: csrf,
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    expect(goodPost.status).toBe(302);

    const userRows = await db.select().from(schema.user).where(eq(schema.user.id, "u_1"));
    const passwordOk = await verifyPassword(NEW_PASSWORD, userRows[0]!.passwordHash);
    expect(passwordOk).toBe(true);
  });
});

describe("POST /forgot in an org with no event (task-w34-c): mint without delivery stays silent on the wire", () => {
  it("returns the byte-identical Sent card while console.error fires", async () => {
    const { db, sqlite } = makeTestDb();
    // Org exists, no events seeded.
    sqlite.exec(`insert into org (id, name) values ('${ORG_ID}', 'Acme')`);
    await seedUser(sqlite);
    const { app, env } = buildApp(db, new InMemoryKV());

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { csrf, cookie } = await getCsrf(app, env, "/forgot");
      const res = await postForm(app, env, "/forgot", cookie, { [CSRF_COOKIE_NAME]: csrf, email: EMAIL });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("If that address has an account, a reset link is on its way.");

      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy.mock.calls[0]![0]).toContain("no events for org");

      // No send was queued -- there was no event to log it against.
      const rows = await db.select().from(schema.emailLog);
      expect(rows).toHaveLength(0);
    } finally {
      errSpy.mockRestore();
    }
  });
});

describe("login card — Forgot your password? link", () => {
  it("renders exactly one link resolving to a route the Worker serves", async () => {
    // No org/event seeded: getHubOrg finds nothing, so
    // loadSingleEventContext short-circuits before touching the
    // (unmapped-in-this-DDL) submission table -- the "Forgot your
    // password?" link is unconditional and doesn't depend on that path.
    const { db } = makeTestDb();
    const { app, env } = buildApp(db, new InMemoryKV());

    const res = await app.request("/login", {}, env);
    expect(res.status).toBe(200);
    const body = await res.text();
    // Match the rendered anchor element specifically -- AUTH_CSS's own
    // source comments happen to mention the phrase too, and this must not
    // count those.
    const matches = [...body.matchAll(/<a[^>]*href="\/forgot"[^>]*>\s*Forgot your password\?\s*<\/a>/g)];
    expect(matches).toHaveLength(1);

    const forgotRes = await app.request("/forgot", {}, env);
    expect(forgotRes.status).toBe(200);
  });
});

describe("SESSION_COOKIE_NAME sanity", () => {
  it("is exported and non-empty (guards the cookie-name string used implicitly above)", () => {
    expect(SESSION_COOKIE_NAME.length).toBeGreaterThan(0);
  });
});
