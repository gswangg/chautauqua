// DEC-277: a schedule_slot row whose day falls outside the owning event's
// [startDate, endDate] range must never render as `placed` (it would land in
// no grid column, since `days` is derived from computeDays(event.startDate,
// event.endDate)) and must count toward summary.unplaced so the producer can
// see and re-drag it. Writes on PUT /submissions/:id/slot reject an
// out-of-range day outright (impossible input, not a DEC-010 conflict block).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { agendaRoutes } from "../src/routes/agenda";
import { registerErrorHandler } from "../src/server/http";
import { getAgendaPayload, isDayWithinEventRange } from "../src/server/repo/agenda";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

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

describe("isDayWithinEventRange (DEC-277)", () => {
  it("is inclusive at both ends", () => {
    expect(isDayWithinEventRange("2026-08-10", "2026-08-10", "2026-08-12")).toBe(true);
    expect(isDayWithinEventRange("2026-08-12", "2026-08-10", "2026-08-12")).toBe(true);
  });

  it("is true for a day strictly inside the range", () => {
    expect(isDayWithinEventRange("2026-08-11", "2026-08-10", "2026-08-12")).toBe(true);
  });

  it("is false for a day before start", () => {
    expect(isDayWithinEventRange("2026-08-09", "2026-08-10", "2026-08-12")).toBe(false);
  });

  it("is false for a day after end", () => {
    expect(isDayWithinEventRange("2026-08-13", "2026-08-10", "2026-08-12")).toBe(false);
  });

  it("handles a single-day event (start === end)", () => {
    expect(isDayWithinEventRange("2026-08-10", "2026-08-10", "2026-08-10")).toBe(true);
    expect(isDayWithinEventRange("2026-08-11", "2026-08-10", "2026-08-10")).toBe(false);
  });
});

describe("getAgendaPayload: out-of-range slot day (DEC-277)", () => {
  const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

  it("an accepted session slotted one day past endDate lands in unscheduled, not placed", async () => {
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([]); // rooms
        if (call === 2) return makeChain([]); // tracks
        if (call === 3) return makeChain([{ id: "sub1", seq: 1, title: "Talk" }]); // submissionRows
        if (call === 4) return makeChain([]); // trackRows batch
        if (call === 5) return makeChain([]); // participantRows batch
        if (call === 6) {
          // slotRows batch: day is one past the event's single-day range
          return makeChain([{ submissionId: "sub1", roomId: null, day: "2026-08-11", startMin: 540, endMin: 600 }]);
        }
        return makeChain([]);
      },
    } as unknown as Db;

    const payload = await getAgendaPayload(db, "event1", event);
    expect(payload.placed).toEqual([]);
    expect(payload.unscheduled).toHaveLength(1);
    expect(payload.unscheduled[0]?.submissionId).toBe("sub1");
    expect(payload.summary.unplaced).toBe(1);
  });
});

describe("PUT /submissions/:id/slot rejects an out-of-range day (DEC-277)", () => {
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

  function appWithDb(selects: unknown[][]) {
    let call = 0;
    let wrote = false;
    const writeChain: any = {
      values: () => {
        wrote = true;
        return writeChain;
      },
      set: () => {
        wrote = true;
        return writeChain;
      },
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
    return { app, wasWritten: () => wrote };
  }

  it("returns 400 with a `day` field error and never writes the slot", async () => {
    // DEC-370 wave-61: select #1 is getSlotWriteContext's single submission
    // LEFT JOIN event read (roomId is omitted from the body, so
    // getRoomEventId never issues a DB call at all).
    const { app, wasWritten } = appWithDb([
      [
        {
          eventId: "event1",
          orgId: "org1",
          status: "accepted",
          startDate: "2026-08-10",
          endDate: "2026-08-10",
          recordPrefix: "EV",
        },
      ],
    ]);

    const res = await app.request(
      "/api/v1/submissions/sub1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ day: "2026-08-11", startMin: 540, endMin: 600 }),
      },
      {} as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.day).toBeTruthy();
    expect(wasWritten()).toBe(false);
  });

  // DEC-510 (wave 46 amendment): isIsoDay (the shape gate isValidSlotInput
  // calls) used to be a bare regex, so a calendar-invalid day lexically
  // inside the event's range ('2027-02-30' sorts inside 2027-02-01..
  // 2027-03-05) passed the shape gate and would have persisted. It now
  // delegates to isIsoDate and fails the shape gate itself, before the
  // event's range is even loaded.
  it("returns 400 for a calendar-invalid day and never writes the slot (DEC-510 amendment)", async () => {
    // DEC-370 wave-61: select #1 is getSlotWriteContext's single read; the
    // shape gate (isValidSlotInput) rejects before roomId/day-range are
    // ever consulted, so no further select is issued.
    const { app, wasWritten } = appWithDb([[{ eventId: "event1", orgId: "org1", status: "accepted" }]]);

    const res = await app.request(
      "/api/v1/submissions/sub1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ day: "2027-02-30", startMin: 540, endMin: 600 }),
      },
      {} as unknown as AppEnv["Bindings"],
    );

    expect(res.status).toBe(400);
    expect(wasWritten()).toBe(false);
  });
});
