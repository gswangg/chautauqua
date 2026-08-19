// Design pack v12's task view, server half: GET /api/v1/tasks/:id/roster
// (the "One task, every speaker" / "One task · still waiting" payload) and
// POST /api/v1/tasks/:id/unassign (the frame's "Not needed", which is
// UNASSIGNMENT -- `Marking a task not needed removes it for that speaker
// only · it stays on everyone else` -- not a third assignment status).
//
// Real rows: node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy over a
// hand-rolled DDL, mirroring test/tasks-assign-roster-scope.test.ts's
// harness, so the correlated EXISTS predicates (overdue, roster) and the
// email_log reminder-count aggregate are actually evaluated end to end
// through the real route handlers (no repo mocks in this file).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { taskRoutes } from "../src/routes/tasks";
import { REMINDER_SUBJECT_PREFIX } from "../src/server/repo/tasks/reminders";
import { newId } from "../src/domain/ids";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import type { TaskView } from "../src/server/repo/tasks/task-view";

const DDL = `
create table event (
  id text primary key, org_id text, name text, slug text, start_date text, end_date text,
  location text, timezone text, record_prefix text, branding_json text, created_at integer, updated_at integer
);
create table contact (
  id text primary key, org_id text, first_name text, last_name text, email text, phone text,
  company text, title text, bio text, headshot_url text, headshot_file_id text, social_links_json text,
  notes text, custom_fields_json text, external_ref text, created_at integer, updated_at integer
);
create table user (
  id text primary key, org_id text, email text, password_hash text, role text, name text,
  contact_id text, created_at integer, updated_at integer
);
create table submission (
  id text primary key, event_id text, form_id text, seq integer, title text, description text,
  track_id text, additional_track_ids_json text, status text, content_status text, accepted_at integer,
  ics_sequence integer, external_ref text, created_at integer, updated_at integer
);
create table participant (
  id text primary key, submission_id text, contact_id text, role text, "order" integer, visible integer,
  invite_status text, title_at_time text, org_at_time text, created_at integer, updated_at integer
);
create table task (
  id text primary key, event_id text, kind text, title text, description text, due_date integer,
  required integer, form_id text, deliverable_kind text, instructions text, audience text,
  created_at integer, updated_at integer
);
create table task_assignment (
  id text primary key, task_id text, contact_id text, status text, completed_at integer,
  completed_by text, response_json text, file_id text, last_reminded_at integer,
  created_at integer, updated_at integer, unique (task_id, contact_id)
);
create table file (
  id text primary key, submission_id text, kind text, filename text, r2_key text, size_bytes integer,
  content_type text, previous_file_id text, version_no integer, uploaded_by_contact_id text, created_at integer
);
create table form_field (
  id text primary key, form_id text, section text, kind text, label text, help_text text,
  required integer, position integer, options_json text, rule_json text, locked integer, role text,
  created_at integer, updated_at integer
);
create table email_log (
  id text primary key, event_id text, template_id text, contact_id text, batch_id text, to_email text,
  subject text, body_text text, body_html text, ics_text text, ics_filename text, provider text,
  status text, sent_at integer, created_at integer
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

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const ORG = "org-1";
const OTHER_ORG = "org-2";
const EVENT = "event-1";
const TASK = "task-1";
const FORM = "form-1";
const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG };

function insertEvent(sqlite: DatabaseSync, id = EVENT, orgId = ORG) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, 'DevFlow Conf 2027', 'devflow', '2027-05-11', '2027-05-14', 'UTC', 'SES', ?, ?)`,
    )
    .run(id, orgId, NOW, NOW);
}

function insertFormTask(sqlite: DatabaseSync, dueDate: number | null) {
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, due_date, required, form_id, created_at, updated_at)
       values (?, ?, 'form', 'Hotel stay form', ?, 1, ?, ?, ?)`,
    )
    .run(TASK, EVENT, dueDate, FORM, NOW, NOW);
  // Two fields, deliberately inserted out of position order so the summary
  // proves it reads FORM-FIELD order, not JSON key order.
  sqlite
    .prepare(
      `insert into form_field (id, form_id, section, kind, label, required, position, locked, created_at, updated_at)
       values (?, ?, 'speaker', 'text', ?, 0, ?, 0, ?, ?)`,
    )
    .run("f-nights", FORM, "Nights", 1, NOW, NOW);
  sqlite
    .prepare(
      `insert into form_field (id, form_id, section, kind, label, required, position, locked, created_at, updated_at)
       values (?, ?, 'speaker', 'text', ?, 0, ?, 0, ?, ?)`,
    )
    .run("f-room", FORM, "Room needed", 0, NOW, NOW);
}

function insertRosterContact(sqlite: DatabaseSync, id: string, firstName: string, orgId = ORG, eventId = EVENT) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, company, created_at, updated_at)
       values (?, ?, ?, 'Speaker', ?, 'Latticework', ?, ?)`,
    )
    .run(id, orgId, firstName, `${firstName.toLowerCase()}@example.com`, NOW, NOW);
  const submissionId = `sub-${id}`;
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
       values (?, ?, 1, 'Talk', 'accepted', 'pending', 0, ?, ?)`,
    )
    .run(submissionId, eventId, NOW, NOW);
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
    )
    .run(newId(), submissionId, id, NOW, NOW);
}

interface AssignOpts {
  status?: string;
  completedAt?: number | null;
  responseJson?: string | null;
  fileId?: string | null;
  lastRemindedAt?: number | null;
  createdAt?: number;
}

function assign(sqlite: DatabaseSync, contactId: string, opts: AssignOpts = {}) {
  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, completed_at, response_json, file_id, last_reminded_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `as-${contactId}`,
      TASK,
      contactId,
      opts.status ?? "pending",
      opts.completedAt ?? null,
      opts.responseJson ?? null,
      opts.fileId ?? null,
      opts.lastRemindedAt ?? null,
      opts.createdAt ?? NOW - 30 * DAY,
      NOW,
    );
}

function logReminder(sqlite: DatabaseSync, contactId: string, sentAt: number, subject = `${REMINDER_SUBJECT_PREFIX}DevFlow Conf 2027`) {
  sqlite
    .prepare(
      `insert into email_log (id, event_id, contact_id, to_email, subject, body_text, provider, status, sent_at, created_at)
       values (?, ?, ?, 'x@example.com', ?, 'body', 'dev', 'sent', ?, ?)`,
    )
    .run(newId(), EVENT, contactId, subject, sentAt, sentAt);
}

function countAssignments(sqlite: DatabaseSync): number {
  return (sqlite.prepare(`select count(*) as n from task_assignment`).get() as { n: number }).n;
}

async function buildApp(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    await next();
  });
  app.route("/api/v1", taskRoutes);
  return app;
}

function unassignRequest(contactIds: unknown[]) {
  return new Request(`http://test/api/v1/tasks/${TASK}/unassign`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ contactIds }),
  });
}

describe("design pack v12 task view: GET /tasks/:id/roster", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite);
    // Due five days ago, so a still-pending assignment created a month ago
    // is genuinely overdue under DEC-801's day-label rule.
    insertFormTask(sqlite, NOW - 5 * DAY);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("(a) splits answered from waiting, reads the saved answers in FORM-FIELD order, and flags the overdue row", async () => {
    insertRosterContact(sqlite, "c-priya", "Priya");
    insertRosterContact(sqlite, "c-ruth", "Ruth");
    assign(sqlite, "c-priya", {
      status: "complete",
      completedAt: NOW - 2 * DAY,
      responseJson: JSON.stringify({ "f-room": "No room needed", "f-nights": "Two nights" }),
    });
    assign(sqlite, "c-ruth");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(`http://test/api/v1/tasks/${TASK}/roster`);
    expect(res.status).toBe(200);
    const view = (await res.json()) as TaskView;

    expect(view.task.title).toBe("Hotel stay form");
    expect(view.task.eventId).toBe(EVENT);
    expect(view.timezone).toBe("UTC");
    expect(view.counts).toEqual({ assigned: 2, complete: 1, pending: 1, answered: 1 });

    const priya = view.rows.find((r) => r.contactId === "c-priya")!;
    // position 1 is "Nights", position 0 is "Room needed" -- the summary
    // must read them in position order, not in the JSON's key order.
    expect(priya.answerSummary).toBe("No room needed · Two nights");
    expect(priya.status).toBe("complete");
    expect(priya.overdue).toBe(false);

    const ruth = view.rows.find((r) => r.contactId === "c-ruth")!;
    expect(ruth.answerSummary).toBeNull();
    expect(ruth.overdue).toBe(true);
  });

  it("(b) counts reminder sends per speaker out of email_log, bounded to the assignment's own live window", async () => {
    insertRosterContact(sqlite, "c-ruth", "Ruth");
    insertRosterContact(sqlite, "c-marcus", "Marcus");
    insertRosterContact(sqlite, "c-tomas", "Tomas");
    assign(sqlite, "c-ruth", { lastRemindedAt: NOW - 10 * DAY });
    assign(sqlite, "c-marcus", { lastRemindedAt: NOW - 10 * DAY });
    assign(sqlite, "c-tomas");

    logReminder(sqlite, "c-ruth", NOW - 20 * DAY);
    logReminder(sqlite, "c-ruth", NOW - 15 * DAY);
    logReminder(sqlite, "c-ruth", NOW - 10 * DAY);
    logReminder(sqlite, "c-marcus", NOW - 10 * DAY);
    // Not a reminder -- a compose/blast to the same contact must never
    // inflate the count.
    logReminder(sqlite, "c-tomas", NOW - 9 * DAY, "Your session is scheduled");
    // A reminder sent BEFORE the assignment existed cannot have named it.
    logReminder(sqlite, "c-tomas", NOW - 90 * DAY);

    const app = await buildApp(db, ORGANIZER);
    const view = (await (await app.request(`http://test/api/v1/tasks/${TASK}/roster`)).json()) as TaskView;
    const byContact = new Map(view.rows.map((r) => [r.contactId, r]));

    expect(byContact.get("c-ruth")!.remindCount).toBe(3);
    expect(byContact.get("c-marcus")!.remindCount).toBe(1);
    expect(byContact.get("c-tomas")!.remindCount).toBe(0);
    expect(byContact.get("c-tomas")!.lastRemindedAt).toBeNull();
    // The header's aggregate ("4 reminder sends") is the sum of these.
    expect(view.rows.reduce((n, r) => n + r.remindCount, 0)).toBe(4);
  });

  it("(c) a task in another org 404s exactly like one that does not exist", async () => {
    insertEvent(sqlite, "event-other", OTHER_ORG);
    sqlite
      .prepare(`insert into task (id, event_id, kind, title, required, created_at, updated_at) values ('task-other', 'event-other', 'general', 'Other', 1, ?, ?)`)
      .run(NOW, NOW);

    const app = await buildApp(db, ORGANIZER);
    expect((await app.request(`http://test/api/v1/tasks/task-other/roster`)).status).toBe(404);
    expect((await app.request(`http://test/api/v1/tasks/task-nonexistent/roster`)).status).toBe(404);
  });
});

describe('design pack v12 task view: POST /tasks/:id/unassign ("Not needed")', () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite);
    insertFormTask(sqlite, NOW + 5 * DAY);
    insertRosterContact(sqlite, "c-ruth", "Ruth");
    insertRosterContact(sqlite, "c-marcus", "Marcus");
    assign(sqlite, "c-ruth");
    assign(sqlite, "c-marcus");
  });

  afterEach(() => {
    sqlite.close();
  });

  it("(a) removes the task for exactly the named speakers, leaves everyone else, and echoes the refreshed view", async () => {
    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(unassignRequest(["c-ruth"]));
    expect(res.status).toBe(200);

    const view = (await res.json()) as TaskView;
    expect(view.rows.map((r) => r.contactId)).toEqual(["c-marcus"]);
    expect(view.counts.assigned).toBe(1);
    expect(countAssignments(sqlite)).toBe(1);

    // Nothing about the task itself changed -- this is unassignment, not a
    // status and not a delete.
    const task = sqlite.prepare(`select title, due_date from task where id = ?`).get(TASK) as { title: string };
    expect(task.title).toBe("Hotel stay form");
  });

  it("(b) a contact in another org is refused with the stale-selection sentence and writes nothing", async () => {
    sqlite
      .prepare(`insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values ('c-foreign', ?, 'Grace', 'Hopper', 'g@x.com', ?, ?)`)
      .run(OTHER_ORG, NOW, NOW);

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(unassignRequest(["c-foreign"]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.contactIds).not.toContain("c-foreign");
    expect(countAssignments(sqlite)).toBe(2);
  });

  it("(c) a contact who does not hold this task is refused atomically -- a partial removal never lands", async () => {
    insertRosterContact(sqlite, "c-wei", "Wei");

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(unassignRequest(["c-ruth", "c-wei"]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.fields?.contactIds).toContain("Ruth Speaker");
    // Ruth's row survives: the batch was refused before any delete ran.
    expect(countAssignments(sqlite)).toBe(2);
  });

  it("(d) a speaker whose submission has left 'accepted' can still be removed -- removal is not gated on the roster", async () => {
    sqlite.prepare(`update submission set status = 'withdrawn' where id = 'sub-c-ruth'`).run();

    const app = await buildApp(db, ORGANIZER);
    const res = await app.request(unassignRequest(["c-ruth"]));
    expect(res.status).toBe(200);
    expect(countAssignments(sqlite)).toBe(1);
  });
});
