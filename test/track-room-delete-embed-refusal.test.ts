// DEC-931 amendment (w63-a): a saved embed whose stored recipe
// (options_json.trackId / options_json.roomId) names a track/room blocks
// its deletion — regardless of the embed's `enabled` column, since a
// disabled embed can be turned back on. Same fake-db call-order pattern as
// test/track-room-delete-blockers.test.ts (no local sqlite/D1 test driver
// wired up for this repo layer).

import { describe, expect, it } from "vitest";
import { deleteTrack, deleteRoom } from "../src/server/repo/events";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selects: unknown[][]) {
  let call = 0;
  const deleteChain: any = { where: async () => undefined };
  const db = {
    select: () => {
      const rows = selects[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    delete: () => deleteChain,
  } as unknown as AppEnv["Variables"]["db"];
  return { db, queryCount: () => call };
}

const now = new Date();

const trackRow = {
  id: "track1",
  eventId: "event1",
  name: "Track One",
  color: null,
  position: 0,
  createdAt: now,
  updatedAt: now,
};

const roomRow = {
  id: "room1",
  eventId: "event1",
  name: "Main Stage",
  capacity: 200,
  position: 0,
  createdAt: now,
  updatedAt: now,
};

const eventRefFields = { recordPrefix: "TALK", timezone: "America/New_York" };

// Selects that deleteTrack issues before reaching the new embed check, all
// answering "no blocker" so control reaches the embed guard.
const trackPriorSelects: unknown[][] = [
  [trackRow], // getTrackForEvent row
  [], // getTrackForEvent submissionCount agg
  [eventRefFields], // getEventRefFields
  [], // submissionTrack join submission, limit 5 -- no refs
  [], // findFormForEvent -- no form
  [], // listPlansForEvent -- no plans
  [], // plan_reviewer join evaluation_plan join user, limit 5 -- no refs
];

const roomPriorSelects: unknown[][] = [
  [roomRow], // getRoomForEvent row
  [{ count: 0 }], // getRoomForEvent sessionCount agg (DEC-896 amendment, wave 26)
  [eventRefFields], // getEventRefFields
  [], // scheduleSlot join submission, limit 5 -- no refs
];

describe("deleteTrack 409 refusal for a saved embed (DEC-931 amendment)", () => {
  it("an enabled embed scoped to the track refuses with conflict naming the embed", async () => {
    const { db } = fakeDb([
      ...trackPriorSelects,
      [{ name: "Homepage schedule" }], // embed select, limit 5
      [{ count: 1 }], // bounded COUNT
    ]);
    let caught: any;
    try {
      await deleteTrack(db, "track1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.code).toBe("conflict");
    expect(caught.fields.embeds).toBe("Homepage schedule");
  });

  it("a DISABLED embed scoped to the track refuses identically", async () => {
    // The repo-level query never filters on `enabled` -- a disabled embed
    // still surfaces here because it can be re-enabled later.
    const { db } = fakeDb([
      ...trackPriorSelects,
      [{ name: "Disabled widget" }],
      [{ count: 1 }],
    ]);
    let caught: any;
    try {
      await deleteTrack(db, "track1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.fields.embeds).toBe("Disabled widget");
  });

  it("an embed on a different event scoped to a different track does not block deletion", async () => {
    const { db } = fakeDb([
      ...trackPriorSelects,
      [], // embed select for THIS event/track -- empty, since the eq(eventId) predicate excludes the other event's row
    ]);
    await expect(deleteTrack(db, "track1", "event1")).resolves.toBeUndefined();
  });

  it("a track with no embed still deletes", async () => {
    const { db } = fakeDb([...trackPriorSelects, []]);
    await expect(deleteTrack(db, "track1", "event1")).resolves.toBeUndefined();
  });

  // DEC-851 (wave-55 amendment): the embed blocker only fires for surfaces
  // whose EMBED_KNOB_TABLE row actually declares trackId (derived via
  // knobsForSurface, never a hand-listed surface set) -- 'schedule' lost
  // trackId this wave, so a schedule-surface embed can no longer refuse a
  // track delete for a knob it can't act on.
  it("only scopes the embed WHERE to surfaces that honor trackId, excluding schedule", async () => {
    let capturedWhere: unknown;
    const deleteChain: any = { where: async () => undefined };
    let call = 0;
    const priorSelects = trackPriorSelects;
    const db = {
      select: () => {
        const idx = call;
        call += 1;
        const chain: any = {
          from: () => chain,
          innerJoin: () => chain,
          where: (cond: unknown) => {
            // The embed-blocker select is the first select AFTER all of
            // trackPriorSelects have been consumed.
            if (idx === priorSelects.length) capturedWhere = cond;
            return chain;
          },
          orderBy: () => chain,
          limit: async () => priorSelects[idx] ?? [],
          then: (resolve: (v: unknown[]) => void) => resolve(priorSelects[idx] ?? []),
        };
        return chain;
      },
      delete: () => deleteChain,
    } as unknown as AppEnv["Variables"]["db"];

    await expect(deleteTrack(db, "track1", "event1")).resolves.toBeUndefined();

    function walk(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
      if (depth > 12 || node === null || node === undefined) return [];
      if (typeof node === "string") return [node];
      if (typeof node !== "object") return [];
      if (seen.has(node)) return [];
      seen.add(node);
      const out: string[] = [];
      if (Array.isArray(node)) {
        for (const c of node) out.push(...walk(c, seen, depth + 1));
        return out;
      }
      const n = node as Record<string, unknown>;
      // drizzle's `Param` wrapper (inArray's bound values) carries the raw
      // value on `.value`, not inside `queryChunks`.
      if (typeof n.value === "string") out.push(n.value);
      if (Array.isArray(n.queryChunks)) {
        for (const c of n.queryChunks) out.push(...walk(c, seen, depth + 1));
      }
      return out;
    }

    const tokens = walk(capturedWhere);
    expect(tokens).toContain("sessions");
    expect(tokens).toContain("agenda");
    expect(tokens).not.toContain("schedule");
  });
});

describe("deleteRoom 409 refusal for a saved embed (DEC-931 amendment)", () => {
  it("an enabled embed scoped to the room refuses with conflict naming the embed", async () => {
    const { db } = fakeDb([
      ...roomPriorSelects,
      [{ name: "Room signage" }], // embed select, limit 5
      [{ count: 1 }], // bounded COUNT
    ]);
    let caught: any;
    try {
      await deleteRoom(db, "room1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.code).toBe("conflict");
    expect(caught.fields.embeds).toBe("Room signage");
  });

  it("a DISABLED embed scoped to the room refuses identically", async () => {
    const { db } = fakeDb([
      ...roomPriorSelects,
      [{ name: "Disabled room widget" }],
      [{ count: 1 }],
    ]);
    let caught: any;
    try {
      await deleteRoom(db, "room1", "event1");
    } catch (err) {
      caught = err;
    }
    expect(caught.status).toBe(409);
    expect(caught.fields.embeds).toBe("Disabled room widget");
  });

  it("an embed on a different event scoped to a different room does not block deletion", async () => {
    const { db } = fakeDb([...roomPriorSelects, []]);
    await expect(deleteRoom(db, "room1", "event1")).resolves.toBeUndefined();
  });

  it("a room with no embed still deletes", async () => {
    const { db } = fakeDb([...roomPriorSelects, []]);
    await expect(deleteRoom(db, "room1", "event1")).resolves.toBeUndefined();
  });
});
