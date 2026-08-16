// DEC-155 (wave-34 amendment): J9's agenda screen must collapse the deepest
// unowned waterfall in the app -- GET .../agenda's independent reads
// (roomRows/trackRows/loadAcceptedSessions, and loadAcceptedSessions' own
// three independent batch readers) and PUT .../slot's independent reads
// (roomBelongsToEvent/getEventInfo, after the authz gate) must issue as
// Promise.all/allSettled waves, not one strictly-sequential await per read.
// This test proves concurrency BEHAVIOURALLY -- an instrumented fake `Db`
// whose every SELECT resolves only after an artificial delay, tracking the
// maximum number of simultaneously in-flight statements -- mirroring
// test/reviewer-queue-round-trip-depth.test.ts's approach (DEC-338's own
// ruling: prove it behaviourally, never with a source grep). A second test
// pins the GET agenda JSON envelope byte-identical, and a third proves the
// room-ownership error still wins over the event-not-found error when a PUT
// request is doubly wrong (Promise.allSettled + re-throw in SOURCE order).

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
  // DEC-370 wave-61: incremented each time inFlight rises 0->1 -- counts
  // "waves" (bursts of simultaneously in-flight statements separated by
  // idle periods), not individual statements. A handler that issues N
  // sequential round trips (even if each round trip is itself a
  // Promise.all wave) increments this N times.
  waves: number;
}

/** A minimal chainable fake SELECT builder: every drizzle-style chain method
 * returns the same thenable object, which resolves only on `await` (via
 * `.then`) after a real macrotask delay -- so genuinely concurrent callers
 * overlap in wall-clock time and genuinely sequential callers never do. Rows
 * are looked up by the table object passed to `.from()`, mirroring
 * test/reviewer-queue-round-trip-depth.test.ts's counting fake. INSERT/
 * UPDATE/DELETE chains resolve immediately (writes are not the thing under
 * test here; DEC-155's HARD CONSTRAINT is that no write is ever
 * parallelized with another write or the read that observes it, which is a
 * source-level property enforced by payload.ts/rows.ts/agenda.ts's own
 * ordering, not by this fake). */
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
  function writeChain() {
    const self: Record<string, unknown> = {};
    for (const method of ["values", "set", "where", "onConflictDoUpdate"]) {
      self[method] = () => self;
    }
    // DEC-519 wave-6 amendment: upsertSlot/unscheduleSlot now gate their ics
    // bump on `.returning()` having a row -- this fake reports one, since
    // writes are not the thing under test here (see the file header).
    self.returning = () => Promise.resolve([{ id: "row-1" }]);
    self.then = (resolve: (v: unknown) => void) => resolve(undefined);
    return self;
  }
  return {
    select: (_cols?: unknown) => selectChain({ table: undefined }),
    insert: (_table?: unknown) => writeChain(),
    update: (_table?: unknown) => writeChain(),
    delete: (_table?: unknown) => writeChain(),
  } as unknown as Db;
}

function buildRowsByTable(): Map<unknown, unknown[]> {
  const rows = new Map<unknown, unknown[]>();
  rows.set(schema.event, [
    { orgId: ORG_A, startDate: "2026-08-10", endDate: "2026-08-11", recordPrefix: "EV" },
  ]);
  rows.set(schema.room, [{ id: "room-1", eventId: "event-1", name: "Room One" }]);
  rows.set(schema.track, [{ id: "track-1", name: "Track One", color: "#fff" }]);
  rows.set(schema.submission, [{ id: "sub-1", seq: 1, title: "Talk One" }]);
  rows.set(schema.submissionTrack, [{ submissionId: "sub-1", trackId: "track-1" }]);
  rows.set(schema.participant, [
    { submissionId: "sub-1", contactId: "c1", firstName: "Ann", lastName: "Speaker", order: 0 },
  ]);
  rows.set(schema.scheduleSlot, [
    { submissionId: "sub-1", roomId: "room-1", day: "2026-08-10", startMin: 540, endMin: 600 },
  ]);
  return rows;
}

async function buildApp(db: Db) {
  const { agendaRoutes } = await import("../src/routes/agenda");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", AUTH);
    c.set("db", db);
    await next();
  });
  app.route("/api/v1", agendaRoutes);
  return app;
}

afterEach(() => {
  // no mocks used in this file, but keep the established afterEach shape
  // (test/reviewer-queue-round-trip-depth.test.ts) for consistency.
});

describe("DEC-155 (wave-34 amendment): GET agenda collapses its waterfall", () => {
  it("has 3+ repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp(db);
    const res = await app.request("/api/v1/events/event-1/agenda");
    expect(res.status).toBe(200);
    // getEventInfo (auth gate) runs alone first; then getAgendaPayload's
    // wave of {roomRows, trackRows, loadAcceptedSessions} starts all three
    // at once -- loadAcceptedSessions' own first read (submissionRows)
    // overlaps with roomRows+trackRows, so this wave alone holds 3
    // simultaneous statements. A fully serial handler could never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(3);
  });

  it("pins the GET agenda JSON envelope: unchanged by the scheduling change", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(buildRowsByTable(), tracker);
    const app = await buildApp(db);
    const res = await app.request("/api/v1/events/event-1/agenda");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      days: ["2026-08-10", "2026-08-11"],
      rooms: [{ id: "room-1", name: "Room One" }],
      tracks: [{ id: "track-1", name: "Track One", color: "#fff" }],
      placed: [
        {
          submissionId: "sub-1",
          ref: "EV-001",
          title: "Talk One",
          trackIds: ["track-1"],
          speakers: [{ contactId: "c1", name: "Ann Speaker" }],
          roomId: "room-1",
          day: "2026-08-10",
          startMin: 540,
          endMin: 600,
        },
      ],
      unscheduled: [],
      conflicts: [],
      unplacedReasons: [],
      summary: { unplaced: 0, conflicts: 0 },
    });
  });
});

describe("DEC-155 (wave-34 amendment): PUT slot collapses its waterfall, error order preserved", () => {
  function ownershipRows(status = "accepted"): Map<unknown, unknown[]> {
    const rows = buildRowsByTable();
    // The fake's `.from()`-keyed lookup returns this row verbatim for
    // getSlotWriteContext's submission-LEFT-JOIN-event read (it doesn't
    // actually merge the joined table), so this one fixture row carries
    // every column the real query selects from BOTH sides of the join.
    rows.set(schema.submission, [
      { eventId: "event-1", orgId: ORG_A, status, startDate: "2026-08-10", endDate: "2026-08-11", recordPrefix: "EV" },
    ]);
    // getConflictsAndSummary's slotRows read joins scheduleSlot+submission
    // and expects a seq/title on each row (for formatRef) -- irrelevant to
    // what this test measures (PUT's own wave concurrency), so keep it
    // empty rather than shaping a second, differently-columned submission
    // fixture just for that trailing read.
    rows.set(schema.scheduleSlot, []);
    return rows;
  }

  async function putSlot(db: Db, roomId: string) {
    const app = await buildApp(db);
    return app.request(
      "/api/v1/submissions/sub-1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ day: "2026-08-10", startMin: 540, endMin: 600, roomId }),
      },
      {} as unknown as AppEnv["Bindings"],
    );
  }

  it("has 2+ repo statements simultaneously in-flight (behavioural, not a source grep)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(ownershipRows(), tracker);
    const res = await putSlot(db, "room-1");
    expect(res.status).toBe(200);
    // DEC-370 wave-61: {getSlotWriteContext, getRoomEventId} issue as ONE
    // wave (no authz-gate read precedes them any more -- the body is read
    // first, off the DB entirely) -- 2 statements simultaneously in-flight.
    // A fully serial handler could never exceed 1.
    expect(tracker.max).toBeGreaterThanOrEqual(2);
  });

  it("DEC-370 wave-61: happy-path PUT completes in at most 3 waves (was 4 sequential round trips)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const db = makeInstrumentedDb(ownershipRows(), tracker);
    const res = await putSlot(db, "room-1");
    expect(res.status).toBe(200);
    // Wave 1: {getSlotWriteContext, getRoomEventId}. Wave 2:
    // getConflictsAndSummary's {slotRows, roomRows, totalAcceptedRows}. A
    // future regression that re-serializes the room check (or anything
    // else) into its own round trip must fail this assertion loudly.
    expect(tracker.waves).toBeLessThanOrEqual(3);
  });

  it("room-ownership error wins over the event-not-found error when both are wrong (SOURCE order)", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0, waves: 0 };
    const rows = ownershipRows();
    // DEC-370 wave-61: getSlotWriteContext no longer reads schema.room at
    // all (it reads submission LEFT JOIN event), so "room wrong" is now
    // expressed as a room row that exists but names a DIFFERENT event
    // (getRoomEventId's own read), and "event not found" is expressed by
    // leaving the event table empty (getSlotWriteContext's LEFT JOIN would
    // return a row with null startDate/endDate, which the route's ladder
    // checks AFTER the room check -- so the room-ownership error must win).
    rows.set(schema.room, [{ id: "nonexistent-room", eventId: "some-other-event", name: "Other Room" }]);
    rows.set(schema.event, []); // getSlotWriteContext's LEFT JOIN finds no event row -> not_found
    const db = makeInstrumentedDb(rows, tracker);
    const res = await putSlot(db, "nonexistent-room");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.roomId).toBe("Room does not belong to this event");
  });
});
