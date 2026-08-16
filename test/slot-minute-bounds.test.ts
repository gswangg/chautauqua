// DEC-476: schedule-slot minutes must be bounded to a single day at
// isValidSlotInput, the one slot-write choke point (src/server/repo/
// agenda.ts). AUTO_SCHEDULE_BOUNDS (src/routes/agenda.ts) shares the same
// MINUTES_PER_DAY constant so the two bounds cannot drift. Fake-db pattern
// mirrors test/agenda-room-ownership.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { agendaRoutes } from "../src/routes/agenda";
import { isValidSlotInput } from "../src/server/repo/agenda";
import { MINUTES_PER_DAY } from "../src/domain/schedule";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

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

describe("DEC-476: MINUTES_PER_DAY bound agreement", () => {
  it("isValidSlotInput and AUTO_SCHEDULE_BOUNDS share the same ceiling", async () => {
    // AUTO_SCHEDULE_BOUNDS isn't exported, so we assert the shared constant
    // directly and cross-check isValidSlotInput's own acceptance boundary.
    expect(MINUTES_PER_DAY).toBe(1440);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 0, endMin: MINUTES_PER_DAY })).toBe(true);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 0, endMin: MINUTES_PER_DAY + 1 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: MINUTES_PER_DAY - 1, endMin: MINUTES_PER_DAY })).toBe(
      true,
    );
    expect(isValidSlotInput({ day: "2026-08-10", startMin: MINUTES_PER_DAY, endMin: MINUTES_PER_DAY + 60 })).toBe(
      false,
    );
  });
});

describe("PUT /submissions/:id/slot (DEC-476 minute bounds)", () => {
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

  function appWithDb(selects: unknown[][]) {
    let call = 0;
    let inserted = false;
    let updated = false;
    const writeChain: any = {
      values: () => {
        inserted = true;
        return writeChain;
      },
      set: () => {
        updated = true;
        return writeChain;
      },
      // DEC-552: upsertSlot is now one INSERT ... ON CONFLICT DO UPDATE, so the
      // insert chain must terminate on onConflictDoUpdate.
      onConflictDoUpdate: async () => undefined,
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
    return { app, wasWritten: () => inserted || updated };
  }

  async function putSlot(app: Hono<AppEnv>, body: Record<string, unknown>) {
    return app.request(
      "/api/v1/submissions/sub1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify(body),
      },
      {} as unknown as AppEnv["Bindings"],
    );
  }

  const acceptedOwnership = [{ eventId: "event1", orgId: "org1", status: "accepted" }];

  const rejectedCases: Array<[string, Record<string, unknown>]> = [
    ["endMin: 1e9 (absurdly out of bounds)", { day: "2026-08-10", startMin: 540, endMin: 1e9 }],
    ["endMin: 1441 (one past midnight)", { day: "2026-08-10", startMin: 540, endMin: 1441 }],
    ["startMin: 1440 (at midnight, no room to start)", { day: "2026-08-10", startMin: 1440, endMin: 1450 }],
    ["startMin: -1 (negative)", { day: "2026-08-10", startMin: -1, endMin: 60 }],
    ["endMin <= startMin", { day: "2026-08-10", startMin: 600, endMin: 600 }],
  ];

  for (const [label, body] of rejectedCases) {
    it(`400s with a fields entry and persists nothing for ${label}`, async () => {
      const { app, wasWritten } = appWithDb([acceptedOwnership]);
      const res = await putSlot(app, body);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { fields?: Record<string, string> } };
      expect(json.error.fields?.slot).toBeTruthy();
      expect(wasWritten()).toBe(false);
    });
  }

  // DEC-370 wave-61: select #1 is now getSlotWriteContext's single combined
  // read (eventId/status/startDate/endDate/recordPrefix all in one row);
  // no roomId is present in either body below, so getRoomEventId never
  // issues a select. select #2/#3/#4 are getConflictsAndSummary's
  // {slotRows, roomRows, totalAcceptedRows} wave.
  const acceptedOwnershipWithEvent = [
    {
      eventId: "event1",
      orgId: "org1",
      status: "accepted",
      startDate: "2026-08-10",
      endDate: "2026-08-10",
      recordPrefix: "EV",
    },
  ];

  it("accepts {startMin: 0, endMin: 1440} (the full-day boundary)", async () => {
    // DEC-492: ics_sequence bump is one atomic set-based UPDATE with no
    // preceding select, so there is no extra select entry for it here.
    const { app } = appWithDb([acceptedOwnershipWithEvent, [], [], []]);
    const res = await putSlot(app, { day: "2026-08-10", startMin: 0, endMin: MINUTES_PER_DAY });
    expect(res.status).toBe(200);
  });

  it("accepts a normal {540, 600} slot", async () => {
    // DEC-492: ics_sequence bump is one atomic set-based UPDATE with no
    // preceding select, so there is no extra select entry for it here.
    const { app } = appWithDb([acceptedOwnershipWithEvent, [], [], []]);
    const res = await putSlot(app, { day: "2026-08-10", startMin: 540, endMin: 600 });
    expect(res.status).toBe(200);
  });
});
