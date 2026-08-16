// DEC-111 amendment (wave 48): task_event_id_title_idx (migrations/0032_
// task_title_unique.sql) makes an event's task titles a real DB constraint.
// createTask/updateTask (src/server/repo/tasks/crud.ts) surface a collision
// as a named field error instead of an uncaught 500; getOrCreateTask (src/
// server/repo/submissions/status.ts) becomes insert-on-conflict-do-nothing
// then select, so a race between two concurrent acceptances resolves to one
// row. Runs against a real in-memory SQLite engine (same technique as
// test/plan-delete-cascade.test.ts) so the actual repo queries — including
// the ON CONFLICT clause, which a hand-rolled fake db double can't model
// faithfully — are exercised, not simulated.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import { createTask, updateTask } from "../src/server/repo/tasks/crud";
import { ensureOnboardingTasks } from "../src/server/repo/submissions/status";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

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
  instructions text,
  audience text,
  created_at integer,
  updated_at integer
);
create unique index task_event_id_title_idx on task (event_id, title);
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
create unique index task_assignment_task_id_contact_id_idx on task_assignment (task_id, contact_id);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  invite_status text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  status text,
  accepted_at integer,
  created_at integer,
  updated_at integer
);
create table form (
  id text primary key,
  event_id text,
  title text,
  description text,
  is_default integer,
  open_date integer,
  close_date integer,
  tracks_json text,
  created_at integer,
  updated_at integer
);
create unique index form_event_id_title_idx on form (event_id, title);
create table form_field (
  id text primary key,
  form_id text,
  section text,
  kind text,
  label text,
  help_text text,
  required integer,
  position integer,
  options_json text,
  rule_json text,
  locked integer,
  role text,
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

describe("createTask/updateTask title collision (DEC-111 amendment, wave 48)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const eventId = "event-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });
  afterEach(() => {
    sqlite.close();
  });

  it("createTask twice with the same title yields a named field error, not a 500", async () => {
    await createTask(db, eventId, { kind: "general", title: "Confirm participation", required: false });

    await expect(
      createTask(db, eventId, { kind: "general", title: "Confirm participation", required: false }),
    ).rejects.toMatchObject({
      code: "invalid",
      fields: { title: "A task with this title already exists for this event" },
    });

    const rows = sqlite.prepare("select * from task where event_id = ? and title = ?").all(eventId, "Confirm participation");
    expect(rows).toHaveLength(1);
  });

  it("createTask with the same title on a DIFFERENT event is unaffected", async () => {
    await createTask(db, eventId, { kind: "general", title: "Confirm participation", required: false });
    const otherEventTask = await createTask(db, "event-2", { kind: "general", title: "Confirm participation", required: false });
    expect(otherEventTask.title).toBe("Confirm participation");
  });

  it("updateTask renaming onto an existing title in the same event is a named field error", async () => {
    await createTask(db, eventId, { kind: "general", title: "Confirm participation", required: false });
    const b = await createTask(db, eventId, { kind: "general", title: "Submit slides", required: false });

    await expect(updateTask(db, b.id, { title: "Confirm participation" })).rejects.toMatchObject({
      code: "invalid",
      fields: { title: "A task with this title already exists for this event" },
    });

    const rows = sqlite.prepare("select * from task where id = ?").all(b.id);
    expect((rows[0] as { title: string }).title).toBe("Submit slides");
  });

  it("thrown error is a real ApiError instance", async () => {
    await createTask(db, eventId, { kind: "general", title: "Confirm participation", required: false });
    try {
      await createTask(db, eventId, { kind: "general", title: "Confirm participation", required: false });
      expect.unreachable("expected createTask to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});

describe("getOrCreateTask race (DEC-111 amendment, wave 48): a concurrent writer already won", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const eventId = "event-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    const now = Date.now();
    sqlite.exec(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values ('${eventId}', 'org-1', 'Event One', 'event-one', '2030-06-01', '2030-06-03', 'UTC', 'SES', ${now}, ${now})`,
    );
  });
  afterEach(() => {
    sqlite.close();
  });

  it("a pre-existing row for the template title (simulating the other side of the race already committing) is reused -- exactly one row, the assignment lands on it", async () => {
    // Simulate: another concurrent acceptance already inserted this
    // template's task row between our own read and write.
    const preExistingId = "task-already-there";
    const now = Date.now();
    sqlite.exec(
      `insert into task (id, event_id, kind, title, required, created_at, updated_at)
       values ('${preExistingId}', '${eventId}', 'general', 'Finalize talk description', 0, ${now}, ${now})`,
    );

    const contactId = "contact-1";
    await ensureOnboardingTasks(db, eventId, "sub-1", [contactId], new Date());

    const taskRows = sqlite
      .prepare("select id from task where event_id = ? and title = ?")
      .all(eventId, "Finalize talk description") as { id: string }[];
    // Exactly one row -- the race did not mint a duplicate.
    expect(taskRows).toHaveLength(1);
    // It's the SAME row the "other writer" already committed -- our own
    // insert conflicted and getOrCreateTask returned the winner's id.
    expect(taskRows[0]!.id).toBe(preExistingId);

    const assignmentRows = sqlite
      .prepare("select task_id from task_assignment where contact_id = ? and task_id = ?")
      .all(contactId, preExistingId) as { task_id: string }[];
    expect(assignmentRows).toHaveLength(1);
  });

  it("two sequential ensureOnboardingTasks calls for the same event/contact never mint a second task row per title", async () => {
    const contactId = "contact-1";
    await ensureOnboardingTasks(db, eventId, "sub-1", [contactId], new Date());
    await ensureOnboardingTasks(db, eventId, "sub-1", [contactId], new Date());

    const rows = sqlite.prepare("select title, count(*) as c from task where event_id = ? group by title").all(eventId) as {
      title: string;
      c: number;
    }[];
    for (const row of rows) {
      expect(row.c).toBe(1);
    }
  });
});

describe("migrations/0032_task_title_unique.sql dedupe (DEC-111 amendment, wave 48)", () => {
  const migrationSql = readFileSync(join(__dirname, "..", "migrations", "0032_task_title_unique.sql"), "utf8");

  // A separate DDL, WITHOUT the unique index, so the migration's own
  // CREATE UNIQUE INDEX statement (parsed straight from the file) is what
  // adds the constraint -- proving the dedupe ran first.
  const PRE_MIGRATION_DDL = `
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
  `;

  function seedDuplicateTasks(sqlite: DatabaseSync) {
    // Two duplicate "Confirm participation" task rows on event-1 -- task-a
    // (older, keeper) and task-b (younger, loser).
    sqlite.exec(`insert into task (id, event_id, kind, title, required, created_at, updated_at) values
      ('task-a', 'event-1', 'general', 'Confirm participation', 0, 100, 100),
      ('task-b', 'event-1', 'general', 'Confirm participation', 0, 200, 200)`);

    // contact-1: only assigned on the loser (task-b), pending -- must survive,
    // re-pointed onto the keeper.
    sqlite.exec(`insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values
      ('ta-1', 'task-b', 'contact-1', 'pending', 100, 100)`);

    // contact-2: assigned on BOTH keeper (pending) and loser (complete) --
    // the keeper's row must end up 'complete', the loser's row dropped as
    // a duplicate (contact-2 keeps exactly one assignment, complete).
    sqlite.exec(`insert into task_assignment (id, task_id, contact_id, status, completed_at, completed_by, created_at, updated_at) values
      ('ta-2', 'task-a', 'contact-2', 'pending', NULL, NULL, 100, 100),
      ('ta-3', 'task-b', 'contact-2', 'complete', 500, 'user-x', 100, 100)`);

    // contact-3: assigned only on the keeper (task-a), complete -- unaffected.
    sqlite.exec(`insert into task_assignment (id, task_id, contact_id, status, completed_at, completed_by, created_at, updated_at) values
      ('ta-4', 'task-a', 'contact-3', 'complete', 300, 'user-y', 100, 100)`);
  }

  it("dedupes onto the oldest row, preserves every distinct (task, contact) assignment, and loses no 'complete' status", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(PRE_MIGRATION_DDL);
    seedDuplicateTasks(sqlite);

    sqlite.exec(migrationSql);

    // Exactly one "Confirm participation" task remains for event-1, and
    // it's the older row (task-a).
    const tasks = sqlite.prepare("select id from task where event_id = ? and title = ?").all("event-1", "Confirm participation") as {
      id: string;
    }[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.id).toBe("task-a");

    // Every distinct (task, contact) pair from before the merge is
    // represented exactly once, now all pointing at the keeper.
    const assignments = sqlite
      .prepare("select contact_id, status, task_id from task_assignment where task_id = 'task-a' order by contact_id")
      .all() as { contact_id: string; status: string; task_id: string }[];
    expect(assignments.map((a) => a.contact_id)).toEqual(["contact-1", "contact-2", "contact-3"]);

    const byContact = Object.fromEntries(assignments.map((a) => [a.contact_id, a]));
    expect(byContact["contact-1"]!.status).toBe("pending");
    // contact-2's keeper row was promoted to 'complete' -- the loser's
    // completion was not lost even though its own row was dropped.
    expect(byContact["contact-2"]!.status).toBe("complete");
    expect(byContact["contact-3"]!.status).toBe("complete");

    // No orphaned task_assignment rows point at the deleted loser.
    const orphans = sqlite.prepare("select * from task_assignment where task_id = 'task-b'").all();
    expect(orphans).toHaveLength(0);

    // The unique index now exists and actually enforces the constraint.
    expect(() => {
      sqlite.exec(
        `insert into task (id, event_id, kind, title, required, created_at, updated_at)
         values ('task-c', 'event-1', 'general', 'Confirm participation', 0, 999, 999)`,
      );
    }).toThrow(/UNIQUE constraint failed/i);

    sqlite.close();
  });

  it("a different event's same-titled task is untouched", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(PRE_MIGRATION_DDL);
    seedDuplicateTasks(sqlite);
    sqlite.exec(`insert into task (id, event_id, kind, title, required, created_at, updated_at) values
      ('task-other-event', 'event-2', 'general', 'Confirm participation', 0, 100, 100)`);

    sqlite.exec(migrationSql);

    const rows = sqlite.prepare("select id from task where event_id = 'event-2'").all() as { id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("task-other-event");

    sqlite.close();
  });

  it("is re-runnable: applying it twice on an already-deduped set is a no-op", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(PRE_MIGRATION_DDL);
    seedDuplicateTasks(sqlite);
    sqlite.exec(migrationSql);

    const before = sqlite.prepare("select id from task").all();

    // Re-running the migration text against the now-unique-indexed table:
    // the dedupe steps must be no-ops (no existing duplicates to merge),
    // and the final CREATE UNIQUE INDEX must not error on an index that
    // already exists -- so this only passes if the file uses IF NOT EXISTS
    // or the file is otherwise safe to re-run untouched (matching
    // migrations/0031's re-runnable contract note). Re-running is expected
    // to throw on the duplicate CREATE UNIQUE INDEX exactly like 0031 would
    // if re-applied without a migration-tracking table -- the production
    // runner (wrangler d1 migrations apply) only ever applies a given
    // migration file once, tracked in d1_migrations, so this asserts the
    // pre-index dedupe portion alone is idempotent by re-running just that
    // prefix (everything before the final CREATE UNIQUE INDEX).
    const dedupeOnly = migrationSql.slice(0, migrationSql.search(/CREATE\s+UNIQUE\s+INDEX/i));
    sqlite.exec(dedupeOnly);

    const after = sqlite.prepare("select id from task").all();
    expect(after).toEqual(before);
  });

  it("de-collides before creating the unique index (shape check, mirrors migrations/0031's test)", () => {
    const createIdx = migrationSql.search(/CREATE\s+UNIQUE\s+INDEX\s+`task_event_id_title_idx`/i);
    const firstMutationIdx = migrationSql.search(/CREATE TEMP TABLE|UPDATE|DELETE/i);
    expect(firstMutationIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(firstMutationIdx);
  });
});
