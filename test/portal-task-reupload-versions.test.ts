// CNT-04 re-opened closure (task w26-i): the speaker-portal file_request
// replace path, proved at the ROUTE, not the repo. w22-c's
// portal-task-upload-chain.test.ts mocked every repo call and passed — but a
// live judge drove three real portal replace attempts against the real route
// and never saw a v2 entry, which is exactly the "review lens reads a
// snapshot, not the tree" failure mode: the mocked unit test can't catch a
// bug that only shows up when the SAME db round-trips getAssignmentScope,
// insertFile, and getReplacesTarget in sequence. This test drives the real
// `POST /portal/tasks/:assignmentId/upload` handler twice (three times for
// case (c)) against a real in-memory SQLite db (node:sqlite + drizzle's
// sqlite-proxy driver — same technique as test/file-version-identity.test.ts)
// with NO repo mocks at all.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";

const DDL = `
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
create table submission (
  id text primary key,
  event_id text,
  form_id text,
  seq integer,
  title text,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text,
  content_status text,
  accepted_at integer,
  ics_sequence integer,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text,
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer
);
create table task (
  id text primary key,
  event_id text,
  kind text,
  title text,
  description text,
  due_date integer,
  required integer,
  form_id text,
  deliverable_kind text,
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
create table file (
  id text primary key,
  submission_id text,
  kind text,
  filename text,
  r2_key text,
  size_bytes integer,
  content_type text,
  previous_file_id text,
  version_no integer,
  uploaded_by_contact_id text,
  task_assignment_id text,
  created_at integer,
  updated_at integer
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

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const EVENT_A = "event-a";
const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

function fakeFilesBucket() {
  const store = new Map<string, unknown>();
  return {
    async get(key: string) {
      return store.has(key) ? { body: null, size: 0 } : null;
    },
    async put(key: string) {
      store.set(key, true);
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as R2Bucket;
}

async function buildApp(db: Db) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const bucket = fakeFilesBucket();
  app.use("*", async (c, next) => {
    c.set("auth", SPEAKER_A);
    c.set("db", db);
    c.env = { ...(c.env ?? {}), FILES: bucket } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

async function upload(app: Hono<AppEnv>, assignmentId: string, submissionId?: string) {
  const form = new FormData();
  form.set("chq_csrf", "tok-1");
  form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "slides.pdf", { type: "application/pdf" }));
  if (submissionId != null) form.set("submissionId", submissionId);
  return app.request(
    new Request(`http://test.local/portal/tasks/${assignmentId}/upload`, {
      method: "POST",
      headers: { cookie: "chq_csrf=tok-1" },
      body: form,
    }),
  );
}

describe("POST /portal/tasks/:assignmentId/upload — real route, real db round trip (CNT-04)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    const now = Date.now();
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values (?, ?, 'Event A', 'event-a', '2026-01-01', '2026-01-02', 'America/New_York', 'SES', ?, ?)`,
      )
      .run(EVENT_A, ORG_A, now, now);
    sqlite
      .prepare(`insert into contact (id, org_id, first_name, last_name, created_at, updated_at) values (?, ?, 'Speaker', 'One', ?, ?)`)
      .run(CONTACT_A, ORG_A, now, now);
  });

  afterEach(() => {
    sqlite.close();
  });

  function insertSubmission(id: string, seq: number) {
    const now = Date.now();
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values (?, ?, ?, 'Talk', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run(id, EVENT_A, seq, now, now);
  }

  function insertParticipant(submissionId: string) {
    const now = Date.now();
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
         values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
      )
      .run(newId(), submissionId, CONTACT_A, now, now);
  }

  function insertTask(id: string, deliverableKind: string | null) {
    const now = Date.now();
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, required, deliverable_kind, created_at, updated_at)
         values (?, ?, 'file_request', 'Upload slides', 1, ?, ?, ?)`,
      )
      .run(id, EVENT_A, deliverableKind, now, now);
  }

  function insertAssignment(id: string, taskId: string) {
    const now = Date.now();
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values (?, ?, ?, 'pending', ?, ?)`,
      )
      .run(id, taskId, CONTACT_A, now, now);
  }

  function fileRows() {
    return sqlite.prepare(`select id, previous_file_id as previousFileId, version_no as versionNo, kind, submission_id as submissionId from file order by created_at, id`).all() as Array<{
      id: string;
      previousFileId: string | null;
      versionNo: number;
      kind: string;
      submissionId: string | null;
    }>;
  }

  it("(a) a deliverableKind task re-uploaded twice for the SAME submission -> v1 + v2 chain, both files retained", async () => {
    insertSubmission("sub-1", 1);
    insertParticipant("sub-1");
    insertTask("task-1", "presentation");
    insertAssignment("assignment-1", "task-1");

    const app = await buildApp(db);
    const r1 = await upload(app, "assignment-1", "sub-1");
    expect(r1.status).toBe(302);
    const r2 = await upload(app, "assignment-1", "sub-1");
    expect(r2.status).toBe(302);

    const rows = fileRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.versionNo).toBe(1);
    expect(rows[0]!.previousFileId).toBeNull();
    expect(rows[1]!.versionNo).toBe(2);
    expect(rows[1]!.previousFileId).toBe(rows[0]!.id);
    expect(rows[1]!.kind).toBe("presentation");
    expect(rows[1]!.submissionId).toBe("sub-1");
  });

  it("(b) a deliverableKind===null handout task re-uploaded twice -> v1 + v2 chain, not two orphan v1s", async () => {
    insertTask("task-2", null);
    insertAssignment("assignment-2", "task-2");

    const app = await buildApp(db);
    const r1 = await upload(app, "assignment-2");
    expect(r1.status).toBe(302);
    const r2 = await upload(app, "assignment-2");
    expect(r2.status).toBe(302);

    const rows = fileRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.versionNo).toBe(1);
    expect(rows[0]!.previousFileId).toBeNull();
    expect(rows[1]!.versionNo).toBe(2);
    expect(rows[1]!.previousFileId).toBe(rows[0]!.id);
    expect(rows[1]!.kind).toBe("handout");
    expect(rows[1]!.submissionId).toBeNull();
  });

  it("(c) the speaker legitimately re-choosing a DIFFERENT eligible submission starts a correct fresh v1 (DEC-922 guard survives) and the redirect names the restart", async () => {
    insertSubmission("sub-1", 1);
    insertSubmission("sub-2", 2);
    insertParticipant("sub-1");
    insertParticipant("sub-2");
    insertTask("task-3", "presentation");
    insertAssignment("assignment-3", "task-3");

    const app = await buildApp(db);
    const r1 = await upload(app, "assignment-3", "sub-1");
    expect(r1.status).toBe(302);
    const r2 = await upload(app, "assignment-3", "sub-2");
    expect(r2.status).toBe(302);
    // The refused-chain outcome must be legible, not silent: the redirect
    // carries a marker the portal page renders as a plain line.
    expect(r2.headers.get("Location")).toContain("newSeries=");

    const rows = fileRows();
    expect(rows).toHaveLength(2);
    const v1 = rows.find((r) => r.submissionId === "sub-1")!;
    const v2 = rows.find((r) => r.submissionId === "sub-2")!;
    expect(v1.versionNo).toBe(1);
    expect(v1.previousFileId).toBeNull();
    // A fresh chain for the newly-chosen submission — NOT chained onto sub-1's file.
    expect(v2.versionNo).toBe(1);
    expect(v2.previousFileId).toBeNull();
  });
});
