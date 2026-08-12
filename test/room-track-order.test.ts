// DEC-563: room/track position is a producer-owned fact assigned atomically
// inside the INSERT (the same COALESCE(MAX)+1 idiom src/server/repo/
// participants.ts:81 already uses for participant.order — DEC-556), never
// left on the schema default. This exercises createTrack/createRoom against
// a stateful in-memory fake db that resolves the embedded SQL fragment the
// same way SQLite would (via SQLiteSyncDialect, mirroring
// test/submission-seq.test.ts's inspection pattern), then reads the rows
// back through listTracksForEvent/listRoomsForEvent (order by position,id)
// to confirm the third created row really lands at position 2 — not the
// schema default of 0 every row would get if position were omitted.

import { describe, expect, it } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { createTrack, createRoom, listTracksForEvent, listRoomsForEvent } from "../src/server/repo/events";

const dialect = new SQLiteSyncDialect();

/** A minimal stateful fake db covering exactly the select/insert shapes
 * createTrack/getTrackForEvent/listTracksForEvent (and the room twins)
 * issue. WHERE conditions are resolved generically via the real drizzle
 * dialect (SQLiteSyncDialect.sqlToQuery) rather than hand-parsed, so this
 * stays correct if the repo's query shape changes. */
function makeFakeDb() {
  const tables = new Map<unknown, Array<Record<string, unknown>>>([
    [schema.track, []],
    [schema.room, []],
  ]);

  function resolveValue(v: unknown, eventIdHint: string): unknown {
    if (v !== null && typeof v === "object" && "queryChunks" in (v as object)) {
      // A SQL fragment (the COALESCE(MAX)+1 position subquery). Resolve it
      // against the in-memory rows for this table/eventId, same semantics
      // as the real correlated SQLite subquery.
      // Determine which table this fragment scopes to by checking rendered
      // SQL text for the table name it references.
      const { sql: text } = dialect.sqlToQuery(v as any);
      const scoped = text.includes('"track"') ? tables.get(schema.track)! : tables.get(schema.room)!;
      const inScope = scoped.filter((r) => r.eventId === eventIdHint);
      const max = inScope.reduce((m, r) => Math.max(m, r.position as number), -1);
      return max + 1;
    }
    return v;
  }

  const db = {
    insert(table: unknown) {
      return {
        async values(vals: Record<string, unknown>) {
          const resolved = { ...vals };
          resolved.position = resolveValue(vals.position, vals.eventId as string);
          tables.get(table)!.push(resolved);
        },
      };
    },
    select(_fields?: unknown) {
      return {
        from(table: unknown) {
          const rows = tables.get(table)!;
          return {
            where(cond: unknown) {
              const { sql: condSql, params } = dialect.sqlToQuery(cond as any);
              const filtered = rows.filter((r) => {
                if (condSql.includes('"id" = ?') && condSql.includes('"event_id" = ?')) {
                  return r.id === params[0] && r.eventId === params[1];
                }
                return r.eventId === params[0];
              });
              return {
                async limit(n: number) {
                  return filtered.slice(0, n);
                },
                orderBy(..._order: unknown[]) {
                  const sorted = [...filtered].sort((a, b) => {
                    const posCmp = (a.position as number) - (b.position as number);
                    if (posCmp !== 0) return posCmp;
                    return (a.id as string).localeCompare(b.id as string);
                  });
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
        },
      };
    },
  } as unknown as Db;
  return db;
}

describe("DEC-563: room/track position assigned atomically inside the INSERT", () => {
  it("createTrack assigns positions 0,1,2 in creation order, not the schema default 0", async () => {
    const db = makeFakeDb();
    const eventId = "event-1";
    const first = await createTrack(db, eventId, { name: "Keynotes" });
    const second = await createTrack(db, eventId, { name: "Workshops" });
    const third = await createTrack(db, eventId, { name: "Lightning Talks" });

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
    expect(third.position).toBe(2);

    const reloaded = await listTracksForEvent(db, eventId);
    expect(reloaded.map((t) => t.name)).toEqual(["Keynotes", "Workshops", "Lightning Talks"]);
    expect(reloaded[2]!.position).toBe(2);
  });

  it("createRoom assigns positions 0,1,2 in creation order, not the schema default 0", async () => {
    const db = makeFakeDb();
    const eventId = "event-1";
    const first = await createRoom(db, eventId, { name: "Ballroom A" });
    const second = await createRoom(db, eventId, { name: "Ballroom B" });
    const third = await createRoom(db, eventId, { name: "Studio C" });

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
    expect(third.position).toBe(2);

    const reloaded = await listRoomsForEvent(db, eventId);
    expect(reloaded.map((r) => r.name)).toEqual(["Ballroom A", "Ballroom B", "Studio C"]);
    expect(reloaded[2]!.position).toBe(2);
  });

  it("scopes positions per-event: a track in a second event still starts at 0", async () => {
    const db = makeFakeDb();
    await createTrack(db, "event-1", { name: "A" });
    await createTrack(db, "event-1", { name: "B" });
    const otherEventFirst = await createTrack(db, "event-2", { name: "C" });
    expect(otherEventFirst.position).toBe(0);
  });
});
