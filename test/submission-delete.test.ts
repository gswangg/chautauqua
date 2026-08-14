// DEC-886/DEC-921 repo coverage for the guarded submission-delete cascade: a
// SUBMITTED evaluation refuses the submission, a cross-event id is refused
// (never a whole-batch throw), the cascade removes every table the
// submission owns (including its schedule_slot — an orphaned slot makes
// deleteRoom refuse forever — and, per the DEC-886 amendment, its draft
// evaluation and submission-scoped plan_reviewer rows), a completed
// task_assignment survives the cascade reopened to 'pending' rather than
// deleted, planSubmissionDelete's blast-radius counts come from one grouped
// query per table (never a query per submission), and the delete-plan route
// never leaks the internal fileR2Keys field onto the wire.
//
// This repo has no local sqlite/D1 test driver (see test/files-delete.test.ts's
// sibling comment). Rather than hand-interpreting drizzle-orm's internal SQL
// tree per call site, drizzle-orm's query-condition builders (eq/inArray/
// and/isNotNull) are mocked to build a tiny predicate AST that the fake db
// below evaluates directly against in-memory rows via a column->accessor
// map — schema table/column objects are used as-is (real identity), only
// their downstream SQL compilation is swapped out. `sql` count(*)
// projections and `.groupBy()` are likewise faked: the fake select chain
// groups its filtered rows by the requested column(s) and treats any
// projected key with no known column accessor as the group's row count.

import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ kind: "eq" as const, col, val }),
    inArray: (col: unknown, vals: unknown[]) => ({ kind: "inArray" as const, col, vals }),
    and: (...conds: unknown[]) => ({ kind: "and" as const, conds }),
    isNotNull: (col: unknown) => ({ kind: "isNotNull" as const, col }),
  };
});

import * as schema from "../src/db/schema";
import { commitSubmissionDelete, planSubmissionDelete } from "../src/server/repo/submission-delete";
import type { Db } from "../src/server/context";

type Row = Record<string, unknown>;
type Pred =
  | { kind: "eq"; col: unknown; val: unknown }
  | { kind: "inArray"; col: unknown; vals: unknown[] }
  | { kind: "and"; conds: Pred[] }
  | { kind: "isNotNull"; col: unknown };

interface State {
  events: Row[];
  submissions: Row[];
  evaluations: Row[];
  planReviewers: Row[];
  files: Row[];
  taskAssignments: Row[];
  fileComments: Row[];
  submissionAnswers: Row[];
  submissionTracks: Row[];
  participants: Row[];
  reviewRecusals: Row[];
  submissionRevisions: Row[];
  scheduleSlots: Row[];
  emailLog: Row[];
}

function colMap(): Map<unknown, (row: Row) => unknown> {
  const m = new Map<unknown, (row: Row) => unknown>();
  m.set(schema.event.id, (r) => r.id);
  m.set(schema.event.recordPrefix, (r) => r.recordPrefix);
  m.set(schema.event.orgId, (r) => r.orgId);
  m.set(schema.submission.id, (r) => r.id);
  m.set(schema.submission.eventId, (r) => r.eventId);
  m.set(schema.submission.seq, (r) => r.seq);
  m.set(schema.submission.title, (r) => r.title);
  m.set(schema.evaluation.submissionId, (r) => r.submissionId);
  m.set(schema.evaluation.submittedAt, (r) => r.submittedAt);
  m.set(schema.planReviewer.submissionId, (r) => r.submissionId);
  m.set(schema.planReviewer.id, (r) => r.id);
  m.set(schema.file.submissionId, (r) => r.submissionId);
  m.set(schema.file.r2Key, (r) => r.r2Key);
  m.set(schema.file.id, (r) => r.id);
  m.set(schema.taskAssignment.fileId, (r) => r.fileId);
  m.set(schema.taskAssignment.id, (r) => r.id);
  m.set(schema.taskAssignment.status, (r) => r.status);
  m.set(schema.taskAssignment.completedAt, (r) => r.completedAt);
  m.set(schema.taskAssignment.completedBy, (r) => r.completedBy);
  m.set(schema.fileComment.fileId, (r) => r.fileId);
  m.set(schema.submissionAnswer.submissionId, (r) => r.submissionId);
  m.set(schema.submissionTrack.submissionId, (r) => r.submissionId);
  m.set(schema.participant.submissionId, (r) => r.submissionId);
  m.set(schema.reviewRecusal.submissionId, (r) => r.submissionId);
  m.set(schema.submissionRevision.submissionId, (r) => r.submissionId);
  m.set(schema.scheduleSlot.submissionId, (r) => r.submissionId);
  return m;
}

function evalPred(pred: Pred, row: Row, cols: Map<unknown, (row: Row) => unknown>): boolean {
  const accessor = (col: unknown) => {
    const fn = cols.get(col);
    if (!fn) throw new Error("evalPred: unmapped column in fake db — add it to colMap()");
    return fn(row);
  };
  switch (pred.kind) {
    case "eq":
      return accessor(pred.col) === pred.val;
    case "inArray":
      return pred.vals.includes(accessor(pred.col));
    case "and":
      return pred.conds.every((c) => evalPred(c, row, cols));
    case "isNotNull":
      return accessor(pred.col) !== null && accessor(pred.col) !== undefined;
  }
}

function makeFakeDb(state: State, selectCallsByTable: Map<keyof State, number>) {
  const cols = colMap();
  const tableKey = new Map<unknown, keyof State>([
    [schema.event, "events"],
    [schema.submission, "submissions"],
    [schema.evaluation, "evaluations"],
    [schema.planReviewer, "planReviewers"],
    [schema.file, "files"],
    [schema.taskAssignment, "taskAssignments"],
    [schema.fileComment, "fileComments"],
    [schema.submissionAnswer, "submissionAnswers"],
    [schema.submissionTrack, "submissionTracks"],
    [schema.participant, "participants"],
    [schema.reviewRecusal, "reviewRecusals"],
    [schema.submissionRevision, "submissionRevisions"],
    [schema.scheduleSlot, "scheduleSlots"],
    [schema.emailLog, "emailLog"],
  ]);

  function arrFor(table: unknown): Row[] {
    const key = tableKey.get(table);
    if (!key) throw new Error("makeFakeDb: unmapped table — add it to tableKey");
    return state[key];
  }
  function setArr(table: unknown, rows: Row[]) {
    const key = tableKey.get(table);
    if (!key) throw new Error("makeFakeDb: unmapped table — add it to tableKey");
    state[key] = rows;
  }
  function bumpSelectCount(table: unknown) {
    const key = tableKey.get(table);
    if (!key) return;
    selectCallsByTable.set(key, (selectCallsByTable.get(key) ?? 0) + 1);
  }

  function project(row: Row, proj: Record<string, unknown>): Row {
    const out: Row = {};
    for (const [key, col] of Object.entries(proj)) {
      const fn = cols.get(col);
      if (!fn) throw new Error(`project: unmapped column for projection key "${key}"`);
      out[key] = fn(row);
    }
    return out;
  }

  const db = {
    select(proj: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            where(cond: Pred) {
              bumpSelectCount(table);
              const filtered = arrFor(table).filter((r) => evalPred(cond, r, cols));
              // Projection (and its unmapped-column guard) is computed lazily
              // — only when actually awaited/limit()'d, never eagerly — so a
              // query that chains .groupBy() instead never trips the plain
              // projection's "count is a sql template, not a real column"
              // guard below.
              const p = {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n).map((r) => project(r, proj))),
                then: (resolve: (v: Row[]) => void, reject?: (e: unknown) => void) => {
                  try {
                    resolve(filtered.map((r) => project(r, proj)));
                  } catch (e) {
                    reject?.(e);
                  }
                },
              } as Promise<Row[]> & {
                limit: (n: number) => Promise<Row[]>;
                groupBy: (...groupCols: unknown[]) => Promise<Row[]>;
              };
              // Groups filtered rows by the requested column(s); any
              // projected key with no known column accessor (e.g. the
              // sql`count(*)` template used throughout submission-delete.ts)
              // is filled with the group's row count instead.
              p.groupBy = (...groupCols: unknown[]) => {
                const keyFor = (row: Row) => groupCols.map((gc) => cols.get(gc)!(row)).join(" ");
                const groups = new Map<string, Row[]>();
                for (const r of filtered) {
                  const k = keyFor(r);
                  const arr = groups.get(k) ?? [];
                  arr.push(r);
                  groups.set(k, arr);
                }
                const grouped: Row[] = [...groups.values()].map((grp) => {
                  const out: Row = {};
                  for (const [key, col] of Object.entries(proj)) {
                    const fn = cols.get(col);
                    out[key] = fn ? fn(grp[0] as Row) : grp.length;
                  }
                  return out;
                });
                return Promise.resolve(grouped);
              };
              return p;
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        async where(cond: Pred) {
          const remaining = arrFor(table).filter((r) => !evalPred(cond, r, cols));
          setArr(table, remaining);
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Record<string, unknown>) {
          return {
            async where(cond: Pred) {
              const rows = arrFor(table);
              const patched = rows.map((r) => {
                if (!evalPred(cond, r, cols)) return r;
                // Patch keys already match the schema's JS field names
                // (drizzle's .set() takes camelCase keys directly), so no
                // column-accessor lookup is needed here — just write through.
                return { ...r, ...patch };
              });
              setArr(table, patched);
            },
          };
        },
      };
    },
  };
  return db as unknown as Db;
}

function fixture(): State {
  return {
    events: [{ id: "ev1", recordPrefix: "SES", orgId: "org-1" }],
    submissions: [
      { id: "s1", eventId: "ev1", seq: 1, title: "Talk A — Eligible" },
      { id: "s2", eventId: "ev2", seq: 1, title: "Talk B — Other Event" }, // cross-event
      { id: "s3", eventId: "ev1", seq: 3, title: "Talk C — Reviewed" },
      { id: "s4", eventId: "ev1", seq: 4, title: "Talk D — Fully Loaded" },
    ],
    evaluations: [
      { id: "eval1", submissionId: "s3", submittedAt: 12345 },
      { id: "eval2", submissionId: "s4", submittedAt: null }, // draft only, not submitted
    ],
    planReviewers: [
      // submission-scoped assignment on s4 (DEC-886 amendment: orphans on
      // delete, PlanEditor renders "Submission (removed)" forever).
      { id: "pr1", planId: "plan1", userId: "u1", trackId: null, submissionId: "s4" },
      // plan/track-wide assignment (submissionId null) — never touched by
      // the submission-delete cascade.
      { id: "pr2", planId: "plan1", userId: "u2", trackId: "tr1", submissionId: null },
    ],
    files: [
      { id: "f1", submissionId: "s4", r2Key: "sub/s4/f1.pdf" },
      { id: "f2", submissionId: "s4", r2Key: "sub/s4/f2.pdf" },
    ],
    taskAssignments: [
      { id: "ta1", taskId: "t1", contactId: "c1", fileId: "f1", status: "completed", completedAt: 999, completedBy: "c1" },
      { id: "ta2", taskId: "t2", contactId: "c2", fileId: "unrelated-file", status: "completed", completedAt: 111, completedBy: "c2" },
    ],
    fileComments: [
      { id: "fc1", fileId: "f1", body: "looks good" },
      { id: "fc2", fileId: "unrelated-file", body: "unrelated" },
    ],
    submissionAnswers: [{ id: "sa1", submissionId: "s4", formFieldId: "ff1", valueJson: '"x"' }],
    submissionTracks: [{ submissionId: "s4", trackId: "tr1" }],
    participants: [{ id: "p1", submissionId: "s4", contactId: "c1" }],
    reviewRecusals: [{ id: "rr1", submissionId: "s4", planId: "plan1", userId: "u1" }],
    submissionRevisions: [{ id: "sr1", submissionId: "s4", title: "old title" }],
    scheduleSlots: [{ id: "slot1", submissionId: "s4", roomId: "room1", day: "2026-01-01", startMin: 60, endMin: 90 }],
    emailLog: [{ id: "el1", submissionId: "s4", toEmail: "a@example.com" }],
  };
}

describe("planSubmissionDelete (DEC-886)", () => {
  it("refuses a submission with at least one SUBMITTED evaluation, naming the reason", async () => {
    const db = makeFakeDb(fixture(), new Map());
    const plan = await planSubmissionDelete(db, "ev1", ["s3"]);
    expect(plan.eligible).toEqual([]);
    expect(plan.refused).toEqual([{ id: "s3", ref: "SES-003", reason: "Has at least one submitted evaluation" }]);
  });

  it("does NOT refuse a submission whose evaluation exists but was never submitted (submittedAt null)", async () => {
    const db = makeFakeDb(fixture(), new Map());
    const plan = await planSubmissionDelete(db, "ev1", ["s4"]);
    expect(plan.refused).toEqual([]);
    expect(plan.eligible).toHaveLength(1);
    expect(plan.eligible[0]).toMatchObject({ submissionId: "s4", ref: "SES-004", title: "Talk D — Fully Loaded" });
  });

  it("refuses an id belonging to a different event, never throwing for the whole batch", async () => {
    const db = makeFakeDb(fixture(), new Map());
    const plan = await planSubmissionDelete(db, "ev1", ["s1", "s2"]);
    expect(plan.eligible.map((e) => e.submissionId)).toEqual(["s1"]);
    expect(plan.refused).toEqual([{ id: "s2", ref: "s2", reason: "Submission not found in this event" }]);
  });

  it("carries every eligible submission's file R2 keys for the route to delete before committing", async () => {
    const db = makeFakeDb(fixture(), new Map());
    const plan = await planSubmissionDelete(db, "ev1", ["s4"]);
    expect(plan.eligible[0]?.fileR2Keys.sort()).toEqual(["sub/s4/f1.pdf", "sub/s4/f2.pdf"]);
  });

  it("computes counts and scheduled correctly for a fully-loaded submission (DEC-921)", async () => {
    const db = makeFakeDb(fixture(), new Map());
    const plan = await planSubmissionDelete(db, "ev1", ["s4"]);
    expect(plan.eligible[0]?.counts).toEqual({
      files: 2,
      comments: 1, // only fc1 (fileId f1, owned by s4's file); fc2 belongs to an unrelated file
      participants: 1,
      answers: 1,
      tracks: 1,
      recusals: 1,
      revisions: 1,
      taskResponses: 1, // only ta1 (fileId f1); ta2 is on an unrelated file
      reviewAssignments: 2, // draft eval2 + submission-scoped plan_reviewer pr1
    });
    expect(plan.eligible[0]?.scheduled).toBe(true);
  });

  it("counts zero and scheduled false for a submission that owns nothing extra", async () => {
    const db = makeFakeDb(fixture(), new Map());
    const plan = await planSubmissionDelete(db, "ev1", ["s1"]);
    expect(plan.eligible[0]?.counts).toEqual({
      files: 0,
      comments: 0,
      participants: 0,
      answers: 0,
      tracks: 0,
      recusals: 0,
      revisions: 0,
      taskResponses: 0,
      reviewAssignments: 0,
    });
    expect(plan.eligible[0]?.scheduled).toBe(false);
  });

  it("issues exactly one grouped query per owned table for a multi-submission batch, never a query per submission", async () => {
    const selectCallsByTable = new Map<keyof State, number>();
    const db = makeFakeDb(fixture(), selectCallsByTable);
    // s1 (bare) and s4 (fully loaded) together — if counts were computed
    // per-submission, participants/answers/etc. calls would double.
    await planSubmissionDelete(db, "ev1", ["s1", "s4"]);

    expect(selectCallsByTable.get("participants")).toBe(1);
    expect(selectCallsByTable.get("submissionAnswers")).toBe(1);
    expect(selectCallsByTable.get("submissionTracks")).toBe(1);
    expect(selectCallsByTable.get("reviewRecusals")).toBe(1);
    expect(selectCallsByTable.get("submissionRevisions")).toBe(1);
    expect(selectCallsByTable.get("fileComments")).toBe(1);
    // evaluation is queried twice: once for the SUBMITTED refusal check,
    // once for the reviewAssignments fold — both grouped/set-based, never
    // per submission.
    expect(selectCallsByTable.get("evaluations")).toBe(2);
    expect(selectCallsByTable.get("planReviewers")).toBe(1);
    expect(selectCallsByTable.get("taskAssignments")).toBe(1);
    expect(selectCallsByTable.get("scheduleSlots")).toBe(1);
  });
});

describe("commitSubmissionDelete (DEC-886/921 cascade)", () => {
  it("removes every table the submission owns, leaves unrelated rows and email_log untouched, deletes the schedule_slot", async () => {
    const state = fixture();
    const db = makeFakeDb(state, new Map());

    const deleted = await commitSubmissionDelete(db, "ev1", ["s4"]);
    expect(deleted).toBe(1);

    expect(state.submissions.find((r) => r.id === "s4")).toBeUndefined();
    expect(state.files.filter((r) => r.submissionId === "s4")).toEqual([]);
    expect(state.submissionAnswers).toEqual([]);
    expect(state.submissionTracks).toEqual([]);
    expect(state.participants).toEqual([]);
    expect(state.reviewRecusals).toEqual([]);
    expect(state.submissionRevisions).toEqual([]);

    // DEC-886 amendment: s4's draft evaluation (eval2) is gone; the
    // submitted one for s3 is untouched.
    expect(state.evaluations.map((r) => r.id)).toEqual(["eval1"]);
    // The submission-scoped plan_reviewer row (pr1) is gone; the
    // plan/track-wide row (pr2, submissionId null) is untouched.
    expect(state.planReviewers.map((r) => r.id)).toEqual(["pr2"]);

    // schedule_slot for s4 is gone (DEC-921: an orphan slot 409s deleteRoom
    // forever) — no schedule_slot rows are left referencing s4.
    expect(state.scheduleSlots.filter((r) => r.submissionId === "s4")).toEqual([]);

    // file_comment rows tied to s4's files (f1) are gone; rows tied to an
    // unrelated file survive.
    expect(state.fileComments.map((r) => r.id)).toEqual(["fc2"]);

    // task_assignment rows are NEVER hard-deleted by the cascade (DEC-921):
    // ta1 (completed via s4's file f1) survives, reopened to pending with
    // its completion fields cleared; ta2 (unrelated file) is untouched.
    expect(state.taskAssignments.map((r) => r.id)).toEqual(["ta1", "ta2"]);
    const reopened = state.taskAssignments.find((r) => r.id === "ta1");
    expect(reopened).toMatchObject({ status: "pending", completedAt: null, completedBy: null, fileId: null });
    const untouched = state.taskAssignments.find((r) => r.id === "ta2");
    expect(untouched).toMatchObject({ status: "completed", fileId: "unrelated-file" });

    // email_log is historical fact — never touched by the cascade.
    expect(state.emailLog).toHaveLength(1);

    // Other submissions in the event are untouched.
    expect(state.submissions.some((r) => r.id === "s1")).toBe(true);
  });

  it("is a no-op for an empty id list", async () => {
    const state = fixture();
    const db = makeFakeDb(state, new Map());
    const deleted = await commitSubmissionDelete(db, "ev1", []);
    expect(deleted).toBe(0);
    expect(state.submissions).toHaveLength(4);
  });

  it("DEC-886: a submission with a SUBMITTED evaluation is refused by the plan and nothing is deleted", async () => {
    const state = fixture();
    const db = makeFakeDb(state, new Map());

    const plan = await planSubmissionDelete(db, "ev1", ["s3"]);
    expect(plan.eligible).toEqual([]);
    expect(plan.refused).toEqual([{ id: "s3", ref: "SES-003", reason: "Has at least one submitted evaluation" }]);

    // The caller never invokes commitSubmissionDelete for a refused id, so
    // s3's row and its submitted evaluation both survive untouched.
    expect(state.submissions.some((r) => r.id === "s3")).toBe(true);
    expect(state.evaluations.some((r) => r.id === "eval1")).toBe(true);
  });
});

describe("POST /events/:eventId/submissions/delete route (DEC-886 authz)", () => {
  // requireOrganizer runs before the handler body touches the db/repo
  // functions, so this exercises only the route's role gate — mirrors
  // test/files-delete-route.test.ts's authz-only route coverage.
  it("403s a non-organizer (e.g. speaker)", async () => {
    const { Hono } = await import("hono");
    const { registerErrorHandler } = await import("../src/server/http");
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    type AppEnvType = import("../src/server/env").AppEnv;
    type AuthInfoType = import("../src/server/env").AuthInfo;

    const app = new Hono<AppEnvType>();
    registerErrorHandler(app);
    const auth: AuthInfoType = { userId: "speaker-1", role: "speaker", orgId: "org-1", contactId: "contact-1" };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request("/api/v1/events/ev1/submissions/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1"] }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /events/:eventId/submissions/delete-plan route (DEC-921)", () => {
  it("403s a non-organizer (e.g. speaker)", async () => {
    const { Hono } = await import("hono");
    const { registerErrorHandler } = await import("../src/server/http");
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    type AppEnvType = import("../src/server/env").AppEnv;
    type AuthInfoType = import("../src/server/env").AuthInfo;

    const app = new Hono<AppEnvType>();
    registerErrorHandler(app);
    const auth: AuthInfoType = { userId: "speaker-1", role: "speaker", orgId: "org-1", contactId: "contact-1" };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request("/api/v1/events/ev1/submissions/delete-plan?ids=s1", { method: "GET" });
    expect(res.status).toBe(403);
  });

  it("returns eligible/refused with counts and scheduled, and never leaks fileR2Keys onto the wire", async () => {
    const { Hono } = await import("hono");
    const { registerErrorHandler } = await import("../src/server/http");
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    type AppEnvType = import("../src/server/env").AppEnv;
    type AuthInfoType = import("../src/server/env").AuthInfo;

    const db = makeFakeDb(fixture(), new Map());
    const app = new Hono<AppEnvType>();
    registerErrorHandler(app);
    const auth: AuthInfoType = { userId: "org-1", role: "organizer", orgId: "org-1" };
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      c.set("db", db);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request("/api/v1/events/ev1/submissions/delete-plan?ids=s4", { method: "GET" });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("fileR2Keys");
    expect(text).not.toContain("r2Key");

    const body = JSON.parse(text) as {
      eligible: { submissionId: string; ref: string; title: string; counts: unknown; scheduled: boolean }[];
      refused: unknown[];
    };
    expect(body.eligible).toHaveLength(1);
    expect(body.eligible[0]).toMatchObject({ submissionId: "s4", ref: "SES-004", scheduled: true });
    expect(body.eligible[0]?.counts).toEqual({
      files: 2,
      comments: 1,
      participants: 1,
      answers: 1,
      tracks: 1,
      recusals: 1,
      revisions: 1,
      taskResponses: 1,
      reviewAssignments: 2,
    });
    expect(body.refused).toEqual([]);
  });
});
