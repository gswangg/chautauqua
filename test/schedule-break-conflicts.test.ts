// DEC-557 (wave 69 amendment): the SERVER must emit `break_overlap`
// conflicts — a break is a conflict participant, not a session. Domain unit
// coverage lives here (findConflicts' optional `blocks` argument), plus one
// route case proving PUT /submissions/:id/slot onto a break still returns
// 200 with the break clash in the refreshed payload (DEC-010: warn, never
// block).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { agendaRoutes } from "../src/routes/agenda";
import { registerErrorHandler } from "../src/server/http";
import {
  findConflicts,
  type PlacedSession,
  type ScheduleBlock,
} from "../src/domain/schedule";
import type { AppEnv, AuthInfo } from "../src/server/env";

function session(overrides: Partial<PlacedSession>): PlacedSession {
  return {
    submissionId: "s1",
    roomId: "room-a",
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    speakerContactIds: [],
    ...overrides,
  };
}

function block(overrides: Partial<ScheduleBlock>): ScheduleBlock {
  return {
    breakId: "break-1",
    label: "Lunch",
    day: "2026-08-10",
    startMin: 600,
    endMin: 660,
    ...overrides,
  };
}

describe("findConflicts break_overlap (DEC-557 wave 69)", () => {
  it("emits exactly one break_overlap, carrying breakId/breakLabel/day and a single-element submissionIds, for a session over a break", () => {
    const s = session({ submissionId: "s1", day: "2026-08-10", startMin: 630, endMin: 690 });
    const b = block({ breakId: "brk-1", label: "Lunch", day: "2026-08-10", startMin: 600, endMin: 660 });
    const conflicts = findConflicts([s], [b]);
    expect(conflicts).toEqual([
      {
        kind: "break_overlap",
        submissionIds: ["s1"],
        day: "2026-08-10",
        roomId: "room-a",
        speakerContactIds: [],
        breakId: "brk-1",
        breakLabel: "Lunch",
      },
    ]);
  });

  it("does not conflict when a session merely abuts the break (touching intervals)", () => {
    const s = session({ submissionId: "s1", day: "2026-08-10", startMin: 660, endMin: 720 });
    const b = block({ day: "2026-08-10", startMin: 600, endMin: 660 });
    expect(findConflicts([s], [b])).toEqual([]);
  });

  it("still conflicts when the session is in a different room — a break blocks EVERY room", () => {
    const s = session({ submissionId: "s1", roomId: "room-z", day: "2026-08-10", startMin: 610, endMin: 670 });
    const b = block({ breakId: "brk-9", label: "Coffee", day: "2026-08-10", startMin: 600, endMin: 660, });
    const conflicts = findConflicts([s], [b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: "break_overlap", roomId: "room-z", breakId: "brk-9" });
  });

  it("also flags the room-less TBD column (roomId: null)", () => {
    const s = session({ submissionId: "s1", roomId: null, day: "2026-08-10", startMin: 610, endMin: 670 });
    const b = block({ day: "2026-08-10", startMin: 600, endMin: 660 });
    const conflicts = findConflicts([s], [b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.roomId).toBeNull();
  });

  it("ignores a break on a different day", () => {
    const s = session({ submissionId: "s1", day: "2026-08-10", startMin: 610, endMin: 670 });
    const b = block({ day: "2026-08-11", startMin: 600, endMin: 660 });
    expect(findConflicts([s], [b])).toEqual([]);
  });

  it("appends break conflicts AFTER all pair conflicts (DEC-533 emission order preserved)", () => {
    const a = session({ submissionId: "a", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600 });
    const c = session({ submissionId: "c", roomId: "room-a", day: "2026-08-10", startMin: 570, endMin: 630 });
    const b = block({ day: "2026-08-10", startMin: 600, endMin: 660 });
    const conflicts = findConflicts([a, c], [b]);
    expect(conflicts.map((x) => x.kind)).toEqual(["room_overlap", "break_overlap"]);
  });

  it("findConflicts(placed) with no second argument is byte-identical to today (default [])", () => {
    const a = session({ submissionId: "a", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600 });
    const c = session({ submissionId: "c", roomId: "room-a", day: "2026-08-10", startMin: 570, endMin: 630 });
    expect(findConflicts([a, c])).toEqual(findConflicts([a, c], []));
    expect(findConflicts([a, c])).toEqual([
      {
        kind: "room_overlap",
        submissionIds: ["a", "c"],
        day: "2026-08-10",
        roomId: "room-a",
        speakerContactIds: [],
        breakId: null,
        breakLabel: null,
      },
    ]);
  });
});

describe("PUT /submissions/:id/slot onto a break (DEC-010 warn-never-block)", () => {
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

  function makeChain(rows: unknown[]) {
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => rows,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  function appWithDb(selects: unknown[][]) {
    let call = 0;
    const writeChain: any = {
      values: () => writeChain,
      set: () => writeChain,
      // DEC-519 wave-6 amendment: upsertSlot gates its ics bump on
      // `.returning()` having a row -- this fake reports one, since the
      // no-op differential itself is not the thing under test here.
      onConflictDoUpdate: () => ({ returning: async () => [{ id: "slot-1" }] }),
      where: async () => undefined,
    };
    const db = {
      select: () => {
        const rows = selects[call] ?? [];
        call += 1;
        return makeChain(rows);
      },
      insert: () => writeChain,
      update: () => writeChain,
    } as unknown as AppEnv["Variables"]["db"];

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", auth);
      await next();
    });
    app.route("/api/v1", agendaRoutes);
    return app;
  }

  it("returns 200 with the break_overlap clash in the refreshed payload", async () => {
    // call0: getSlotWriteContext ownership/event row
    const ownershipRow = [
      {
        eventId: "event1",
        orgId: "org1",
        status: "accepted",
        startDate: "2026-08-10",
        endDate: "2026-08-10",
        recordPrefix: "EV",
      },
    ];
    // getConflictsAndSummary's Promise.all wave, in source order:
    // call1: slotRows (scheduleSlot innerJoin submission) — the session we
    // just wrote, placed on top of the break below.
    const slotRows = [
      { submissionId: "sub1", roomId: "room-a", day: "2026-08-10", startMin: 630, endMin: 690, seq: 1, title: "Talk One" },
    ];
    // call2: roomRows
    const roomRows = [{ id: "room-a", name: "Room A" }];
    // call3: totalAccepted count(*)
    const totalAcceptedRows = [{ count: 1 }];
    // call4: scheduleBreak (listBreaksForEvent)
    const breakRows = [
      {
        id: "brk-1",
        eventId: "event1",
        day: "2026-08-10",
        label: "Lunch",
        location: null,
        startMin: 600,
        durationMin: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    // call5: participantRows (empty — no speakers, no speaker_overlap)
    const participantRows: unknown[] = [];

    const app = appWithDb([ownershipRow, slotRows, roomRows, totalAcceptedRows, breakRows, participantRows]);

    const res = await app.request(
      "/api/v1/submissions/sub1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ day: "2026-08-10", startMin: 630, endMin: 690 }),
      },
      {} as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(200);
    // DEC-851 wave-5 amendment: breakId/breakLabel are Conflict-internal
    // inputs that describeConflict folds into `detail`; the WIRE shape
    // (DescribedConflict) deliberately drops them, so the break's identity
    // is asserted where it actually reaches the client — in the prose.
    const json = (await res.json()) as {
      conflicts: { kind: string; submissionIds: string[]; detail: string }[];
      summary: { conflicts: number };
    };
    const breakConflicts = json.conflicts.filter((c) => c.kind === "break_overlap");
    expect(breakConflicts).toHaveLength(1);
    expect(breakConflicts[0]).toMatchObject({ submissionIds: ["sub1"] });
    expect(breakConflicts[0]?.detail).toContain('the break "Lunch"');
    expect(breakConflicts[0]).not.toHaveProperty("breakId");
    expect(breakConflicts[0]).not.toHaveProperty("breakLabel");
    expect(json.summary.conflicts).toBeGreaterThanOrEqual(1);
  });
});
