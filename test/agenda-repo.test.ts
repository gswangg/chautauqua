import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTO_SCHEDULE_PARAMS,
  getAgendaPayload,
  getConflictsAndSummary,
  isValidSlotInput,
  listSlotsOutsideWindow,
  MAX_AGENDA_SCAN,
  runAutoSchedule,
} from "../src/server/repo/agenda";
import { eventDays as computeDays } from "../src/domain/event-days";
import { formatRef } from "../src/domain/ids";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";

// Minimal fake db mirroring the sequential select() calls made by
// getAgendaPayload (see test/agenda-room-ownership.test.ts for the
// established pattern — no local sqlite/D1 test driver is wired up here).
function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

/** Extracts { col, val } equality/inArray predicates out of a drizzle
 * condition tree (used to actually FILTER the fake db's rows the same way
 * the real SQL WHERE would, rather than just asserting tokens are present).
 * Groups Param leaves under the nearest preceding column, resetting at each
 * " and " StringChunk boundary — matches the flat and(inArray(...), inArray(...))
 * shape this file's queries produce. */
function extractPredicates(node: unknown): { col: string; val: unknown }[] {
  const seen = new Set<unknown>();
  const predicates: { col: string; val: unknown }[] = [];
  let currentCol: string | null = null;
  function walk(n: unknown): void {
    if (n === null || typeof n !== "object") return;
    if (seen.has(n)) return;
    seen.add(n);
    const rec = n as Record<string, unknown>;
    const ctorName = (n as { constructor?: { name?: string } }).constructor?.name;
    if (ctorName === "SQLiteText" && typeof rec.name === "string") {
      currentCol = rec.name;
      return;
    }
    if (ctorName === "Param") {
      if (currentCol) predicates.push({ col: currentCol, val: (rec as { value: unknown }).value });
      return;
    }
    if (ctorName === "StringChunk") {
      const v = (rec.value as unknown[] | undefined)?.[0];
      if (typeof v === "string" && v.includes(" and ")) currentCol = null;
      return;
    }
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (Array.isArray(rec.queryChunks)) {
      for (const c of rec.queryChunks) walk(c);
    }
  }
  walk(node);
  return predicates;
}

/** Applies the predicates extracted from a captured WHERE condition to a row
 * set, grouping by column as an AND of per-column "value in [...]" checks —
 * mirrors how `and(inArray(colA, ...), inArray(colB, ...))` behaves in SQL. */
function filterByCondition<T extends Record<string, unknown>>(rows: T[], cond: unknown): T[] {
  const predicates = extractPredicates(cond);
  const byCol = new Map<string, unknown[]>();
  for (const p of predicates) {
    const arr = byCol.get(p.col) ?? [];
    arr.push(p.val);
    byCol.set(p.col, arr);
  }
  return rows.filter((row) => {
    for (const [col, vals] of byCol) {
      if (!vals.includes(row[col])) return false;
    }
    return true;
  });
}

describe("computeDays (DEC-021: days derived from event.startDate..endDate)", () => {
  it("returns a single day when start === end", () => {
    expect(computeDays("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
  });

  it("returns an inclusive range across multiple days", () => {
    expect(computeDays("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("throws loudly on an unparseable date", () => {
    expect(() => computeDays("not-a-date", "2026-08-12")).toThrow();
  });
});

describe("DEFAULT_AUTO_SCHEDULE_PARAMS (DEC-021 defaults)", () => {
  it("matches the binding decision's 540/1080/30/15", () => {
    expect(DEFAULT_AUTO_SCHEDULE_PARAMS).toEqual({
      dayStartMin: 540,
      dayEndMin: 1080,
      defaultDurationMin: 30,
      gridMin: 15,
    });
  });
});

describe("isValidSlotInput", () => {
  it("accepts a valid slot with a room", () => {
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540, endMin: 600, roomId: "r1" })).toBe(true);
  });

  it("accepts a valid slot with a null room (TBD is a real value)", () => {
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540, endMin: 600, roomId: null })).toBe(true);
  });

  it("accepts a valid slot with roomId omitted", () => {
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540, endMin: 600 })).toBe(true);
  });

  it("rejects malformed day, non-integer minutes, and endMin <= startMin", () => {
    expect(isValidSlotInput({ day: "8/10/2026", startMin: 540, endMin: 600 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540.5, endMin: 600 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 600, endMin: 600 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 600, endMin: 540 })).toBe(false);
  });

  it("rejects non-object and missing fields", () => {
    expect(isValidSlotInput(null)).toBe(false);
    expect(isValidSlotInput("string")).toBe(false);
    expect(isValidSlotInput({})).toBe(false);
  });
});

describe("getAgendaPayload unscheduled tray (AIA-08: accepted-only)", () => {
  const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

  it("scopes the placeable-submission query by status='accepted' — accept_queue never reaches the tray", async () => {
    let capturedSubmissionWhere: unknown;
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([]); // rooms
        if (call === 2) return makeChain([]); // tracks
        if (call === 3) return makeChain([], (cond) => (capturedSubmissionWhere = cond)); // submissionRows
        return makeChain([]);
      },
    } as unknown as Db;

    await getAgendaPayload(db, "event1", event);

    const tokens = walkCondition(capturedSubmissionWhere);
    expect(tokens).toContain("col:status");
    expect(tokens).toContain('val:"accepted"');
  });

  it("an accept_queue submission with no slot never appears in unscheduled (loadAcceptedSessions already filters it out at the query)", async () => {
    // The submissionRows select (call 3) only ever returns rows the query
    // matched — an accept_queue row is filtered server-side, so the fake
    // simply never returns one here, proving the payload building code
    // that follows (placed/unscheduled split) has nothing accept_queue to
    // leak even if it tried.
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([]); // rooms
        if (call === 2) return makeChain([]); // tracks
        if (call === 3) return makeChain([{ id: "sub-accepted", seq: 1, title: "Accepted Talk" }]); // submissionRows (accept_queue row excluded by the WHERE)
        return makeChain([]); // track/participant/slot batches
      },
    } as unknown as Db;

    const payload = await getAgendaPayload(db, "event1", event);
    expect(payload.unscheduled).toHaveLength(1);
    expect(payload.unscheduled[0]?.submissionId).toBe("sub-accepted");
    // DEC-615: a plain GET never runs the placer, so it has no per-item
    // reasons to report — only runAutoSchedule populates this.
    expect(payload.unplacedReasons).toEqual([]);
  });
});

// DEC-974: the admin agenda's speaker set is the ACTIVE participants
// (inviteStatus in ['none','accepted']) — a declined co-presenter must
// neither appear in a session's speakers list nor feed speaker_overlap
// conflict detection / autoSchedule's double-booking refusal.
describe("DEC-974 declined participants are excluded from the agenda speaker set", () => {
  // Table-keyed fake db (same pattern as test/ics-sequence-bump.test.ts)
  // whose participant table actually applies the captured WHERE condition
  // (via filterByCondition) instead of ignoring it — this is what proves
  // the SQL-level inviteStatus filter, not just its presence in the query.
  function makeFakeDb(opts: {
    rooms: { id: string }[];
    submissions: { id: string; seq: number; title: string }[];
    participants: Record<string, unknown>[];
    slots: { submission_id: string; room_id: string | null; day: string; start_min: number; end_min: number }[];
  }) {
    // Mutable — runAutoSchedule's inserted scheduleSlot rows must be visible
    // to the getAgendaPayload call it makes right after persisting, or a
    // real placement would look indistinguishable from a refusal here.
    const persistedSlots = opts.slots.map((s) => ({
      submissionId: s.submission_id,
      roomId: s.room_id,
      day: s.day,
      startMin: s.start_min,
      endMin: s.end_min,
    }));

    function rowsFor(table: unknown, cond: unknown): unknown[] {
      if (table === schema.room) return opts.rooms;
      if (table === schema.track) return [];
      if (table === schema.submission) return opts.submissions;
      if (table === schema.submissionTrack) return [];
      if (table === schema.participant) return filterByCondition(opts.participants, cond);
      if (table === schema.scheduleSlot) return persistedSlots;
      if (table === schema.submissionAnswer) return [];
      return [];
    }

    const insertCalls: { table: unknown; rows: unknown[] }[] = [];
    const updateCalls: unknown[] = [];

    const db = {
      select: () => {
        let table: unknown;
        let cond: unknown;
        const chain: any = {
          from: (t: unknown) => {
            table = t;
            return chain;
          },
          innerJoin: () => chain,
          leftJoin: () => chain,
          where: (c: unknown) => {
            cond = c;
            return chain;
          },
          orderBy: () => chain,
          limit: async () => rowsFor(table, cond),
          then: (resolve: (v: unknown[]) => void) => resolve(rowsFor(table, cond)),
        };
        return chain;
      },
      insert: (table: unknown) => ({
        values: (rows: unknown) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          insertCalls.push({ table, rows: arr });
          return {
            onConflictDoNothing: () => ({
              returning: async () => {
                if (table === schema.scheduleSlot) {
                  for (const r of arr as { submissionId: string; roomId: string | null; day: string; startMin: number; endMin: number }[]) {
                    persistedSlots.push({ submissionId: r.submissionId, roomId: r.roomId, day: r.day, startMin: r.startMin, endMin: r.endMin });
                  }
                  return (arr as { submissionId: string }[]).map((r) => ({ submissionId: r.submissionId }));
                }
                return [];
              },
            }),
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: async () => {
            updateCalls.push(true);
          },
        }),
      }),
    } as unknown as Db;

    return { db, insertCalls, updateCalls };
  }

  const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

  // Two accepted sessions, both PLACED overlapping in different rooms, whose
  // only shared participant is contact "c1".
  const submissions = [
    { id: "sub-1", seq: 1, title: "Talk One" },
    { id: "sub-2", seq: 2, title: "Talk Two" },
  ];
  const slots = [
    { submission_id: "sub-1", room_id: "room-a", day: "2026-08-10", start_min: 540, end_min: 600 },
    { submission_id: "sub-2", room_id: "room-b", day: "2026-08-10", start_min: 570, end_min: 630 },
  ];

  function participantRow(submissionId: string, inviteStatus: string) {
    return {
      // snake_case keys — matched against the WHERE condition's column names
      submission_id: submissionId,
      contact_id: "c1",
      invite_status: inviteStatus,
      // camelCase keys — what the code's .select() projection destructures
      submissionId,
      contactId: "c1",
      firstName: "Casey",
      lastName: "Speaker",
      order: 0,
    };
  }

  it("(a) a declined shared speaker produces NO speaker_overlap and is absent from both speakers lists", async () => {
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }, { id: "room-b" }],
      submissions,
      participants: [participantRow("sub-1", "declined"), participantRow("sub-2", "declined")],
      slots,
    });

    const payload = await getAgendaPayload(db, "event1", event);

    expect(payload.conflicts).toEqual([]);
    const placedIds = payload.placed.map((p) => p.submissionId).sort();
    expect(placedIds).toEqual(["sub-1", "sub-2"]);
    for (const p of payload.placed) {
      expect(p.speakers.map((s) => s.contactId)).not.toContain("c1");
    }
  });

  it("(b) the same shared speaker with inviteStatus 'accepted' still produces the conflict", async () => {
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }, { id: "room-b" }],
      submissions,
      participants: [participantRow("sub-1", "accepted"), participantRow("sub-2", "accepted")],
      slots,
    });

    const payload = await getAgendaPayload(db, "event1", event);

    expect(payload.conflicts.length).toBeGreaterThan(0);
    for (const p of payload.placed) {
      expect(p.speakers.map((s) => s.contactId)).toContain("c1");
    }
  });

  it("(c) autoSchedule places a session whose only clashing co-presenter is 'declined'", async () => {
    // sub-1 is already placed; sub-2 is unscheduled and shares its only
    // speaker (c1) with sub-1, but c1's participation on sub-1 is declined
    // — so autoSchedule must place sub-2 rather than refusing it as a
    // double-booking.
    const { db } = makeFakeDb({
      rooms: [{ id: "room-a" }, { id: "room-b" }],
      submissions,
      participants: [participantRow("sub-1", "declined"), participantRow("sub-2", "accepted")],
      slots: [slots[0]!], // only sub-1 is placed; sub-2 is unscheduled
    });

    const payload = await runAutoSchedule(db, "event1", event as any, {
      dayStartMin: 540,
      dayEndMin: 1080,
      defaultDurationMin: 30,
      gridMin: 15,
    });

    expect(payload.unplacedReasons).toEqual([]);
    const placedSub2 = payload.placed.find((p) => p.submissionId === "sub-2");
    expect(placedSub2).toBeTruthy();
  });
});

// DEC-844 (wave 54): listSlotsOutsideWindow must issue one COUNT query and
// one row query (both carrying the same WHERE, the row query also carrying
// LIMIT) instead of pulling every accepted session's slot into JS and
// filtering/slicing there. The SQL condition's semantics (agreement with
// isDayWithinEventRange) are proved separately by the matrix test in
// test/agenda-day-outside-window.test.ts — this test proves the repo
// function's ASSEMBLY: it trusts what each query returns and never re-filters
// or re-slices in JS.
describe("listSlotsOutsideWindow (DEC-844 wave 54: SQL count+limit, no JS scan)", () => {
  it("3 slots (1 outside window) -> count 1, that one named row, rows query carries a LIMIT", async () => {
    const recordPrefix = "EV";
    // Only the outside-window row — the fake db stands in for a WHERE clause
    // that has already excluded the two in-range slots at the SQL level.
    const outsideRows = [{ submissionId: "sub-3", day: "2026-08-12", seq: 3, title: "Talk Three" }];

    let call = 0;
    let capturedLimit: number | undefined;
    const db = {
      select: () => {
        call += 1;
        const thisCall = call;
        const chain: any = {
          from: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: async (n: number) => {
            if (thisCall === 3) capturedLimit = n;
            const rows = thisCall === 1 ? [{ recordPrefix }] : outsideRows;
            return rows.slice(0, n);
          },
          then: (resolve: (v: unknown[]) => void) => {
            // Query #2 (COUNT) never calls .limit — resolved directly here.
            if (thisCall === 2) return resolve([{ count: outsideRows.length }]);
            return resolve(outsideRows);
          },
        };
        return chain;
      },
    } as unknown as Db;

    const result = await listSlotsOutsideWindow(db, "event1", "2026-08-10", "2026-08-11", 20);

    expect(result.count).toBe(1);
    expect(result.sessions).toEqual([
      { submissionId: "sub-3", ref: formatRef(recordPrefix, 3), title: "Talk Three", day: "2026-08-12" },
    ]);
    // The rows query (call #3) must have carried an explicit LIMIT.
    expect(capturedLimit).toBe(20);
  });

  it("recordPrefix===undefined short-circuits to an empty result without querying slots", async () => {
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        const chain: any = {
          from: () => chain,
          where: () => chain,
          limit: async () => [],
        };
        return chain;
      },
    } as unknown as Db;

    const result = await listSlotsOutsideWindow(db, "event1", "2026-08-10", "2026-08-11", 20);
    expect(result).toEqual({ count: 0, sessions: [] });
    expect(call).toBe(1);
  });
});

// DEC-021 wave-60 amendment: getConflictsAndSummary must no longer read the
// whole accepted set — it drives off schedule_slot innerJoin submission,
// bounded by MAX_AGENDA_SCAN, and its {conflicts, summary} must stay
// byte-identical to what getAgendaPayload reports for the same fixture.
describe("getConflictsAndSummary (DEC-021 wave-60: bounded placed-only read)", () => {
  const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

  // sub-1/sub-2 placed overlapping in different rooms, sharing accepted
  // speaker c1 (-> one speaker_overlap conflict); sub-3 accepted but never
  // placed (-> proves unplaced/summary still correct with an unscheduled
  // accepted session in the mix).
  const joinedSlotRows = [
    { submissionId: "sub-1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600, seq: 1, title: "Talk One" },
    { submissionId: "sub-2", roomId: "room-b", day: "2026-08-10", startMin: 570, endMin: 630, seq: 2, title: "Talk Two" },
  ];
  const participantRows = [
    { submissionId: "sub-1", contactId: "c1", firstName: "Casey", lastName: "Speaker", order: 0 },
    { submissionId: "sub-2", contactId: "c1", firstName: "Casey", lastName: "Speaker", order: 0 },
  ];
  const roomRows = [
    { id: "room-a", name: "Room A" },
    { id: "room-b", name: "Room B" },
  ];

  // DEC-155 wave-34 amendment: getConflictsAndSummary now issues slotRows,
  // roomRows and totalAcceptedRows as one Promise.all wave (all three
  // consume nothing from the slot chain) — their db.select() calls are
  // still made synchronously in that source order before any awaits, so
  // calls 1-3 below map to that wave and call 4 is the (still-sequential,
  // dependent-on-slotRows) participantRows batch.
  function makeConflictsSummaryDb(totalAccepted: number) {
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        const thisCall = call;
        if (thisCall === 1) return makeChain(joinedSlotRows); // scheduleSlot innerJoin submission
        if (thisCall === 2) return makeChain(roomRows); // rooms
        if (thisCall === 3) return makeChain([{ count: totalAccepted }]); // totalAccepted count(*)
        return makeChain(participantRows); // participant innerJoin contact
      },
    } as unknown as Db;
    return db;
  }

  // Separate fake tailored to getAgendaPayload's own call sequence (rooms,
  // tracks, submissionRows, trackRows, participantRows, slotRows) so the
  // same fixture can be replayed through both functions for comparison.
  function makeAgendaPayloadDb() {
    const submissions = [
      { id: "sub-1", seq: 1, title: "Talk One" },
      { id: "sub-2", seq: 2, title: "Talk Two" },
      { id: "sub-3", seq: 3, title: "Talk Three" },
    ];
    const slots = [
      { submissionId: "sub-1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600 },
      { submissionId: "sub-2", roomId: "room-b", day: "2026-08-10", startMin: 570, endMin: 630 },
    ];
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        const thisCall = call;
        if (thisCall === 1) return makeChain(roomRows); // rooms
        if (thisCall === 2) return makeChain([]); // tracks
        if (thisCall === 3) return makeChain(submissions); // submissionRows
        if (thisCall === 4) return makeChain([]); // trackRows (submissionTrack)
        if (thisCall === 5) return makeChain(participantRows); // participantRows
        return makeChain(slots); // slotRows
      },
    } as unknown as Db;
    return db;
  }

  it("conflicts + summary match getAgendaPayload for the same fixture (incl. an unscheduled accepted session)", async () => {
    const summaryResult = await getConflictsAndSummary(makeConflictsSummaryDb(3), "event1", event);
    const payload = await getAgendaPayload(makeAgendaPayloadDb(), "event1", event);

    expect(payload.unscheduled.map((s) => s.submissionId)).toEqual(["sub-3"]);
    expect(summaryResult.summary).toEqual(payload.summary);
    expect(summaryResult.summary).toEqual({ unplaced: 1, conflicts: 1, placed: 2, total: 3 });
    expect(summaryResult.conflicts.map((c) => c.detail)).toEqual(payload.conflicts.map((c) => c.detail));
    expect(summaryResult.conflicts).toEqual(payload.conflicts);
  });

  it("refuses (never truncates) once the placed-slot scan would exceed MAX_AGENDA_SCAN", async () => {
    const overflowRows = Array.from({ length: MAX_AGENDA_SCAN + 1 }, (_, i) => ({
      submissionId: `sub-${i}`,
      roomId: null,
      day: "2026-08-10",
      startMin: 540,
      endMin: 600,
      seq: i,
      title: `Talk ${i}`,
    }));
    // DEC-155 wave-34 amendment: slotRows now issues alongside roomRows/
    // totalAcceptedRows in one Promise.all wave, so every db.select() call
    // (not just the innerJoin'd one) needs a chainable, awaitable fake —
    // the other two waves' rows are irrelevant, only slotRows' overflow
    // length drives the assertion below.
    function overflowChain(): unknown {
      const chain: Record<string, unknown> = {};
      for (const method of ["from", "innerJoin", "where", "limit"]) {
        chain[method] = () => chain;
      }
      chain.then = (resolve: (v: unknown) => void) => resolve(overflowRows);
      return chain;
    }
    const db = {
      select: () => overflowChain(),
    } as unknown as Db;

    await expect(getConflictsAndSummary(db, "event1", event)).rejects.toThrow(
      new RegExp(`${MAX_AGENDA_SCAN}`),
    );
  });
});
