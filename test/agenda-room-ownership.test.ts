// DEC-073: schedule-slot writes must reject a roomId that doesn't belong to
// the submission's own event (cross-org/cross-event room ownership hole), and
// the public agenda's room-name lookup must never resolve a room row from a
// different event (cross-org room-name leak). A minimal fake db stands in
// for D1, mirroring the sequential select() calls made by each real code
// path (see test/headshot-gate.test.ts for the established pattern) — full
// wrangler-dev round trips are covered by the walkthrough scripts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { agendaRoutes } from "../src/routes/agenda";
import { getPublicAgenda, type PublicEvent } from "../src/server/repo/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Walks a drizzle SQL condition tree, collecting referenced column names and
// bound values — lets us assert *which* columns/values a query's WHERE
// clause was built from without a real SQLite driver in this repo (see
// package.json: no local sqlite/D1 test driver is wired up).
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

describe("PUT /submissions/:id/slot (DEC-073 room-ownership gate)", () => {
  const auth: AuthInfo = { userId: "u1", role: "organizer", orgId: "org1" };

  function appWithDb(selects: unknown[][]) {
    let call = 0;
    const writeChain: any = {
      values: () => writeChain,
      set: () => writeChain,
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
    return app;
  }

  async function putSlot(app: Hono<AppEnv>, roomId: string) {
    return app.request(
      "/api/v1/submissions/sub1/slot",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ day: "2026-08-10", startMin: 540, endMin: 600, roomId }),
      },
      {} as unknown as AppEnv["Bindings"],
    );
  }

  it("400s with a field error when roomId is foreign/nonexistent for the submission's event", async () => {
    // DEC-370 wave-61: select #1: getSlotWriteContext (submission LEFT JOIN
    // event) -> accepted submission in org1/event1. select #2:
    // getRoomEventId -> no matching room row (foreign/nonexistent), so it
    // resolves null, which never equals context.eventId.
    const app = appWithDb([[{ eventId: "event1", orgId: "org1", status: "accepted" }], []]);
    const res = await putSlot(app, "room-from-other-event");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.roomId).toBeTruthy();
  });

  it("succeeds (200) when roomId belongs to the submission's own event", async () => {
    // DEC-370 wave-61: select #1: getSlotWriteContext (context.eventId +
    // status + startDate/endDate/recordPrefix, all from the one query).
    // select #2: getRoomEventId -> room1 belongs to event1.
    // (DEC-552: upsertSlot no longer reads before writing -- it is one
    // INSERT ... ON CONFLICT DO UPDATE -- so its old existing-slot lookup
    // select is gone. DEC-492: the ics_sequence bump is one atomic set-based
    // UPDATE with no preceding select, so that select is gone too.)
    // select #3/#4/#5: getConflictsAndSummary's {slotRows, roomRows,
    // totalAcceptedRows} wave.
    const app = appWithDb([
      [{ eventId: "event1", orgId: "org1", status: "accepted", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" }],
      [{ id: "room1", eventId: "event1" }],
      [],
      [],
      [],
    ]);
    const res = await putSlot(app, "room1");
    expect(res.status).toBe(200);
  });
});

describe("roomBelongsToEvent (DEC-073)", () => {
  it("builds a WHERE clause scoped by both room id and eventId", async () => {
    const { roomBelongsToEvent } = await import("../src/server/repo/agenda");
    let captured: unknown;
    const db = {
      select: () => makeChain([{ id: "room1" }], (cond) => (captured = cond)),
    } as unknown as AppEnv["Variables"]["db"];
    await roomBelongsToEvent(db, "room1", "event1");
    const tokens = walkCondition(captured);
    expect(tokens).toContain("col:id");
    expect(tokens).toContain("col:event_id");
    expect(tokens).toContain('val:"room1"');
    expect(tokens).toContain('val:"event1"');
  });
});

describe("getPublicAgenda room-name resolution (DEC-073: never leak a cross-event room)", () => {
  const event: PublicEvent = {
    id: "event1",
    orgId: "org1",
    name: "Conf",
    slug: "conf",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    location: null,
    timezone: "UTC",
    recordPrefix: "EV",
    brandingJson: null,
  };

  function fakeDb(placedRows: unknown[], roomRows: unknown[]) {
    let selectCall = 0;
    let capturedRoomWhere: unknown;
    const subRow = {
      id: "sub1",
      seq: 1,
      title: "Talk",
      description: null,
      icsSequence: 0,
    };
    const db = {
      selectDistinct: () => makeChain(placedRows),
      select: () => {
        selectCall += 1;
        // call 1: DEC-548 total count(*) subquery over the agenda_rows scan
        if (selectCall === 1) return makeChain([{ count: placedRows.length }]);
        // call 2: room lookup (scoped by id + eventId)
        if (selectCall === 2) return makeChain(roomRows, (cond) => (capturedRoomWhere = cond));
        // call 3: hydrateSessions subRows
        if (selectCall === 3) return makeChain([subRow]);
        // call 4: hydrateSessions trackRows
        if (selectCall === 4) return makeChain([]);
        // call 5: hydrateSessions speakerRows
        if (selectCall === 5) return makeChain([]);
        // call 6: hydrateSessions slotRows (EMB-01 schedule join)
        return makeChain([]);
      },
    } as unknown as AppEnv["Variables"]["db"];
    return { db, getCapturedRoomWhere: () => capturedRoomWhere };
  }

  it("the room-name query's WHERE clause includes the requesting event's id (not just the room id)", async () => {
    const { db, getCapturedRoomWhere } = fakeDb(
      [{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "foreign-room" }],
      [],
    );
    await getPublicAgenda(db, event);
    const tokens = walkCondition(getCapturedRoomWhere());
    expect(tokens).toContain("col:event_id");
    expect(tokens).toContain(`val:"${event.id}"`);
  });

  it("returns roomName: null when the roomId belongs to a different event (scoped query finds nothing)", async () => {
    const { db } = fakeDb(
      [{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "foreign-room" }],
      [], // a correctly event-scoped query returns no rows for a foreign room id
    );
    const { items } = await getPublicAgenda(db, event);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item?.roomId).toBe("foreign-room");
    expect(item?.roomName).toBeNull();
  });

  it("resolves roomName normally when the room does belong to the requested event", async () => {
    const { db } = fakeDb(
      [{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }],
      [{ id: "room1", name: "Main Hall" }],
    );
    const { items } = await getPublicAgenda(db, event);
    expect(items[0]?.roomName).toBe("Main Hall");
  });
});
