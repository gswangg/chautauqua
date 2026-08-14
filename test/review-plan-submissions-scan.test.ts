// DEC-346 amendment (wave 57) coverage: listPlanFilteredSubmissions
// (src/server/repo/review/submissions.ts) must (1) return byte-identical
// refs/titles/trackIds to the pre-fix shape for both the filterTracks and
// plain branches below MAX_PLAN_SUBMISSION_SCAN, (2) refuse loudly with an
// ApiError('invalid') naming the cap once the matched-submission count
// crosses it (never silently truncate), and (3) hydrate trackIds with
// queries scoped to the MATCHED submission ids only -- never a
// submission-joined, event-scoped scan. Exercised against an in-memory fake
// DB that evaluates the actual drizzle where/join conditions the repo
// builds, pattern copied from test/contacts-segment-scan-bounds.test.ts (no
// D1 test harness exists in this repo).

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { ApiError } from "../src/server/http";
import type { PlanRecord } from "../src/server/repo/review/plans";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
  };
});

const { listPlanFilteredSubmissions, MAX_PLAN_SUBMISSION_SCAN } = await import(
  "../src/server/repo/review/submissions"
);

const TABLE_SCHEMAS = { event: schema.event, submission: schema.submission, submissionTrack: schema.submissionTrack };

function tableNameOf(table: unknown): "event" | "submission" | "submissionTrack" {
  for (const [name, tbl] of Object.entries(TABLE_SCHEMAS)) {
    if (tbl === table) return name as "event" | "submission" | "submissionTrack";
  }
  throw new Error("fake db: unexpected table reference");
}

function resolveColRef(col: unknown): { table: string; field: string } | null {
  for (const [tableName, tableObj] of Object.entries(TABLE_SCHEMAS)) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return { table: tableName, field: key };
    }
  }
  return null;
}

function resolveVal(x: unknown, ctx: Record<string, Record<string, unknown>>): unknown {
  const ref = resolveColRef(x);
  if (ref) return ctx[ref.table]?.[ref.field];
  return x;
}

function evalExpr(marker: unknown, ctx: Record<string, Record<string, unknown>>): boolean {
  const m = marker as Marker;
  switch (m.__marker) {
    case "eq":
      return resolveVal(m.col, ctx) === resolveVal(m.val, ctx);
    case "and":
      return m.conds.every((c) => evalExpr(c, ctx));
    case "inArray":
      return m.vals.includes(resolveVal(m.col, ctx));
    default:
      throw new Error(`fake db: unhandled marker ${(m as { __marker: string }).__marker}`);
  }
}

interface FixtureEvent {
  id: string;
  recordPrefix: string;
}
interface FixtureSubmission {
  id: string;
  eventId: string;
  seq: number;
  title: string;
  status: string;
}
interface FixtureTrack {
  submissionId: string;
  trackId: string;
}

interface FakeCall {
  table: "event" | "submission" | "submissionTrack";
  joined: boolean;
  distinct: boolean;
  limitN?: number;
  orderByCalled: boolean;
  matchedCount: number;
}

function makeFakeDb(fixture: { events: FixtureEvent[]; submissions: FixtureSubmission[]; tracks: FixtureTrack[] }) {
  const calls: FakeCall[] = [];

  function builder(proj: Record<string, unknown> | undefined, distinct: boolean) {
    return {
      from(table: unknown) {
        const tableName = tableNameOf(table);
        let joinTable: "submissionTrack" | null = null;
        let whereExpr: unknown;
        let orderByCalled = false;
        let limitN: number | undefined;
        const chain = {
          innerJoin(table2: unknown, _expr: unknown) {
            joinTable = tableNameOf(table2) as "submissionTrack";
            return chain;
          },
          where(expr: unknown) {
            whereExpr = expr;
            return chain;
          },
          orderBy(..._args: unknown[]) {
            orderByCalled = true;
            return chain;
          },
          limit(n: number) {
            limitN = n;
            return chain;
          },
          then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
            return resolveNow().then(resolve, reject);
          },
        };
        function resolveNow(): Promise<unknown[]> {
          let ctxRows: Record<string, Record<string, unknown>>[];
          if (tableName === "event") {
            ctxRows = fixture.events.map((e) => ({ event: e as unknown as Record<string, unknown> }));
          } else if (tableName === "submission" && !joinTable) {
            ctxRows = fixture.submissions.map((s) => ({ submission: s as unknown as Record<string, unknown> }));
          } else if (tableName === "submission" && joinTable === "submissionTrack") {
            ctxRows = [];
            for (const s of fixture.submissions) {
              for (const t of fixture.tracks.filter((t) => t.submissionId === s.id)) {
                ctxRows.push({
                  submission: s as unknown as Record<string, unknown>,
                  submissionTrack: t as unknown as Record<string, unknown>,
                });
              }
            }
          } else if (tableName === "submissionTrack" && !joinTable) {
            ctxRows = fixture.tracks.map((t) => ({ submissionTrack: t as unknown as Record<string, unknown> }));
          } else {
            throw new Error(`fake db: unsupported table/join combo ${tableName}/${String(joinTable)}`);
          }

          let filtered = whereExpr ? ctxRows.filter((ctx) => evalExpr(whereExpr, ctx)) : ctxRows;

          if (tableName === "submission") {
            filtered = [...filtered].sort((a, b) => {
              const sa = a.submission as unknown as FixtureSubmission;
              const sb = b.submission as unknown as FixtureSubmission;
              if (sa.seq !== sb.seq) return sa.seq - sb.seq;
              return sa.id < sb.id ? -1 : sa.id > sb.id ? 1 : 0;
            });
          }

          calls.push({
            table: tableName,
            joined: joinTable !== null,
            distinct,
            limitN,
            orderByCalled,
            matchedCount: filtered.length,
          });

          if (limitN !== undefined) filtered = filtered.slice(0, limitN);

          let rows = filtered.map((ctx) => {
            const out: Record<string, unknown> = {};
            for (const [key, col] of Object.entries(proj ?? {})) {
              const ref = resolveColRef(col);
              if (!ref) throw new Error("fake db: projection column not found on any known table");
              out[key] = ctx[ref.table]?.[ref.field];
            }
            return out;
          });

          if (distinct) {
            const seen = new Set<string>();
            rows = rows.filter((r) => {
              const key = JSON.stringify(r);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }

          return Promise.resolve(rows);
        }
        return chain;
      },
    };
  }

  const db = {
    select(proj?: Record<string, unknown>) {
      return builder(proj, false);
    },
    selectDistinct(proj?: Record<string, unknown>) {
      return builder(proj, true);
    },
  };

  return { db: db as unknown as Db, calls };
}

const EVENT_ID = "event-1";
const EVENT: FixtureEvent = { id: EVENT_ID, recordPrefix: "SES" };

function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "plan-1",
    eventId: EVENT_ID,
    name: "Plan One",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    ...overrides,
  } as PlanRecord;
}

function makeSubmissions(n: number): FixtureSubmission[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sub-${String(i).padStart(5, "0")}`,
    eventId: EVENT_ID,
    seq: i + 1,
    title: `Talk ${i}`,
    status: "accepted",
  }));
}

describe("listPlanFilteredSubmissions (DEC-346 amendment, wave 57)", () => {
  it("no filterTracks: matches, ref/title/trackIds/status byte-identical to a naive reference, ordered seq asc", async () => {
    const submissions = makeSubmissions(4);
    const tracks: FixtureTrack[] = [
      { submissionId: submissions[0]!.id, trackId: "trk-a" },
      { submissionId: submissions[0]!.id, trackId: "trk-b" },
      { submissionId: submissions[2]!.id, trackId: "trk-a" },
    ];
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan);

    const expected = submissions
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((s) => ({
        id: s.id,
        ref: `SES-${String(s.seq).padStart(3, "0")}`,
        title: s.title,
        trackIds: tracks.filter((t) => t.submissionId === s.id).map((t) => t.trackId),
        status: s.status,
      }));
    expect(result).toEqual(expected);
  });

  it("filterTracks set: only submissions with a matching track come back, deduped (no join fan-out), trackIds still the FULL set for each", async () => {
    const submissions = makeSubmissions(3);
    const tracks: FixtureTrack[] = [
      { submissionId: submissions[0]!.id, trackId: "trk-a" },
      { submissionId: submissions[0]!.id, trackId: "trk-b" }, // two matches on filter -- must not duplicate the submission
      { submissionId: submissions[1]!.id, trackId: "trk-c" },
    ];
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan({ filters: { trackIds: ["trk-a", "trk-b"] } });

    const result = await listPlanFilteredSubmissions(db, plan);

    expect(result).toEqual([
      {
        id: submissions[0]!.id,
        ref: "SES-001",
        title: submissions[0]!.title,
        trackIds: ["trk-a", "trk-b"],
        status: "accepted",
      },
    ]);
  });

  it("withTrackIds: false skips the trackIds hydration entirely (no submissionTrack call at all)", async () => {
    const submissions = makeSubmissions(2);
    const tracks: FixtureTrack[] = [{ submissionId: submissions[0]!.id, trackId: "trk-a" }];
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan, { withTrackIds: false });

    expect(result.every((r) => r.trackIds.length === 0)).toBe(true);
    expect(calls.some((c) => c.table === "submissionTrack")).toBe(false);
  });

  it("matched-submission query is ordered and capped at MAX_PLAN_SUBMISSION_SCAN + 1", async () => {
    const submissions = makeSubmissions(5);
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks: [] });
    const plan = makePlan();

    await listPlanFilteredSubmissions(db, plan);

    const submissionCall = calls.find((c) => c.table === "submission" && !c.joined);
    expect(submissionCall).toBeDefined();
    expect(submissionCall!.orderByCalled).toBe(true);
    expect(submissionCall!.limitN).toBe(MAX_PLAN_SUBMISSION_SCAN + 1);
  });

  it("exactly-cap matched rows passes; cap+1 refuses loudly naming the cap, for both branches", async () => {
    const atCap = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN);
    const { db: dbAtCap } = makeFakeDb({ events: [EVENT], submissions: atCap, tracks: [] });
    await expect(listPlanFilteredSubmissions(dbAtCap, makePlan())).resolves.toBeDefined();

    const overCap = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN + 1);
    const { db: dbOverCap } = makeFakeDb({ events: [EVENT], submissions: overCap, tracks: [] });
    await expect(listPlanFilteredSubmissions(dbOverCap, makePlan())).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_PLAN_SUBMISSION_SCAN)),
    });

    // filterTracks branch too -- every submission tagged with the filtered track.
    const overCapFiltered = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN + 1);
    const filteredTracks: FixtureTrack[] = overCapFiltered.map((s) => ({ submissionId: s.id, trackId: "trk-a" }));
    const { db: dbOverCapFiltered } = makeFakeDb({
      events: [EVENT],
      submissions: overCapFiltered,
      tracks: filteredTracks,
    });
    await expect(
      listPlanFilteredSubmissions(dbOverCapFiltered, makePlan({ filters: { trackIds: ["trk-a"] } })),
    ).rejects.toBeInstanceOf(ApiError);
    // Builds ~60k fixture rows (3x the 20k cap); ~2.6s solo but slower under
    // full-suite CPU contention, so it needs more than the 5s default timeout.
  }, 30_000);

  it("trackIds hydration is id-scoped to the matched set -- never joins submission, never event-scoped", async () => {
    const submissions = makeSubmissions(3);
    const tracks: FixtureTrack[] = [
      { submissionId: submissions[0]!.id, trackId: "trk-a" },
      { submissionId: submissions[1]!.id, trackId: "trk-b" },
    ];
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    await listPlanFilteredSubmissions(db, plan);

    const trackCalls = calls.filter((c) => c.table === "submissionTrack");
    expect(trackCalls.length).toBe(1); // 3 matched ids, well under ID_CHUNK_SIZE (90) -- one chunk
    expect(trackCalls[0]!.joined).toBe(false); // never joined against submission
    expect(trackCalls[0]!.matchedCount).toBe(2); // only the 2 rows for the 3 matched ids, not a whole-event scan
  });

  it("trackIds hydration issues one chunked call per ID_CHUNK_SIZE(90) matched ids, never a single unbounded scan", async () => {
    const submissions = makeSubmissions(95);
    const tracks: FixtureTrack[] = submissions.map((s) => ({ submissionId: s.id, trackId: "trk-a" }));
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan);
    expect(result.length).toBe(95);
    expect(result.every((r) => r.trackIds.length === 1)).toBe(true);

    const trackCalls = calls.filter((c) => c.table === "submissionTrack");
    expect(trackCalls.length).toBe(2); // 95 ids / 90-per-chunk = 2 batches
  });
});
