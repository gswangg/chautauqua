// DEC-770 amendment (wave 48): a contact_duplicate_dismissal row judges a
// PAIR, never a single contact -- so once either side of that pair is gone
// (deleted, or merged away into the other contact), the dismissal row must
// be deleted too, never repointed onto a survivor. Runs the real
// contactsRoutes sub-app against a real (in-memory) SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver, same technique as
// test/contact-delete-refusal-rows.test.ts (no D1 test harness exists in
// stage 1).

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { contactsRoutes } from "../src/routes/api/contacts";
import { registerErrorHandler } from "../src/server/http";
import { dismissDuplicatePair, mergeContacts } from "../src/server/repo/contacts/merge";
import { deleteContact } from "../src/server/repo/contacts/crud";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  title text,
  bio text,
  headshot_url text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table contact_duplicate_dismissal (
  id text primary key,
  org_id text,
  contact_id_a text,
  contact_id_b text,
  created_at integer,
  unique (org_id, contact_id_a, contact_id_b)
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text not null default 'none',
  created_at integer,
  updated_at integer
);
create table task_assignment (
  id text primary key,
  task_id text,
  contact_id text,
  status text,
  completed_at integer,
  completed_by text,
  response_json text,
  file_id text,
  last_reminded_at integer,
  created_at integer,
  updated_at integer
);
create table pipeline_entry (
  id text primary key,
  org_id text,
  contact_id text,
  stage text,
  fit_score integer,
  rationale text,
  created_at integer,
  updated_at integer
);
create table pipeline_activity (
  id text primary key,
  entry_id text,
  kind text,
  body text,
  from_stage text,
  to_stage text,
  author_user_id text,
  author_name text,
  created_at integer
);
create table email_log (
  id text primary key,
  org_id text,
  event_id text,
  contact_id text,
  kind text,
  subject text,
  body_html text,
  to_email text,
  status text,
  sent_at integer,
  created_at integer
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
create table file (
  id text primary key,
  org_id text,
  event_id text,
  submission_id text,
  kind text,
  filename text,
  r2_key text,
  size integer,
  content_type text,
  uploaded_by_contact_id text,
  uploaded_by_user_id text,
  created_at integer
);
create table file_comment (
  id text primary key,
  file_id text,
  author_contact_id text,
  author_user_id text,
  body text,
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

const NOW = 1_700_000_000_000;
const ORG_A = "org-a";

function appWithDbAndAuth(db: Db, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function insertContact(sqlite: DatabaseSync, id: string, firstName: string, lastName: string, email: string) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, firstName, lastName, email, NOW, NOW);
}

function dismissalCount(sqlite: DatabaseSync): number {
  const rows = sqlite.prepare(`select id from contact_duplicate_dismissal`).all();
  return rows.length;
}

describe("contact_duplicate_dismissal cascades (DEC-770 amendment, wave 48)", () => {
  it("dismiss (A,B) then DELETE contact B -> zero dismissal rows remain, GET /duplicates still 200s", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-a", "Ada", "Lovelace", "ada@example.com");
    insertContact(sqlite, "contact-b", "Ada", "Lovelace", "ada2@example.com");

    await dismissDuplicatePair(db, ORG_A, "contact-a", "contact-b");
    expect(dismissalCount(sqlite)).toBe(1);

    await deleteContact(db, "contact-b");
    expect(dismissalCount(sqlite)).toBe(0);

    const app = appWithDbAndAuth(db, ORGANIZER_A);
    const res = await app.request(new Request("http://local/api/v1/contacts/duplicates"));
    expect(res.status).toBe(200);
  });

  it("dismiss (A,B) then merge B into A -> zero dismissal rows remain", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-a", "Ada", "Lovelace", "ada@example.com");
    insertContact(sqlite, "contact-b", "Ada", "Lovelace", "ada2@example.com");

    await dismissDuplicatePair(db, ORG_A, "contact-a", "contact-b");
    expect(dismissalCount(sqlite)).toBe(1);

    await mergeContacts(db, "contact-a", ["contact-b"]);
    expect(dismissalCount(sqlite)).toBe(0);
  });

  it("dismissal for an unrelated pair is untouched by a delete of a third contact", async () => {
    const { db, sqlite } = makeTestDb();
    insertContact(sqlite, "contact-a", "Ada", "Lovelace", "ada@example.com");
    insertContact(sqlite, "contact-b", "Ada", "Lovelace", "ada2@example.com");
    insertContact(sqlite, "contact-c", "Grace", "Hopper", "grace@example.com");

    await dismissDuplicatePair(db, ORG_A, "contact-a", "contact-b");
    expect(dismissalCount(sqlite)).toBe(1);

    await deleteContact(db, "contact-c");
    expect(dismissalCount(sqlite)).toBe(1);
  });
});
