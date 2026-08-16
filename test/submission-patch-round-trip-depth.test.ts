// DEC-155 (wave-60, task w60-d): P1-PERF -- PATCH /api/v1/submissions/:id
// measured ~533ms adjusted on real D1, paid on every organiser field save.
// The cause is round-trip COUNT, not scale: resolveActorName and the two
// writeRoleAnswer field-id lookups used to run strictly sequentially AFTER
// the write phase; they are reads of things the write never touches, so
// they are hoisted into the same settleInDeclarationOrder wave as
// trackIds/format/audienceLevel/content validation. This test proves the
// collapse BEHAVIOURALLY -- an instrumented fake `Db` whose every SELECT
// resolves only after a real 8ms macrotask delay, tracking both the maximum
// number of simultaneously in-flight statements AND the number of distinct
// sequential "waves" (bursts starting from zero in-flight) -- mirroring
// test/agenda-round-trip-depth.test.ts's approach (DEC-338: prove it
// behaviourally, never with a source grep). A second test pins the PATCH
// JSON response for a description-only edit. A third proves an ownership
// failure still 404s before any other read is observed.

import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

const ORG_A = "org-a";
const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

interface Tracker {
  inFlight: number;
  max: number;
  waves: number;
}

/** Same fake shape as test/agenda-round-trip-depth.test.ts: every SELECT
 * resolves only after a real macrotask delay, tracking maximum simultaneous
 * in-flight statements. Extended here with a `waves` counter -- incremented
 * only when a statement starts while nothing else is in flight -- so the
 * test can pin the total number of sequential read rounds (the "depth"),
 * not just the peak overlap within one round. Rows are looked up by the
 * table object passed to `.from()`; INSERT/UPDATE/DELETE resolve
 * immediately and never touch the tracker (DEC-155's HARD CONSTRAINT that
 * no write is ever parallelized is a source-level property of the handler,
 * not something this fake need re-check). */
function makeInstrumentedDb(rowsByTable: Map<unknown, unknown[]>, tracker: Tracker): Db {
  function selectChain(state: { table: unknown }) {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit"]) {
      self[method] = (arg?: unknown) => {
        if (method === "from") state.table = arg;
        return self;
      };
    }
    self.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      if (tracker.inFlight === 0) tracker.waves += 1;
      tracker.inFlight += 1;
      tracker.max = Math.max(tracker.max, tracker.inFlight);
      return new Promise<void>((r) => setTimeout(r, 8))
        .then(() => {
          tracker.inFlight -= 1;
          resolve(rowsByTable.get(state.table) ?? []);
        })
        .catch((e: unknown) => {
          tracker.inFlight -= 1;
          reject(e);
        });
    };
    return self;
  }
  // updateSubmissionFields writes title/description straight onto the
  // submission row `getSubmissionDetail` re-reads a few lines later, in the
  // SAME request -- to pin a realistic response body (not the pre-write
  // snapshot), UPDATE .set({...}) on schema.submission is applied to the
  // fixture row in place. Every other write (insert/delete, updates to any
  // other table) is a true no-op, matching test/agenda-round-trip-depth's
  // fake -- writes are not the thing under test here (DEC-155's HARD
  // CONSTRAINT that no write is ever parallelized is a source-level
  // property, not something this fake re-checks).
  function writeChain(table?: unknown, isUpdate?: boolean) {
    const self: Record<string, unknown> = {};
    self.values = () => self;
    self.set = (patch: Record<string, unknown>) => {
      if (isUpdate && table === schema.submission) {
        const row = rowsByTable.get(schema.submission)?.[0] as Record<string, unknown> | undefined;
        if (row) Object.assign(row, patch);
      }
      return self;
    };
    self.where = () => self;
    self.onConflictDoUpdate = () => self;
    self.then = (resolve: (v: unknown) => void) => resolve(undefined);
    return self;
  }
  return {
    select: (_cols?: unknown) => selectChain({ table: undefined }),
    insert: (_table?: unknown) => writeChain(),
    update: (table?: unknown) => writeChain(table, true),
    delete: (_table?: unknown) => writeChain(),
  } as unknown as Db;
}

const SUBMISSION_ROW = {
  id: "sub-1",
  eventId: "event-1",
  formId: "form-1",
  seq: 7,
  title: "Old Title",
  description: "Old description",
  status: "accepted",
  contentStatus: "approved",
  acceptedAt: null,
  icsSequence: 2,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  recordPrefix: "EV",
  orgId: ORG_A,
  startDate: "2026-08-10",
  slotDay: null,
  slotStartMin: null,
  slotEndMin: null,
  slotRoomName: null,
  reuploaded: 0,
};

function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  // Fresh copy per test -- writeChain's UPDATE .set() mutates this row in
  // place (see below), and SUBMISSION_ROW itself is a shared module-level
  // fixture read by the response-pin assertions.
  rows.set(schema.submission, [{ ...SUBMISSION_ROW }]);
  rows.set(schema.user, [{ id: "u1", email: "organizer@example.com", contactId: null }]);
  rows.set(schema.track, [{ id: "track-1", name: "Track One", position: 0 }]);
  // Backs getFormatFieldOptions/getFieldOptionsByRole (parseFormatField/
  // parseAudienceLevelField) AND the hoisted getEventFieldIdByRole lookups
  // -- the fake ignores which columns a query selects, so one row supplies
  // both `id` (for the field-id reads) and `optionsJson` (for the options
  // reads), and must list every value this fixture's PATCH bodies use.
  rows.set(schema.formField, [{ id: "field-1", optionsJson: JSON.stringify(["talk", "beginner"]) }]);
  rows.set(schema.participant, []);
  rows.set(schema.submissionTrack, []);
  rows.set(schema.submissionAnswer, []);
  rows.set(schema.file, []);
  return rows;
}

async function buildApp(db: Db) {
  const { submissionsRoutes } = await import("../src/routes/api/submissions");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", AUTH);
    c.set("db", db);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

async function patchSubmission(db: Db, id: string, body: unknown) {
  const app = await buildApp(db);
  return app.request(
    `/api/v1/submissions/${id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    },
    {} as unknown as AppEnv["Bindings"],
  );
}

afterEach(() => {
  // no mocks used in this file, but keep the established afterEach shape
  // (test/agenda-round-trip-depth.test.ts) for consistency.
});

describe("DEC-155 (wave-60, w60-d): PATCH submission collapses its pre-write read waterfall", () => {
  it("hoists resolveActorName + both writeRoleAnswer field-id lookups into the validation wave (7-way overlap)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const res = await patchSubmission(db, "sub-1", {
      title: "New Title",
      trackIds: ["track-1"],
      format: "talk",
      audienceLevel: "beginner",
    });
    expect(res.status).toBe(200);
    // Wave 1: getSubmissionOwnership (alone, authz gate). Wave 2: the
    // settleInDeclarationOrder call -- trackIds, format, audienceLevel,
    // content, editorName, formatFieldId, audienceLevelFieldId, all 7
    // simultaneously in flight. Waves 3-7: getSubmissionDetail's own
    // internal sequential reads (main row, participants, tracks, answers,
    // answer-files -- historyRows is skipped because there are zero
    // participants) are untouched by this task's scope and stay serial.
    expect(tracker.max).toBeGreaterThanOrEqual(7);
    expect(tracker.waves).toBe(7);
  });

  it("a description-only edit still overlaps its 2 real hoisted reads (content + editorName)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const res = await patchSubmission(db, "sub-1", { description: "New description" });
    expect(res.status).toBe(200);
    // trackIds/format/audienceLevel/formatFieldId/audienceLevelFieldId are
    // all Promise.resolve(undefined) here (none of those fields were sent)
    // -- only content + editorName are real reads, but they still overlap.
    expect(tracker.max).toBeGreaterThanOrEqual(2);
  });

  it("pins the PATCH JSON response for a description-only edit", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const res = await patchSubmission(db, "sub-1", { description: "New description" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { updatedAt: number };
    // updateSubmissionFields stamps a fresh updatedAt (real wall-clock
    // `new Date()`, not something this fake controls) -- pin every other
    // field exactly and only assert updatedAt's type/monotonicity.
    expect(typeof body.updatedAt).toBe("number");
    expect(body.updatedAt).toBeGreaterThanOrEqual(SUBMISSION_ROW.updatedAt.getTime());
    expect(body).toEqual({
      id: "sub-1",
      eventId: "event-1",
      ref: "EV-007",
      title: "Old Title",
      description: "New description",
      status: "accepted",
      contentStatus: "approved",
      trackIds: [],
      formId: "form-1",
      acceptedAt: null,
      icsSequence: 2,
      createdAt: SUBMISSION_ROW.createdAt.getTime(),
      updatedAt: body.updatedAt,
      participants: [],
      answers: {},
      answerFiles: [],
      slot: null,
      reuploaded: false,
    });
  });

  it("an ownership failure still 404s before any other read is observed", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const rows = buildRowsByTable();
    rows.set(schema.submission, []); // getSubmissionOwnership finds nothing
    const db = makeInstrumentedDb(rows, tracker);
    const res = await patchSubmission(db, "sub-missing", { description: "New description" });
    expect(res.status).toBe(404);
    // Exactly one read (the ownership check) is ever issued -- the
    // validation wave, resolveActorName and the field-id lookups must never
    // start once ownership has already failed.
    expect(tracker.waves).toBe(1);
    expect(tracker.max).toBe(1);
  });
});
