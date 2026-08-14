// w10-d (DEC-072 amendment): POST /submit/:eventSlug adds a SECOND scoped
// budget keyed on the submitted (normalised) email, alongside the existing
// per-IP budget. The per-IP budget alone is spoofable via x-forwarded-for
// (see rate-limit.ts's own doc comment); an attacker rotating XFF on every
// request must still be capped once they reuse the same email.
//
// Real migrated SQLite harness (same technique as
// test/rate-limit-identity-keys.test.ts / test/content-reupload-reopens.test.ts)
// so the D1 upsert-based counter (src/server/repo/rate-limit.ts) is
// exercised for real, not mocked -- and so we can assert on actual
// submission/contact/participant row counts and R2 puts.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import type { R2Bucket } from "@cloudflare/workers-types";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
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

const ORG_ID = "org-1";
const EVENT_ID = "event-1";
const FORM_ID = "form-1";

function seedCore(sqlite: DatabaseSync) {
  const now = Date.now();
  sqlite.prepare(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`).run(ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
       values (?, ?, 'Event', 'event-1', '2026-01-01', '2026-01-02', 'America/New_York', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into form (id, event_id, title, is_default, created_at, updated_at)
       values (?, ?, 'Speak at Event', 1, ?, ?)`,
    )
    .run(FORM_ID, EVENT_ID, now, now);
  const fields: [string, string, string, string, number][] = [
    ["title", "session", "text", "Title", 1],
    ["description", "session", "long_text", "Description", 1],
    ["first_name", "speaker", "text", "First name", 1],
    ["last_name", "speaker", "text", "Last name", 1],
    ["email", "speaker", "text", "Email", 1],
  ];
  fields.forEach(([id, section, kind, label, required], position) => {
    sqlite
      .prepare(
        `insert into form_field (id, form_id, section, kind, label, required, position, locked, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(id, FORM_ID, section, kind, label, required, position, now, now);
  });
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function fakeFilesBucket() {
  const puts: { key: string }[] = [];
  const bucket = {
    async put(key: string) {
      puts.push({ key });
    },
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
  return { bucket, puts };
}

const CSRF_TOKEN = "test-csrf-token";

function submitForm(opts: { email: string; xff?: string }) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", "My great talk");
  form.set("field__description", "A talk about things.");
  form.set("speaker_name", "Ada Lovelace");
  form.set("field__email", opts.email);
  const headers: Record<string, string> = {
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
    Origin: "http://local",
  };
  if (opts.xff) headers["x-forwarded-for"] = opts.xff;
  return new Request("http://local/submit/event-1", {
    method: "POST",
    headers,
    body: form,
  });
}

async function buildApp(db: Db) {
  const { publicSubmitRoutes } = await import("../src/routes/public/submit");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

describe("public submit email-scoped rate limit (w10-d, DEC-072 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedCore(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  function countSubmissions(): number {
    return (sqlite.prepare(`select count(*) as c from submission`).get() as { c: number }).c;
  }
  function countContacts(): number {
    return (sqlite.prepare(`select count(*) as c from contact`).get() as { c: number }).c;
  }

  it("11 submissions with the SAME email but DIFFERENT spoofed x-forwarded-for values: the 11th is refused and writes nothing", async () => {
    const app = await buildApp(db);
    const email = "victim@example.com";
    const { bucket, puts } = fakeFilesBucket();
    const bindings = { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

    const responses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const req = submitForm({ email, xff: `198.51.100.${i}` });
      const res = await app.request(req, undefined, bindings);
      responses.push(res.status);
      if (i === 10) {
        expect(res.status).toBe(429);
        const body = await res.text();
        expect(body).toContain("My great talk");
        expect(body).toContain(email);
      }
    }

    // First 10 succeeded (200), the 11th was refused (429).
    expect(responses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(responses[10]).toBe(429);

    // Exactly 10 submissions were created (the same email, so exactly one
    // contact row) -- the refused 11th attempt wrote nothing: no new
    // submission row, no new contact row, no R2 object.
    expect(countSubmissions()).toBe(10);
    expect(countContacts()).toBe(1);
    expect(puts).toHaveLength(0); // this form has no file field
  });

  it("a first submission from a fresh (unrelated) email still succeeds after the shared email's budget is exhausted", async () => {
    const app = await buildApp(db);
    const exhaustedEmail = "victim@example.com";
    const { bucket } = fakeFilesBucket();
    const bindings = { KV: fakeKv(), FILES: bucket, DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

    for (let i = 0; i < 10; i++) {
      const req = submitForm({ email: exhaustedEmail, xff: `198.51.100.${i}` });
      const res = await app.request(req, undefined, bindings);
      expect(res.status).toBe(200);
    }
    const capped = await app.request(submitForm({ email: exhaustedEmail, xff: "198.51.100.99" }), undefined, bindings);
    expect(capped.status).toBe(429);

    const freshEmail = "fresh@example.com";
    const freshRes = await app.request(submitForm({ email: freshEmail, xff: "203.0.113.1" }), undefined, bindings);
    expect(freshRes.status).toBe(200);
    expect(countSubmissions()).toBe(11);
  });
});
