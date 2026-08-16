// SPEC.md §9 direct-unit-test coverage for the four named high-weight
// invariants ("Unit-test the cheap, high-weight invariants directly:
// close-date lock, speaker isolation, hidden-speaker exclusion,
// decision≠email." -- SPEC.md:382-383). DEC-063 wave-35 amendment: this file
// is the SOLE OWNER of that closed set -- every one of the four invariants
// gets its own `describe` block here, quoting the SPEC.md clause it proves
// and citing the product file:line it exercises, so a future spec-audit lane
// can cite this one file instead of re-deriving coverage across the suite.
// Other test files may (and do) cover pieces of the same behavior from
// different angles -- this file does not relocate or delete that coverage,
// it is the closed pointer TO it plus a direct proof of its own.
//
// Related (not duplicated) coverage elsewhere in test/:
// - close-date lock: test/edit-lock.test.ts, test/submit-core.test.ts
// - speaker isolation (cross-account IDOR), the full 13-route population:
//   test/portal-idor-real-rows-probe.test.ts, test/portal-idor-probe.test.ts,
//   test/task-file-access.test.ts "403s for another speaker (IDOR)"
// - hidden-speaker exclusion: test/headshot-gate.test.ts "404s
//   unauthenticated when the speaker isn't publicly visible (pending/hidden)"

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { updateSubmissionStatuses } from "../src/server/repo/submissions";
import { registerErrorHandler } from "../src/server/http";
import { publicSubmitPostRoutes } from "../src/routes/public/submit-post";
import { portalRoutes } from "../src/routes/portal/index";
import { portalTasksRoutes } from "../src/routes/portal/tasks";
import { canEditSubmission } from "../src/domain/edit-lock";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

// ---------------------------------------------------------------------------
// 1. CLOSE-DATE LOCK
// "`form.close_date` past ⇒ new submissions rejected and (unaccepted) speaker
// edits locked, server-side. Accepted speakers keep editing per swyx."
// (SPEC.md:297-298)
// ---------------------------------------------------------------------------

describe("SPEC §9 invariant: close-date lock (SPEC.md:297-298)", () => {
  it("a public submit against a closed form is refused BEFORE any body parse or DB write (src/routes/public/submit-post.tsx:76-83)", async () => {
    const now = Date.now();
    const eventRow = {
      id: "event-1",
      orgId: "org-1",
      name: "Event",
      slug: "closed-event",
      recordPrefix: "SES",
      timezone: "America/Los_Angeles",
      brandingJson: null,
      startDate: "2020-01-01",
      endDate: "2020-01-02",
      location: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
    const closedFormRow = {
      id: "form-1",
      eventId: "event-1",
      title: "Default form",
      description: null,
      isDefault: true,
      openDate: null,
      closeDate: new Date(now - 365 * 24 * 60 * 60 * 1000), // one year in the past
      tracksJson: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    let selectCalls = 0;
    function chain(rows: unknown[]) {
      const c: any = {
        from: () => c,
        where: () => c,
        orderBy: () => c,
        limit: async () => rows,
      };
      return c;
    }
    const db = {
      select: () => {
        selectCalls += 1;
        if (selectCalls === 1) return chain([eventRow]);
        if (selectCalls === 2) return chain([closedFormRow]);
        throw new Error(
          "spec9 close-date-lock: a DB read happened past the window-closed guard -- the closed check must " +
            "short-circuit before form fields/tracks/rate-limit reads, let alone any write",
        );
      },
    } as unknown as Db;

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", publicSubmitPostRoutes);

    // A body that throws the moment anything tries to read it -- proves
    // c.req.parseBody() (submit-post.tsx:151) is never reached for a closed
    // form, since that's the only thing in this handler that would read it.
    const body = new ReadableStream({
      pull() {
        throw new Error("spec9 close-date-lock: request body was read for a closed-form submit");
      },
    });
    const request = new Request("https://example.test/submit/closed-event", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: string });

    const res = await app.fetch(request, { KV: undefined } as unknown as AppEnv["Bindings"]);

    expect(res.status).toBe(200); // ClosedPage renders 200, not an error page
    const html = await res.text();
    expect(html).toContain("closed");
    expect(selectCalls).toBe(2); // event + form only -- nothing past the guard
  });

  it("an ACCEPTED speaker keeps editing past close -- the recorded deliberate carve-out (src/domain/edit-lock.ts:22, DEC-041, docs/clarifications.md:39)", () => {
    // Frozen day labels + frozen now (DEC-522 amendment, wave 49): closeDate
    // is a DAY LABEL, not an instant -- a wall-clock `Date.now() - 24h` value
    // is NOT necessarily "yesterday's" UTC day label and makes this
    // assertion clock-dependent (red for ~7h of every UTC day). Mirrors
    // test/edit-lock.test.ts:9-11 exactly.
    const now = Date.UTC(2027, 2, 15); // 2027-03-15 (arbitrary "today")
    const pastClose = Date.UTC(2027, 0, 1); // 2027-01-01 -- well closed by now
    // Every other status locks at close (the general rule this is a carve-out of).
    expect(canEditSubmission("pending", pastClose, now, "America/Los_Angeles")).toBe(false);
    // "Accepted speakers can keep editing their submission" (docs/clarifications.md:39).
    expect(canEditSubmission("accepted", pastClose, now, "America/Los_Angeles")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. SPEAKER ISOLATION
// "Authz middleware on every admin/API route: role + event grant;
// object-level ownership checks on every fetch-by-id (no IDOR)."
// (SPEC.md:311-312)
//
// This drives the REAL portal handlers against REAL sqlite rows -- it does
// not restate a constant. Full 13-route population coverage already lives in
// test/portal-idor-real-rows-probe.test.ts (cross-referenced, not
// duplicated); this block is this file's own direct, minimal proof of the
// same invariant for the two representative doors SPEC.md:382 names
// ("submission" and "task assignment").
// ---------------------------------------------------------------------------

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

const ISO_ORG_ID = "spec9-iso-org";
const ISO_EVENT_ID = "spec9-iso-event";
const ISO_IDS = {
  contactA: "spec9-iso-contact-a",
  contactB: "spec9-iso-contact-b",
  userB: "spec9-iso-user-b",
  formA: "spec9-iso-form-a",
  submissionA: "spec9-iso-submission-a",
  participantA: "spec9-iso-participant-a",
  taskA: "spec9-iso-task-a",
  assignmentA: "spec9-iso-assignment-a",
};

const SPEAKER_B: AuthInfo = {
  userId: ISO_IDS.userB,
  role: "speaker",
  orgId: ISO_ORG_ID,
  contactId: ISO_IDS.contactB,
};

function seedIsolationFixture(sqlite: DatabaseSync) {
  const now = Date.now();
  const run = (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).run(...params);

  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`, ISO_ORG_ID, now, now);
  run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
     values (?, ?, 'Event', 'spec9-iso-event', '2026-03-01', '2026-03-02', 'America/New_York', ?, ?)`,
    ISO_EVENT_ID,
    ISO_ORG_ID,
    now,
    now,
  );
  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
     values (?, ?, 'Speaker', 'A', 'spec9-speaker-a@example.test', ?, ?)`,
    ISO_IDS.contactA,
    ISO_ORG_ID,
    now,
    now,
  );
  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
     values (?, ?, 'Speaker', 'B', 'spec9-speaker-b@example.test', ?, ?)`,
    ISO_IDS.contactB,
    ISO_ORG_ID,
    now,
    now,
  );
  run(
    `insert into user (id, org_id, email, password_hash, role, contact_id, created_at, updated_at)
     values (?, ?, 'spec9-speaker-b-user@example.test', 'x', 'speaker', ?, ?, ?)`,
    ISO_IDS.userB,
    ISO_ORG_ID,
    ISO_IDS.contactB,
    now,
    now,
  );
  run(
    `insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'Form A', 1, ?, ?)`,
    ISO_IDS.formA,
    ISO_EVENT_ID,
    now,
    now,
  );
  run(
    `insert into submission (id, event_id, form_id, seq, title, status, content_status, created_at, updated_at)
     values (?, ?, ?, 1, 'Talk A', 'accepted', 'approved', ?, ?)`,
    ISO_IDS.submissionA,
    ISO_EVENT_ID,
    ISO_IDS.formA,
    now,
    now,
  );
  run(
    `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
     values (?, ?, ?, 'speaker', 0, 1, 'accepted', ?, ?)`,
    ISO_IDS.participantA,
    ISO_IDS.submissionA,
    ISO_IDS.contactA,
    now,
    now,
  );
  run(
    `insert into task (id, event_id, kind, title, required, created_at, updated_at) values (?, ?, 'general', 'Task A', 0, ?, ?)`,
    ISO_IDS.taskA,
    ISO_EVENT_ID,
    now,
    now,
  );
  run(
    `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values (?, ?, ?, 'pending', ?, ?)`,
    ISO_IDS.assignmentA,
    ISO_IDS.taskA,
    ISO_IDS.contactA,
    now,
    now,
  );
}

function snapshotIsolationRows(sqlite: DatabaseSync): string {
  const submissionRow = sqlite.prepare(`select * from submission where id = ?`).all(ISO_IDS.submissionA);
  const assignmentRow = sqlite.prepare(`select * from task_assignment where id = ?`).all(ISO_IDS.assignmentA);
  return JSON.stringify({ submissionRow, assignmentRow });
}

function buildIsolationApp(db: Db) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", SPEAKER_B);
    await next();
  });
  app.route("/portal", portalRoutes);
  app.route("/portal", portalTasksRoutes);
  return app;
}

describe("SPEC §9 invariant: speaker isolation (SPEC.md:311-312)", () => {
  it("speaker B cannot reach speaker A's portal submission (existence-hiding 404) or task assignment (403), and neither row is written", async () => {
    const { db, sqlite } = makeTestDb();
    seedIsolationFixture(sqlite);
    const before = snapshotIsolationRows(sqlite);

    const app = buildIsolationApp(db);

    const submissionRes = await app.request(
      `/portal/submissions/${ISO_IDS.submissionA}`,
      undefined,
      {} as unknown as AppEnv["Bindings"],
    );
    expect(submissionRes.status).toBe(404);

    const taskFormRes = await app.request(
      `/portal/tasks/${ISO_IDS.assignmentA}/form`,
      undefined,
      {} as unknown as AppEnv["Bindings"],
    );
    expect(taskFormRes.status).toBe(403);

    const after = snapshotIsolationRows(sqlite);
    expect(after).toBe(before);

    sqlite.close();
  });
});

// ---------------------------------------------------------------------------
// 3. HIDDEN-SPEAKER EXCLUSION
// "A contact becomes a *speaker* only via a `participant` row; a speaker
// appears publicly only if `participant.visible` AND submission accepted AND
// content approved -- distinct gates, never collapsed." (SPEC.md:294-296)
// (src/server/repo/public/gates.ts:25-56, DEC-274/DEC-108)
// ---------------------------------------------------------------------------

const HIDE_ORG_ID = "spec9-hide-org";
const HIDE_EVENT_ID = "spec9-hide-event";
const HIDE_IDS = {
  submission: "spec9-hide-submission",
  contactHidden: "spec9-hide-contact-hidden", // visible=0
  contactUninvited: "spec9-hide-contact-uninvited", // invite_status='invited', not in ('none','accepted')
  participantHidden: "spec9-hide-participant-hidden",
  participantUninvited: "spec9-hide-participant-uninvited",
};

function seedHiddenSpeakerFixture(sqlite: DatabaseSync) {
  const now = Date.now();
  const run = (sql: string, ...params: (string | number)[]) => sqlite.prepare(sql).run(...params);

  run(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`, HIDE_ORG_ID, now, now);
  run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
     values (?, ?, 'Event', 'spec9-hide-event', '2026-03-01', '2026-03-02', 'America/New_York', ?, ?)`,
    HIDE_EVENT_ID,
    HIDE_ORG_ID,
    now,
    now,
  );
  run(
    `insert into submission (id, event_id, seq, title, status, content_status, created_at, updated_at)
     values (?, ?, 1, 'Talk', 'accepted', 'approved', ?, ?)`,
    HIDE_IDS.submission,
    HIDE_EVENT_ID,
    now,
    now,
  );
  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
     values (?, ?, 'Hidden', 'Speaker', 'spec9-hidden@example.test', ?, ?)`,
    HIDE_IDS.contactHidden,
    HIDE_ORG_ID,
    now,
    now,
  );
  run(
    `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
     values (?, ?, 'Uninvited', 'Speaker', 'spec9-uninvited@example.test', ?, ?)`,
    HIDE_IDS.contactUninvited,
    HIDE_ORG_ID,
    now,
    now,
  );
  // visible=0 -- excluded by the participant.visible half of the gate.
  run(
    `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
     values (?, ?, ?, 'speaker', 0, 0, 'accepted', ?, ?)`,
    HIDE_IDS.participantHidden,
    HIDE_IDS.submission,
    HIDE_IDS.contactHidden,
    now,
    now,
  );
  // invite_status='invited' (not in ('none','accepted')) -- excluded by the
  // participant.invite_status half of the gate (DEC-108), even though visible=1.
  run(
    `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
     values (?, ?, ?, 'speaker', 1, 1, 'invited', ?, ?)`,
    HIDE_IDS.participantUninvited,
    HIDE_IDS.submission,
    HIDE_IDS.contactUninvited,
    now,
    now,
  );
}

describe("SPEC §9 invariant: hidden-speaker exclusion (SPEC.md:294-296)", () => {
  it("a visible=0 participant and an invite_status='invited' participant are absent from the speaker-rooted public read, while their session still publicly renders with speakers: [] (src/server/repo/public/gates.ts:25-56, DEC-274/DEC-108)", async () => {
    const { db, sqlite } = makeTestDb();
    seedHiddenSpeakerFixture(sqlite);

    const { getPublicSpeakers } = await import("../src/server/repo/public/speakers");
    const { hydrateSessions } = await import("../src/server/repo/public/sessions");

    // Speaker-rooted read: visibleSubmissionConditions() = session gate AND
    // participant gate -- neither hidden nor uninvited participant appears.
    const speakersPage = await getPublicSpeakers(db, HIDE_EVENT_ID, { page: 1, perPage: 50 });
    expect(speakersPage.items).toEqual([]);
    expect(speakersPage.total).toBe(0);

    // Session-rooted read: visibleSessionConditions() alone (no participant
    // reference) -- the session itself still renders, with speakers: [].
    const sessions = await hydrateSessions(db, [HIDE_IDS.submission], {
      id: HIDE_EVENT_ID,
      recordPrefix: "SES",
      startDate: "2026-03-01",
      endDate: "2026-03-02",
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.speakers).toEqual([]);

    sqlite.close();
  });
});

// ---------------------------------------------------------------------------
// 4. DECISION≠EMAIL (unchanged)
// "Status changes never send email." (SPEC.md:296)
// ---------------------------------------------------------------------------

/**
 * Minimal fake drizzle db that only supports the exact chains
 * updateSubmissionStatuses uses (select().from().where(), then
 * update().set().where()), and records every table object it's asked to
 * touch. A non-accepted status transition never invokes acceptance
 * planning, so this exercises the full status-change write path.
 */
function fakeDb(row: { id: string; status: string; acceptedAt: Date | null }) {
  const touchedTables: unknown[] = [];
  const db = {
    select() {
      return {
        from(table: unknown) {
          touchedTables.push(table);
          return {
            where: async () => [row],
          };
        },
      };
    },
    update(table: unknown) {
      touchedTables.push(table);
      return {
        set() {
          return {
            where: async () => undefined,
          };
        },
      };
    },
    insert(table: unknown) {
      touchedTables.push(table);
      throw new Error("unexpected insert during a plain status change");
    },
  };
  return { db: db as unknown as Db, touchedTables };
}

describe("SPEC §9 invariant: decision (status change) never auto-emails", () => {
  it("updateSubmissionStatuses (pending -> declined) never touches email_log", async () => {
    const { db, touchedTables } = fakeDb({ id: "sub-1", status: "pending", acceptedAt: null });

    const result = await updateSubmissionStatuses(db, "event-1", ["sub-1"], "declined", new Date());

    expect(result.updated).toBe(1);
    expect(touchedTables).not.toContain(schema.emailLog);
    // Only the submission table should ever be touched on a plain decision.
    for (const table of touchedTables) {
      expect(table).toBe(schema.submission);
    }
  });
});
