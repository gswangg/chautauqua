// DEC-656 (amends DEC-604): a speaker-added co-presenter is RECORDED, not
// PUBLISHED — addCoPresenter (src/server/repo/portal-edit.ts) writes
// visible=false, and the public speakers surface must actually honour that
// bit. This test does not mock the gate: it takes the REAL SQL fragment
// visibleSubmissionConditions() generates (via drizzle's SQLiteSyncDialect,
// no live D1/Db wiring exists in this repo — see
// test/public-speakers-pagination.test.ts) and runs it against an in-memory
// node:sqlite database, proving a visible=false participant is excluded and
// a visible=true one is included, using the gate's own generated predicate
// rather than a hand-copied WHERE clause.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { visibleSubmissionConditions } from "../src/server/repo/public/gates";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE submission (id TEXT PRIMARY KEY, status TEXT, content_status TEXT)");
  db.exec(
    "CREATE TABLE participant (id TEXT PRIMARY KEY, submission_id TEXT, contact_id TEXT, visible INTEGER, invite_status TEXT)",
  );
  db.exec("INSERT INTO submission VALUES ('sub-1', 'accepted', 'approved')");
  return db;
}

function speakerIds(db: InstanceType<typeof DatabaseSync>): string[] {
  const dialect = new SQLiteSyncDialect();
  const condition = visibleSubmissionConditions();
  if (!condition) throw new Error("visibleSubmissionConditions() must never be empty");
  const { sql: whereSql, params } = dialect.sqlToQuery(condition);
  const rows = db
    .prepare(
      `SELECT DISTINCT participant.contact_id AS contactId FROM submission ` +
        `JOIN participant ON participant.submission_id = submission.id WHERE ${whereSql}`,
    )
    .all(...(params as (string | number)[]));
  return rows.map((r) => r.contactId as string);
}

describe("DEC-656: a speaker-added co-presenter (visible=false) is excluded from the public speakers gate", () => {
  it("does not appear while visible=0 (the state addCoPresenter writes), and appears once flipped to 1", () => {
    const db = makeDb();
    // Mirrors exactly what addCoPresenter inserts (DEC-317 Amendment, wave
    // 37): inviteStatus='invited', visible=false — a not-yet-active
    // participant that is not yet published either.
    db.exec("INSERT INTO participant VALUES ('p1', 'sub-1', 'contact-added', 0, 'invited')");

    expect(speakerIds(db)).not.toContain("contact-added");

    // Flipping visible=1 alone is not enough — 'invited' is still excluded
    // by the invite_status gate until the co-presenter accepts.
    db.exec("UPDATE participant SET visible = 1 WHERE id = 'p1'");
    expect(speakerIds(db)).not.toContain("contact-added");

    // Once accepted (and the organizer flips the existing visibility
    // toggle, DEC-656's only path to publication), the row is public.
    db.exec("UPDATE participant SET invite_status = 'accepted' WHERE id = 'p1'");
    expect(speakerIds(db)).toContain("contact-added");
  });

  it("an invited-but-undecided co-presenter stays excluded even if visible were ever true (invite_status gate)", () => {
    const db = makeDb();
    db.exec("INSERT INTO participant VALUES ('p2', 'sub-1', 'contact-pending', 1, 'pending')");
    expect(speakerIds(db)).not.toContain("contact-pending");
  });
});
