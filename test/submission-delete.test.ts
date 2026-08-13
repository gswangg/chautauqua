// DEC-886 repo coverage for the guarded submission-delete cascade: a
// SUBMITTED evaluation refuses the submission, a cross-event id is refused
// (never a whole-batch throw), the cascade removes every table the
// submission owns, and email_log is never touched.
//
// This repo has no local sqlite/D1 test driver (see test/files-delete.test.ts's
// sibling comment). Rather than hand-interpreting drizzle-orm's internal SQL
// tree per call site, drizzle-orm's query-condition builders (eq/inArray/
// and/isNotNull) are mocked to build a tiny predicate AST that the fake db
// below evaluates directly against in-memory rows via a column->accessor
// map — schema table/column objects are used as-is (real identity), only
// their downstream SQL compilation is swapped out.

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
  files: Row[];
  taskAssignments: Row[];
  fileComments: Row[];
  submissionAnswers: Row[];
  submissionTracks: Row[];
  participants: Row[];
  reviewRecusals: Row[];
  submissionRevisions: Row[];
  emailLog: Row[];
}

function colMap(): Map<unknown, (row: Row) => unknown> {
  const m = new Map<unknown, (row: Row) => unknown>();
  m.set(schema.event.id, (r) => r.id);
  m.set(schema.event.recordPrefix, (r) => r.recordPrefix);
  m.set(schema.submission.id, (r) => r.id);
  m.set(schema.submission.eventId, (r) => r.eventId);
  m.set(schema.submission.seq, (r) => r.seq);
  m.set(schema.submission.title, (r) => r.title);
  m.set(schema.evaluation.submissionId, (r) => r.submissionId);
  m.set(schema.evaluation.submittedAt, (r) => r.submittedAt);
  m.set(schema.file.submissionId, (r) => r.submissionId);
  m.set(schema.file.r2Key, (r) => r.r2Key);
  m.set(schema.file.id, (r) => r.id);
  m.set(schema.taskAssignment.fileId, (r) => r.fileId);
  m.set(schema.fileComment.fileId, (r) => r.fileId);
  m.set(schema.submissionAnswer.submissionId, (r) => r.submissionId);
  m.set(schema.submissionTrack.submissionId, (r) => r.submissionId);
  m.set(schema.participant.submissionId, (r) => r.submissionId);
  m.set(schema.reviewRecusal.submissionId, (r) => r.submissionId);
  m.set(schema.submissionRevision.submissionId, (r) => r.submissionId);
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

function makeFakeDb(state: State) {
  const cols = colMap();
  const tableKey = new Map<unknown, keyof State>([
    [schema.event, "events"],
    [schema.submission, "submissions"],
    [schema.evaluation, "evaluations"],
    [schema.file, "files"],
    [schema.taskAssignment, "taskAssignments"],
    [schema.fileComment, "fileComments"],
    [schema.submissionAnswer, "submissionAnswers"],
    [schema.submissionTrack, "submissionTracks"],
    [schema.participant, "participants"],
    [schema.reviewRecusal, "reviewRecusals"],
    [schema.submissionRevision, "submissionRevisions"],
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
              const rows = arrFor(table)
                .filter((r) => evalPred(cond, r, cols))
                .map((r) => project(r, proj));
              const p = Promise.resolve(rows) as Promise<Row[]> & { limit: (n: number) => Promise<Row[]> };
              p.limit = (n: number) => Promise.resolve(rows.slice(0, n));
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
  };
  return db as unknown as Db;
}

function fixture(): State {
  return {
    events: [{ id: "ev1", recordPrefix: "SES" }],
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
    files: [
      { id: "f1", submissionId: "s4", r2Key: "sub/s4/f1.pdf" },
      { id: "f2", submissionId: "s4", r2Key: "sub/s4/f2.pdf" },
    ],
    taskAssignments: [
      { id: "ta1", taskId: "t1", contactId: "c1", fileId: "f1" },
      { id: "ta2", taskId: "t2", contactId: "c2", fileId: "unrelated-file" },
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
    emailLog: [{ id: "el1", submissionId: "s4", toEmail: "a@example.com" }],
  };
}

describe("planSubmissionDelete (DEC-886)", () => {
  it("refuses a submission with at least one SUBMITTED evaluation, naming the reason", async () => {
    const db = makeFakeDb(fixture());
    const plan = await planSubmissionDelete(db, "ev1", ["s3"]);
    expect(plan.eligible).toEqual([]);
    expect(plan.refused).toEqual([{ id: "s3", ref: "SES-003", reason: "Has at least one submitted evaluation" }]);
  });

  it("does NOT refuse a submission whose evaluation exists but was never submitted (submittedAt null)", async () => {
    const db = makeFakeDb(fixture());
    const plan = await planSubmissionDelete(db, "ev1", ["s4"]);
    expect(plan.refused).toEqual([]);
    expect(plan.eligible).toHaveLength(1);
    expect(plan.eligible[0]).toMatchObject({ submissionId: "s4", ref: "SES-004", title: "Talk D — Fully Loaded" });
  });

  it("refuses an id belonging to a different event, never throwing for the whole batch", async () => {
    const db = makeFakeDb(fixture());
    const plan = await planSubmissionDelete(db, "ev1", ["s1", "s2"]);
    expect(plan.eligible.map((e) => e.submissionId)).toEqual(["s1"]);
    expect(plan.refused).toEqual([{ id: "s2", ref: "s2", reason: "Submission not found in this event" }]);
  });

  it("carries every eligible submission's file R2 keys for the route to delete before committing", async () => {
    const db = makeFakeDb(fixture());
    const plan = await planSubmissionDelete(db, "ev1", ["s4"]);
    expect(plan.eligible[0]?.fileR2Keys.sort()).toEqual(["sub/s4/f1.pdf", "sub/s4/f2.pdf"]);
  });
});

describe("commitSubmissionDelete (DEC-886 cascade)", () => {
  it("removes every table the submission owns, leaves unrelated rows and email_log untouched", async () => {
    const state = fixture();
    const db = makeFakeDb(state);

    const deleted = await commitSubmissionDelete(db, "ev1", ["s4"]);
    expect(deleted).toBe(1);

    expect(state.submissions.find((r) => r.id === "s4")).toBeUndefined();
    expect(state.files.filter((r) => r.submissionId === "s4")).toEqual([]);
    expect(state.submissionAnswers).toEqual([]);
    expect(state.submissionTracks).toEqual([]);
    expect(state.participants).toEqual([]);
    expect(state.reviewRecusals).toEqual([]);
    expect(state.submissionRevisions).toEqual([]);

    // task_assignment/file_comment rows tied to s4's files (f1) are gone;
    // rows tied to an unrelated file survive.
    expect(state.taskAssignments.map((r) => r.id)).toEqual(["ta2"]);
    expect(state.fileComments.map((r) => r.id)).toEqual(["fc2"]);

    // email_log is historical fact — never touched by the cascade.
    expect(state.emailLog).toHaveLength(1);

    // Other submissions in the event are untouched.
    expect(state.submissions.some((r) => r.id === "s1")).toBe(true);
  });

  it("is a no-op for an empty id list", async () => {
    const state = fixture();
    const db = makeFakeDb(state);
    const deleted = await commitSubmissionDelete(db, "ev1", []);
    expect(deleted).toBe(0);
    expect(state.submissions).toHaveLength(4);
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
