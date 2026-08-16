// DEC-746 (wave-77 amendment): a task's AUDIENCE is a property of the task.
// createTask stamps 'targeted' when the caller supplied an explicit
// contactIds subset, DEFAULT_TASK_AUDIENCE ('everyone') otherwise --
// src/routes/tasks.ts's create handler. DEC-932's acceptance back-fill
// (src/server/repo/submissions/status.ts's eventTaskRows select) must then
// range over 'everyone' tasks only, so a task an organizer deliberately
// targeted at a subset never silently becomes universal at the next
// acceptance. Both the organizer bulk-accept path (updateSubmissionStatuses)
// and the portal invite-accept path (src/routes/portal/index.tsx:695, which
// calls the exact same ensureOnboardingTasks this file drives) run through
// that one filtered select.
//
// Real rows: node:sqlite DatabaseSync + drizzle-orm/sqlite-proxy, schema
// built by applying every migrations/*.sql file in order (mirrors
// test/spec9-invariants.test.ts's makeTestDb) -- so this test exercises the
// real migrations/0045_task_audience.sql column, not a hand-rolled DDL that
// could silently drift from it.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { createTask } from "../src/server/repo/tasks/crud";
import { updateSubmissionStatuses, ensureOnboardingTasks } from "../src/server/repo/submissions";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";

const REPO_ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "migrations");

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

const NOW = Date.now();
const ORG = "org-1";
const EVENT = "event-1";

function run(sqlite: DatabaseSync, sql: string, ...params: (string | number | null)[]) {
  sqlite.prepare(sql).run(...params);
}

function insertEvent(sqlite: DatabaseSync) {
  run(
    sqlite,
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at) values (?, ?, 'Event', 'event', '2026-01-01', '2026-01-02', 'UTC', ?, ?)`,
    EVENT,
    ORG,
    NOW,
    NOW,
  );
}

function insertContact(sqlite: DatabaseSync, id: string, firstName: string) {
  run(
    sqlite,
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, 'Speaker', ?, ?, ?)`,
    id,
    ORG,
    firstName,
    `${firstName.toLowerCase()}@example.com`,
    NOW,
    NOW,
  );
}

let submissionSeq = 0;

function insertSubmission(sqlite: DatabaseSync, id: string, status: string) {
  submissionSeq += 1;
  run(
    sqlite,
    `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at) values (?, ?, ?, 'Talk', ?, 'pending', 0, ?, ?)`,
    id,
    EVENT,
    submissionSeq,
    status,
    NOW,
    NOW,
  );
}

function insertParticipant(sqlite: DatabaseSync, submissionId: string, contactId: string, inviteStatus: string) {
  run(
    sqlite,
    `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
    newId(),
    submissionId,
    contactId,
    inviteStatus,
    NOW,
    NOW,
  );
}

function assignmentContactIds(sqlite: DatabaseSync, taskId: string): Set<string> {
  const rows = sqlite.prepare(`select contact_id as contactId from task_assignment where task_id = ?`).all(taskId) as {
    contactId: string;
  }[];
  return new Set(rows.map((r) => r.contactId));
}

function taskAudience(sqlite: DatabaseSync, taskId: string): string {
  const row = sqlite.prepare(`select audience from task where id = ?`).get(taskId) as { audience: string };
  return row.audience;
}

describe("DEC-746 (wave-77 amendment): task.audience stays targeted through acceptance back-fill", () => {
  let db: Db;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    insertEvent(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("createTask stamps audience='targeted' when contactIds is supplied, 'everyone' when absent", async () => {
    insertContact(sqlite, "c-a", "Ada");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-a", "none");

    const targeted = await createTask(db, EVENT, {
      kind: "general",
      title: "Targeted task",
      required: false,
      contactIds: ["c-a"],
      audience: "targeted", // mirrors routes/tasks.ts: resolvedContactIds ? 'targeted' : DEFAULT_TASK_AUDIENCE
    });
    expect(taskAudience(sqlite, targeted.id)).toBe("targeted");

    const everyone = await createTask(db, EVENT, {
      kind: "general",
      title: "Everyone task",
      required: false,
    });
    expect(taskAudience(sqlite, everyone.id)).toBe("everyone");
  });

  it("a task targeted at [A] leaves B with NO assignment after B's submission is accepted (bulk accept), while A keeps his", async () => {
    insertContact(sqlite, "c-a", "Ada");
    insertContact(sqlite, "c-b", "Grace");
    insertSubmission(sqlite, "sub-a", "accepted");
    insertParticipant(sqlite, "sub-a", "c-a", "none");

    const targeted = await createTask(db, EVENT, {
      kind: "general",
      title: "Sign the venue waiver",
      required: false,
      contactIds: ["c-a"],
      audience: "targeted", // mirrors routes/tasks.ts: resolvedContactIds ? 'targeted' : DEFAULT_TASK_AUDIENCE
    });
    // A already has the assignment from creation.
    expect(assignmentContactIds(sqlite, targeted.id)).toEqual(new Set(["c-a"]));

    // B's submission is created afterwards and accepted via the bulk path --
    // this is exactly the DEC-932 back-fill trigger this ruling scopes.
    insertSubmission(sqlite, "sub-b", "pending");
    insertParticipant(sqlite, "sub-b", "c-b", "none");
    await updateSubmissionStatuses(db, EVENT, ["sub-b"], "accepted", new Date(NOW + 1));

    const finalAssignees = assignmentContactIds(sqlite, targeted.id);
    expect(finalAssignees.has("c-a")).toBe(true);
    expect(finalAssignees.has("c-b")).toBe(false);
    expect(finalAssignees.size).toBe(1);
  });

  it("a task created WITHOUT contactIds (audience='everyone') DOES reach a newly-active contact via the same back-fill", async () => {
    insertContact(sqlite, "c-a", "Ada");
    insertContact(sqlite, "c-b", "Grace");
    insertSubmission(sqlite, "sub-a", "accepted");
    insertParticipant(sqlite, "sub-a", "c-a", "none");

    const everyone = await createTask(db, EVENT, {
      kind: "general",
      title: "Sign the venue waiver",
      required: false,
    });
    expect(assignmentContactIds(sqlite, everyone.id)).toEqual(new Set(["c-a"]));

    insertSubmission(sqlite, "sub-b", "pending");
    insertParticipant(sqlite, "sub-b", "c-b", "none");
    await updateSubmissionStatuses(db, EVENT, ["sub-b"], "accepted", new Date(NOW + 1));

    expect(assignmentContactIds(sqlite, everyone.id)).toEqual(new Set(["c-a", "c-b"]));
  });

  it("the portal invite-accept path (ensureOnboardingTasks, called verbatim by src/routes/portal/index.tsx:695) honours the same audience filter", async () => {
    insertContact(sqlite, "c-a", "Ada");
    insertContact(sqlite, "c-b", "Grace");
    insertSubmission(sqlite, "sub-1", "accepted");
    insertParticipant(sqlite, "sub-1", "c-a", "accepted");
    insertParticipant(sqlite, "sub-1", "c-b", "invited");

    const targeted = await createTask(db, EVENT, {
      kind: "general",
      title: "Targeted task",
      required: false,
      contactIds: ["c-a"],
      audience: "targeted", // mirrors routes/tasks.ts: resolvedContactIds ? 'targeted' : DEFAULT_TASK_AUDIENCE
    });
    const everyone = await createTask(db, EVENT, {
      kind: "general",
      title: "Everyone task",
      required: false,
    });
    expect(assignmentContactIds(sqlite, targeted.id)).toEqual(new Set(["c-a"]));
    expect(assignmentContactIds(sqlite, everyone.id)).toEqual(new Set(["c-a"]));

    // B accepts their invitation -- flips invite_status to 'accepted' and
    // the portal route calls ensureOnboardingTasks(..., [contactId], ...)
    // exactly like this.
    run(sqlite, `update participant set invite_status = 'accepted' where contact_id = ? and submission_id = ?`, "c-b", "sub-1");
    await ensureOnboardingTasks(db, EVENT, "sub-1", ["c-b"], new Date(NOW + 1));

    expect(assignmentContactIds(sqlite, targeted.id)).toEqual(new Set(["c-a"])); // B never added
    expect(assignmentContactIds(sqlite, everyone.id)).toEqual(new Set(["c-a", "c-b"])); // B backfilled
  });
});
