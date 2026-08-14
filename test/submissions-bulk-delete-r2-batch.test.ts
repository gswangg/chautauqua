// DEC-713 amendment (wave 50) coverage: POST /events/:eventId/submissions/delete
// must delete every eligible submission's R2 deliverables via FileStore's
// batched deleteMany (O(chunks) R2 round trips), not a per-key loop, and
// must commit the DB row delete BEFORE the R2 objects are removed — a
// committed row must never point at bytes that vanished silently, whereas an
// orphaned object is just an unreferenced blob. Mirrors
// test/submission-delete.test.ts's fake-db harness (drizzle-orm
// query-condition builders mocked to a tiny predicate AST evaluated against
// in-memory rows).

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

// Shared event log — every DB delete/update call appends a marker here so
// the test can assert ordering against the FileStore deleteMany calls,
// which append to the same log.
type EventLog = string[];

function makeFakeDb(state: State, log: EventLog) {
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
              const filtered = arrFor(table).filter((r) => evalPred(cond, r, cols));
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
              p.groupBy = (...groupCols: unknown[]) => {
                const keyFor = (row: Row) => groupCols.map((gc) => cols.get(gc)!(row)).join(" ");
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
          log.push("db:delete");
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
              log.push("db:update");
              const rows = arrFor(table);
              const patched = rows.map((r) => {
                if (!evalPred(cond, r, cols)) return r;
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

const N = 25; // >= 20 eligible submissions
const KEYS_PER_SUB = 3; // >= 2 R2 keys each

function fixture(): State {
  const submissions: Row[] = [];
  const files: Row[] = [];
  for (let i = 1; i <= N; i++) {
    const subId = `s${i}`;
    submissions.push({ id: subId, eventId: "ev1", seq: i, title: `Talk ${i}` });
    for (let k = 1; k <= KEYS_PER_SUB; k++) {
      files.push({ id: `f${i}-${k}`, submissionId: subId, r2Key: `sub/${subId}/f${k}.pdf` });
    }
  }
  return {
    events: [{ id: "ev1", recordPrefix: "SES", orgId: "org-1" }],
    submissions,
    evaluations: [], // none submitted — every submission is eligible
    planReviewers: [],
    files,
    taskAssignments: [],
    fileComments: [],
    submissionAnswers: [],
    submissionTracks: [],
    participants: [],
    reviewRecusals: [],
    submissionRevisions: [],
    scheduleSlots: [],
    emailLog: [],
  };
}

// Fake R2Bucket recording every deleteMany call as one entry (the array it
// received), plus an ordering marker into the shared log.
function fakeFilesBucket(log: EventLog, deleteManyCalls: string[][]) {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete(keys: string | string[]) {
      const arr = Array.isArray(keys) ? keys : [keys];
      deleteManyCalls.push(arr);
      log.push("r2:delete");
    },
  } as unknown as R2Bucket;
}

async function buildApp(db: Db, files: R2Bucket) {
  const { Hono } = await import("hono");
  const { registerErrorHandler } = await import("../src/server/http");
  const { submissionsRoutes } = await import("../src/routes/api/submissions");
  type AppEnvType = import("../src/server/env").AppEnv;
  type AuthInfoType = import("../src/server/env").AuthInfo;

  const app = new Hono<AppEnvType>();
  registerErrorHandler(app);
  const auth: AuthInfoType = { userId: "org-user-1", role: "organizer", orgId: "org-1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    c.env = { ...(c.env ?? {}), FILES: files } as never;
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

describe("POST /events/:eventId/submissions/delete — R2 batch delete (DEC-713 wave-50 amendment)", () => {
  it("batches R2 deletes (O(chunks), not O(keys)), deletes the exact key set, after the DB commit, and keeps {deleted, refused}", async () => {
    const state = fixture();
    const log: EventLog = [];
    const db = makeFakeDb(state, log);
    const deleteManyCalls: string[][] = [];
    const files = fakeFilesBucket(log, deleteManyCalls);
    const app = await buildApp(db, files);

    const ids = state.submissions.map((r) => r.id as string);
    // Snapshot expected keys BEFORE the request — commitSubmissionDelete
    // mutates state.submissions/state.files in place.
    const expectedKeys = ids.flatMap((subId) => Array.from({ length: KEYS_PER_SUB }, (_, k) => `sub/${subId}/f${k + 1}.pdf`));

    const res = await app.request("/api/v1/events/ev1/submissions/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: number; refused: unknown[] };
    expect(body).toEqual({ deleted: N, refused: [] });

    // (a) O(chunks), not O(keys): N*KEYS_PER_SUB keys is well under the
    // 1000-key chunk size, so exactly one deleteMany/R2-delete call — never
    // one per key (which would be N*KEYS_PER_SUB calls).
    expect(deleteManyCalls).toHaveLength(1);

    // (b) the exact set of keys deleted equals the union of every eligible
    // item's fileR2Keys.
    expect(deleteManyCalls[0]?.slice().sort()).toEqual(expectedKeys.slice().sort());

    // (c) the DB commit happens before any R2 delete (row first, bytes
    // second — DEC-713 amendment wave 50).
    const firstDbIdx = log.findIndex((e) => e.startsWith("db:"));
    const firstR2Idx = log.findIndex((e) => e === "r2:delete");
    expect(firstDbIdx).toBeGreaterThanOrEqual(0);
    expect(firstR2Idx).toBeGreaterThan(firstDbIdx);

    // (d) DB rows are actually gone (commit ran) and refusal semantics are
    // unchanged — an id belonging to another event is refused, not thrown.
    expect(state.submissions).toHaveLength(0);
  });

  it("still refuses a submitted-evaluation submission and a cross-event id, and never calls R2 delete for zero eligible ids", async () => {
    const state = fixture();
    // Make every submission ineligible via a submitted evaluation, plus one
    // cross-event id.
    state.evaluations = state.submissions.map((r) => ({ id: `ev-${r.id}`, submissionId: r.id, submittedAt: 1 }));
    const log: EventLog = [];
    const db = makeFakeDb(state, log);
    const deleteManyCalls: string[][] = [];
    const files = fakeFilesBucket(log, deleteManyCalls);
    const app = await buildApp(db, files);

    const res = await app.request("/api/v1/events/ev1/submissions/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1", "s2", "cross-event-id"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: number; refused: { id: string; reason: string }[] };
    expect(body.deleted).toBe(0);
    expect(body.refused.map((r) => r.id).sort()).toEqual(["cross-event-id", "s1", "s2"]);
    // deleteMany([]) is a documented no-op: it issues zero R2 calls when
    // there is nothing eligible.
    expect(deleteManyCalls).toEqual([]);
  });
});
