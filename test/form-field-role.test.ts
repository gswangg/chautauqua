// DEC-592 amendment (wave 10, task w10-a): the form_field.role column and
// createDefaultForm's two role-tagged fields (Format/Audience level),
// against a real-SQLite harness migrated through every migrations/*.sql
// file (mirroring test/content-reupload-reopens.test.ts's technique).

import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import { getOrCreateForm } from "../src/server/repo/forms";
import { answerFieldRoleCondition, getEventFieldIdByRole, getFieldOptionsByRole } from "../src/server/repo/form-roles";
import { sql, eq } from "drizzle-orm";

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

function seedEvent(sqlite: DatabaseSync, eventId: string, slug: string) {
  const now = Date.now();
  sqlite.prepare(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`).run(ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
       values (?, ?, 'Event', ?, '2026-01-01', '2026-01-02', 'America/New_York', ?, ?)`,
    )
    .run(eventId, ORG_ID, slug, now, now);
}

describe("form_field.role (DEC-592 amendment)", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
  });

  it("createDefaultForm mints exactly one field per role with DEC-755 options, required:false", async () => {
    seedEvent(sqlite, EVENT_ID, "event-1");
    const { fields } = await getOrCreateForm(db, EVENT_ID);

    const formatFields = fields.filter((f) => f.role === "session_format");
    const audienceFields = fields.filter((f) => f.role === "audience_level");
    expect(formatFields).toHaveLength(1);
    expect(audienceFields).toHaveLength(1);

    expect(formatFields[0]!.options).toEqual([
      "Keynote (45 min)",
      "Talk (30 min)",
      "Lightning talk (10 min)",
      "Workshop (90 min)",
      "Panel (45 min)",
    ]);
    expect(formatFields[0]!.required).toBe(false);
    expect(formatFields[0]!.section).toBe("session");
    expect(formatFields[0]!.kind).toBe("dropdown");
    expect(formatFields[0]!.locked).toBe(false);

    expect(audienceFields[0]!.options).toEqual(["Beginner", "Intermediate", "Advanced"]);
    expect(audienceFields[0]!.required).toBe(false);

    // Ordinary fields carry no role.
    const untagged = fields.filter((f) => f.role == null);
    expect(untagged.length).toBe(fields.length - 2);
  });

  it("getEventFieldIdByRole / getFieldOptionsByRole resolve the minted fields", async () => {
    seedEvent(sqlite, EVENT_ID, "event-1");
    const { fields } = await getOrCreateForm(db, EVENT_ID);
    const formatField = fields.find((f) => f.role === "session_format")!;
    const audienceField = fields.find((f) => f.role === "audience_level")!;

    expect(await getEventFieldIdByRole(db, EVENT_ID, "session_format")).toBe(formatField.id);
    expect(await getEventFieldIdByRole(db, EVENT_ID, "audience_level")).toBe(audienceField.id);

    expect(await getFieldOptionsByRole(db, EVENT_ID, "session_format")).toEqual(formatField.options);
    expect(await getFieldOptionsByRole(db, EVENT_ID, "audience_level")).toEqual(audienceField.options);
  });

  it("returns null when the event's form has no field of that role", async () => {
    const otherEventId = "event-2";
    seedEvent(sqlite, otherEventId, "event-2");
    const now = Date.now();
    const formId = newId();
    sqlite
      .prepare(
        `insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'Call for Papers', 1, ?, ?)`,
      )
      .run(formId, otherEventId, now, now);
    // No form_field rows at all on this form.

    expect(await getEventFieldIdByRole(db, otherEventId, "session_format")).toBeNull();
    expect(await getFieldOptionsByRole(db, otherEventId, "session_format")).toBeNull();
  });

  it("answerFieldRoleCondition selects only answers whose field carries the role", async () => {
    seedEvent(sqlite, EVENT_ID, "event-1");
    const { form, fields } = await getOrCreateForm(db, EVENT_ID);
    const formatField = fields.find((f) => f.role === "session_format")!;
    const titleField = fields.find((f) => f.id.endsWith(":title"))!;

    const now = Date.now();
    const submissionId = newId();
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, created_at, updated_at) values (?, ?, 1, 'Talk', 'submitted', ?, ?)`,
      )
      .run(submissionId, EVENT_ID, now, now);

    const formatAnswerId = newId();
    const titleAnswerId = newId();
    sqlite
      .prepare(
        `insert into submission_answer (id, submission_id, form_field_id, value_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
      )
      .run(formatAnswerId, submissionId, formatField.id, JSON.stringify("Talk (30 min)"), now, now);
    sqlite
      .prepare(
        `insert into submission_answer (id, submission_id, form_field_id, value_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
      )
      .run(titleAnswerId, submissionId, titleField.id, JSON.stringify("Talk"), now, now);

    void form;
    const rows = await db
      .select({ id: schema.submissionAnswer.id })
      .from(schema.submissionAnswer)
      .where(sql`${answerFieldRoleCondition("session_format")} AND ${eq(schema.submissionAnswer.submissionId, submissionId)}`);

    expect(rows.map((r) => r.id)).toEqual([formatAnswerId]);
  });
});
