// DEC-111 amendment (wave 55): form_event_id_title_idx (migrations/0033_
// form_title_unique.sql) makes an event's form titles a real DB constraint.
// getOrCreateFormTaskForm (src/server/repo/submissions/status.ts) becomes
// insert-on-conflict-do-nothing then select (like getOrCreateTask already
// was), so a race between two concurrent acceptances resolves to one form
// row instead of orphaning the loser's form_field rows. Runs against a real
// in-memory SQLite engine (same technique as test/task-title-unique.test.ts)
// so the actual repo queries — including the ON CONFLICT clause — are
// exercised, not simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
      updated_at integer,
      scope text NOT NULL DEFAULT 'person',
      accepted_types_json text,
      max_size_mb integer,
      max_files integer
    );
    create table submission (
      id text primary key,
      event_id text,
      status text,
      form_id text,
      accepted_at integer,
      created_at integer,
      updated_at integer,
      origin text NOT NULL DEFAULT 'cfp'
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
