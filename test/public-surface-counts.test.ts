// DEC-767: getPublicSurfaceCounts (src/server/repo/public/counts.ts) must
// use the SAME predicates the SSR public surfaces use, so the settings
// panel's numbers never drift from what a visitor actually sees. This test
// does not mock the gates: it takes the REAL SQL fragments
// visibleSessionConditions()/visibleSubmissionConditions() generate (via
// drizzle's SQLiteSyncDialect, no live D1/Db wiring exists in this repo --
// see test/public-copresenter-visibility.test.ts) and runs them against an
// in-memory node:sqlite database.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { visibleSessionConditions, visibleSubmissionConditions } from "../src/server/repo/public/gates";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE submission (id TEXT PRIMARY KEY, event_id TEXT, status TEXT, content_status TEXT)",
  );
  db.exec(
    "CREATE TABLE participant (id TEXT PRIMARY KEY, submission_id TEXT, contact_id TEXT, visible INTEGER, invite_status TEXT)",
  );
  return db;
}

function whereSql(condition: unknown): { sql: string; params: (string | number)[] } {
  const dialect = new SQLiteSyncDialect();
  if (!condition) throw new Error("condition must never be empty");
  const { sql, params } = dialect.sqlToQuery(condition as never);
  return { sql, params: params as (string | number)[] };
}

/** Mirrors the `sessions` count in getPublicSurfaceCounts: count(*) over
 * submission under visibleSessionConditions() -- no participant join. */
function sessionCount(db: InstanceType<typeof DatabaseSync>, eventId: string): number {
  const { sql, params } = whereSql(visibleSessionConditions());
  const row = db
    .prepare(`SELECT count(*) AS n FROM submission WHERE event_id = ? AND ${sql}`)
    .get(eventId, ...params) as { n: number };
  return row.n;
}

/** Mirrors the `speakers` count: count(distinct contact_id) over
 * participant/submission under visibleSubmissionConditions() (the AND of
 * both gates). */
function speakerCount(db: InstanceType<typeof DatabaseSync>, eventId: string): number {
  const { sql, params } = whereSql(visibleSubmissionConditions());
  const row = db
    .prepare(
      `SELECT count(DISTINCT participant.contact_id) AS n FROM participant ` +
        `JOIN submission ON submission.id = participant.submission_id ` +
        `WHERE submission.event_id = ? AND ${sql}`,
    )
    .get(eventId, ...params) as { n: number };
  return row.n;
}

describe("DEC-767: getPublicSurfaceCounts predicates", () => {
  it("excludes an accepted-but-content-pending session from the session count", () => {
    const db = makeDb();
    db.exec("INSERT INTO submission VALUES ('sub-pending', 'evt-1', 'accepted', 'pending')");
    db.exec("INSERT INTO submission VALUES ('sub-approved', 'evt-1', 'accepted', 'approved')");

    expect(sessionCount(db, "evt-1")).toBe(1);
  });

  it("excludes an accepted+approved session whose only participant is not visible from the speaker count, while the session itself still counts", () => {
    const db = makeDb();
    db.exec("INSERT INTO submission VALUES ('sub-hidden-speaker', 'evt-1', 'accepted', 'approved')");
    db.exec(
      "INSERT INTO participant VALUES ('p1', 'sub-hidden-speaker', 'contact-hidden', 0, 'none')",
    );

    // The session gate has no reference to participant -- a speakerless or
    // all-hidden-speaker session is still publicly visible as a session.
    expect(sessionCount(db, "evt-1")).toBe(1);
    // But the speaker gate excludes the not-visible participant, so no
    // speaker is counted for this event.
    expect(speakerCount(db, "evt-1")).toBe(0);
  });

  it("counts a visible speaker once the participant is flipped visible", () => {
    const db = makeDb();
    db.exec("INSERT INTO submission VALUES ('sub-1', 'evt-1', 'accepted', 'approved')");
    db.exec("INSERT INTO participant VALUES ('p1', 'sub-1', 'contact-1', 1, 'none')");

    expect(speakerCount(db, "evt-1")).toBe(1);
  });
});
