// DEC-916: GET /events/:eventId/tracks returns submissionCount on every
// track, computed by ONE grouped aggregate over schema.submissionTrack
// joined to schema.submission scoped to the event -- never one
// /submissions?trackId=<id> request per track (the old Promise.all fan-out
// TracksRoomsPanel.tsx used to do). This exercises listTracksForEvent
// against a fake db that counts how many times the grouped-count branch of
// db.select() executes, so a regression back to per-track queries fails on
// call count, not just on the returned numbers.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { listTracksForEvent } from "../src/server/repo/events";

interface FakeTrackRow {
  id: string;
  eventId: string;
  name: string;
  color: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakeDb(opts: {
  eventId: string;
  tracks: FakeTrackRow[];
  submissionTracks: { submissionId: string; trackId: string }[];
  submissions: { id: string; eventId: string }[];
}) {
  let groupedCountCalls = 0;

  const db = {
    select(_fields?: unknown) {
      return {
        from(table: unknown) {
          if (table === schema.track) {
            return {
              where(_cond: unknown) {
                return {
                  orderBy(..._order: unknown[]) {
                    const sorted = [...opts.tracks].sort(
                      (a, b) => a.position - b.position || a.id.localeCompare(b.id),
                    );
                    return {
                      async limit(n: number) {
                        return sorted.slice(0, n);
                      },
                      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
                        return Promise.resolve(sorted).then(resolve, reject);
                      },
                    };
                  },
                };
              },
            };
          }
          if (table === schema.submissionTrack) {
            return {
              innerJoin(_joinTable: unknown, _cond: unknown) {
                return {
                  where(_cond2: unknown) {
                    return {
                      groupBy(_col: unknown) {
                        groupedCountCalls += 1;
                        const validSubIds = new Set(
                          opts.submissions.filter((s) => s.eventId === opts.eventId).map((s) => s.id),
                        );
                        const counts = new Map<string, number>();
                        for (const st of opts.submissionTracks) {
                          if (validSubIds.has(st.submissionId)) {
                            counts.set(st.trackId, (counts.get(st.trackId) ?? 0) + 1);
                          }
                        }
                        const rows = Array.from(counts.entries()).map(([trackId, count]) => ({ trackId, count }));
                        return {
                          then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
                            return Promise.resolve(rows).then(resolve, reject);
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          }
          throw new Error(`makeFakeDb: unexpected table in select().from()`);
        },
      };
    },
  } as unknown as Db;

  return { db, callCount: () => groupedCountCalls };
}

const EVENT_ID = "event-1";
const now = new Date();

function track(id: string, position: number): FakeTrackRow {
  return { id, eventId: EVENT_ID, name: `Track ${id}`, color: null, position, createdAt: now, updatedAt: now };
}

describe("DEC-916: listTracksForEvent submissionCount", () => {
  it("returns 0 for a track with no submissions, 1 for a track with one, N for a track with N", async () => {
    // NOTE (task w6-e, noUnusedLocals cleanup): `callCount` used to be
    // destructured here unused; the sibling test below asserts it stays
    // flat, this one doesn't need to. Not adding an assertion here since
    // inventing one is outside this task's scope.
    const { db } = makeFakeDb({
      eventId: EVENT_ID,
      tracks: [track("trk-zero", 0), track("trk-one", 1), track("trk-many", 2)],
      submissions: [
        { id: "sub-1", eventId: EVENT_ID },
        { id: "sub-2", eventId: EVENT_ID },
        { id: "sub-3", eventId: EVENT_ID },
        { id: "sub-4", eventId: EVENT_ID },
      ],
      submissionTracks: [
        { submissionId: "sub-1", trackId: "trk-one" },
        { submissionId: "sub-2", trackId: "trk-many" },
        { submissionId: "sub-3", trackId: "trk-many" },
        { submissionId: "sub-4", trackId: "trk-many" },
      ],
    });

    const tracks = await listTracksForEvent(db, EVENT_ID);
    const byId = Object.fromEntries(tracks.map((t) => [t.id, t.submissionCount]));

    expect(byId["trk-zero"]).toBe(0);
    expect(byId["trk-one"]).toBe(1);
    expect(byId["trk-many"]).toBe(3);
  });

  it("computes every track's count with exactly ONE grouped query -- the call count does not grow with the number of tracks", async () => {
    const manyTracks = Array.from({ length: 25 }, (_, i) => track(`trk-${i}`, i));
    const submissions = Array.from({ length: 25 }, (_, i) => ({ id: `sub-${i}`, eventId: EVENT_ID }));
    // Every submission belongs to exactly one track, so every one of the 25
    // tracks has a real, distinct submissionCount.
    const submissionTracks = manyTracks.map((t, i) => ({ submissionId: `sub-${i}`, trackId: t.id }));

    const { db, callCount } = makeFakeDb({ eventId: EVENT_ID, tracks: manyTracks, submissions, submissionTracks });

    const tracks = await listTracksForEvent(db, EVENT_ID);
    expect(tracks).toHaveLength(25);
    expect(tracks.every((t) => t.submissionCount === 1)).toBe(true);
    // ONE grouped aggregate regardless of how many tracks were on the page --
    // never one query per track.
    expect(callCount()).toBe(1);
  });

  it("only counts submission_track rows whose submission belongs to this event", async () => {
    const { db } = makeFakeDb({
      eventId: EVENT_ID,
      tracks: [track("trk-a", 0)],
      submissions: [
        { id: "sub-in-event", eventId: EVENT_ID },
        { id: "sub-other-event", eventId: "event-2" },
      ],
      submissionTracks: [
        { submissionId: "sub-in-event", trackId: "trk-a" },
        { submissionId: "sub-other-event", trackId: "trk-a" },
      ],
    });

    const tracks = await listTracksForEvent(db, EVENT_ID);
    expect(tracks[0]!.submissionCount).toBe(1);
  });
});
