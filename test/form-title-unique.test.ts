// DEC-111 amendment (wave 55): form_event_id_title_idx (migrations/0033_
// form_title_unique.sql) makes an event's form titles a real DB constraint.
// getOrCreateFormTaskForm (src/server/repo/submissions/status.ts) becomes
// insert-on-conflict-do-nothing then select (like getOrCreateTask already
// was), so a race between two concurrent acceptances resolves to one form
// row instead of orphaning the loser's form_field rows. Runs against a real
// in-memory SQLite engine (same technique as test/task-title-unique.test.ts)
// so the actual repo queries — including the ON CONFLICT clause — are
// exercised, not simulated.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import { ensureOnboardingTasks } from "../src/server/repo/submissions/status";
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
  form_id text,
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

describe("getOrCreateFormTaskForm race (DEC-111 amendment, wave 55): a concurrent writer already won", () => {
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

  it("a pre-existing form for the template title (simulating the other side of the race already committing) is reused -- exactly one form row, its fields are not re-seeded, and the task attaches to it", async () => {
    const now = Date.now();
    // Simulate: another concurrent acceptance already inserted this
    // template's backing form AND its field rows between our own read and
    // write.
    const preExistingFormId = "form-already-there";
    sqlite.exec(
      `insert into form (id, event_id, title, is_default, created_at, updated_at)
       values ('${preExistingFormId}', '${eventId}', 'Hotel stay requirement form', 0, ${now}, ${now})`,
    );
    sqlite.exec(
      `insert into form_field (id, form_id, section, kind, label, required, position, created_at, updated_at)
       values ('field-already-there', '${preExistingFormId}', 'speaker', 'long_text', 'Bio', 1, 0, ${now}, ${now})`,
    );

    const contactId = "contact-1";
    await ensureOnboardingTasks(db, eventId, "sub-1", [contactId], new Date());

    const formRows = sqlite.prepare("select id from form where event_id = ? and title = ?").all(eventId, "Hotel stay requirement form") as {
      id: string;
    }[];
    // Exactly one form row -- the race did not mint a duplicate.
    expect(formRows).toHaveLength(1);
    expect(formRows[0]!.id).toBe(preExistingFormId);

    // No second set of field rows was inserted onto the winner.
    const fieldRows = sqlite.prepare("select id from form_field where form_id = ?").all(preExistingFormId) as { id: string }[];
    expect(fieldRows).toHaveLength(1);

    const taskRows = sqlite.prepare("select form_id from task where event_id = ? and title = ?").all(eventId, "Hotel stay requirement form") as {
      form_id: string;
    }[];
    expect(taskRows).toHaveLength(1);
    expect(taskRows[0]!.form_id).toBe(preExistingFormId);
  });

  it("two sequential ensureOnboardingTasks calls for the same event/contact never mint a second form row per title", async () => {
    const contactId = "contact-1";
    await ensureOnboardingTasks(db, eventId, "sub-1", [contactId], new Date());
    await ensureOnboardingTasks(db, eventId, "sub-1", [contactId], new Date());

    const rows = sqlite.prepare("select title, count(*) as c from form where event_id = ? group by title").all(eventId) as {
      title: string;
      c: number;
    }[];
    for (const row of rows) {
      expect(row.c).toBe(1);
    }
  });
});

describe("migrations/0033_form_title_unique.sql dedupe (DEC-111 amendment, wave 55)", () => {
  const migrationSql = readFileSync(join(__dirname, "..", "migrations", "0033_form_title_unique.sql"), "utf8");

  // A separate DDL, WITHOUT the unique index, so the migration's own
  // CREATE UNIQUE INDEX statement (parsed straight from the file) is what
  // adds the constraint -- proving the dedupe ran first.
  const PRE_MIGRATION_DDL = `
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
      created_at integer,
      updated_at integer
    );
    create table submission (
      id text primary key,
      event_id text,
      status text,
      form_id text,
      accepted_at integer,
      created_at integer,
      updated_at integer
    );
  `;

  function seedDuplicateForms(sqlite: DatabaseSync) {
    // Two duplicate "Hotel stay requirement form" form rows on event-1 -- form-a (older,
    // keeper) and form-b (younger, loser).
    sqlite.exec(`insert into form (id, event_id, title, is_default, created_at, updated_at) values
      ('form-a', 'event-1', 'Hotel stay requirement form', 0, 100, 100),
      ('form-b', 'event-1', 'Hotel stay requirement form', 0, 200, 200)`);

    // form-a has one field, form-b has a different field -- both must
    // survive, now all pointing at the keeper.
    sqlite.exec(`insert into form_field (id, form_id, section, kind, label, required, position, created_at, updated_at) values
      ('field-a', 'form-a', 'speaker', 'text', 'Name', 1, 0, 100, 100),
      ('field-b', 'form-b', 'speaker', 'long_text', 'Bio', 1, 0, 200, 200)`);

    // A task attached to the loser must be repointed to the keeper.
    sqlite.exec(`insert into task (id, event_id, kind, title, form_id, required, created_at, updated_at) values
      ('task-1', 'event-1', 'form', 'Hotel stay requirement form', 'form-b', 1, 100, 100)`);

    // A submission attached to the loser must be repointed to the keeper.
    sqlite.exec(`insert into submission (id, event_id, status, form_id, created_at, updated_at) values
      ('sub-1', 'event-1', 'pending', 'form-b', 100, 100)`);
  }

  it("dedupes onto the oldest row, repoints every field/task/submission reference, and deletes only the loser form row", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(PRE_MIGRATION_DDL);
    seedDuplicateForms(sqlite);

    sqlite.exec(migrationSql);

    // Exactly one "Hotel stay requirement form" form remains for event-1, and it's the
    // older row (form-a).
    const forms = sqlite.prepare("select id from form where event_id = ? and title = ?").all("event-1", "Hotel stay requirement form") as {
      id: string;
    }[];
    expect(forms).toHaveLength(1);
    expect(forms[0]!.id).toBe("form-a");

    // Both field rows survive, both now pointing at the keeper.
    const fields = sqlite.prepare("select id, form_id from form_field order by id").all() as { id: string; form_id: string }[];
    expect(fields.map((f) => f.id)).toEqual(["field-a", "field-b"]);
    for (const f of fields) {
      expect(f.form_id).toBe("form-a");
    }

    // The task and submission that pointed at the loser now point at the
    // keeper.
    const task = sqlite.prepare("select form_id from task where id = 'task-1'").get() as { form_id: string };
    expect(task.form_id).toBe("form-a");
    const submission = sqlite.prepare("select form_id from submission where id = 'sub-1'").get() as { form_id: string };
    expect(submission.form_id).toBe("form-a");

    // Nothing beyond the loser form row was deleted.
    const remainingForms = sqlite.prepare("select id from form").all() as { id: string }[];
    expect(remainingForms.map((f) => f.id)).toEqual(["form-a"]);

    // The unique index now exists and actually enforces the constraint.
    expect(() => {
      sqlite.exec(
        `insert into form (id, event_id, title, is_default, created_at, updated_at)
         values ('form-c', 'event-1', 'Hotel stay requirement form', 0, 999, 999)`,
      );
    }).toThrow(/UNIQUE constraint failed/i);

    sqlite.close();
  });

  it("a different event's same-titled form is untouched", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(PRE_MIGRATION_DDL);
    seedDuplicateForms(sqlite);
    sqlite.exec(`insert into form (id, event_id, title, is_default, created_at, updated_at) values
      ('form-other-event', 'event-2', 'Hotel stay requirement form', 0, 100, 100)`);

    sqlite.exec(migrationSql);

    const rows = sqlite.prepare("select id from form where event_id = 'event-2'").all() as { id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("form-other-event");

    sqlite.close();
  });

  it("is re-runnable: applying it twice on an already-deduped set is a no-op", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(PRE_MIGRATION_DDL);
    seedDuplicateForms(sqlite);
    sqlite.exec(migrationSql);

    const beforeForms = sqlite.prepare("select id from form").all();
    const beforeFields = sqlite.prepare("select id, form_id from form_field order by id").all();

    // Re-running the dedupe prefix (everything before the final CREATE
    // UNIQUE INDEX, which would otherwise error on an already-existing
    // index -- the production runner only ever applies a migration once,
    // tracked in d1_migrations, matching migrations/0032's precedent).
    const dedupeOnly = migrationSql.slice(0, migrationSql.search(/CREATE\s+UNIQUE\s+INDEX/i));
    sqlite.exec(dedupeOnly);

    const afterForms = sqlite.prepare("select id from form").all();
    const afterFields = sqlite.prepare("select id, form_id from form_field order by id").all();
    expect(afterForms).toEqual(beforeForms);
    expect(afterFields).toEqual(beforeFields);
  });

  it("de-collides before creating the unique index and never uses CREATE TEMP TABLE (shape check, mirrors migrations/0032's test)", () => {
    expect(migrationSql).not.toMatch(/CREATE\s+TEMP(?:ORARY)?\s+TABLE/i);
    const createIdx = migrationSql.search(/CREATE\s+UNIQUE\s+INDEX\s+`form_event_id_title_idx`/i);
    const firstMutationIdx = migrationSql.search(/UPDATE|DELETE/i);
    expect(firstMutationIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(firstMutationIdx);
  });
});
