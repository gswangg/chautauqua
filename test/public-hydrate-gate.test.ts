// DEC-274 (amendment wave 23): hydrateSessions must enforce the public
// session visibility gate (eventId scoping + visibleSessionConditions())
// at the submission read itself, not merely trust its callers. This test
// builds a fake db that actually applies the WHERE condition passed to the
// submission select (by walking the drizzle condition tree, same pattern
// as test/public.test.ts / test/agenda-room-ownership.test.ts), so a
// regression back to a bare `where(inArray(...))` (no eventId/gate) would
// leak the pending id and the other-event id into the result.

import { describe, expect, it } from "vitest";
import { hydrateSessions } from "../src/server/repo/public/sessions";
import type { PublicEvent } from "../src/server/repo/public/event";

// Walks a drizzle SQL condition tree, collecting referenced column names and
// bound values — mirrors test/public.test.ts's walkCondition.
function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 12 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  // inArray()'s comma-joined placeholder list shows up as a bare array
  // nested inside queryChunks (one Param per element) — recurse into it
  // directly, since it has no .queryChunks/.name of its own.
  if (Array.isArray(node)) {
    const out: string[] = [];
    for (const c of node) out.push(...walkCondition(c, seen, depth + 1));
    return out;
  }
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) {
      if (c !== null && typeof c !== "object") {
        out.push(`val:${JSON.stringify(c)}`);
      } else {
        out.push(...walkCondition(c, seen, depth + 1));
      }
    }
  }
  return out;
}

const EVENT: Pick<PublicEvent, "id" | "recordPrefix" | "startDate" | "endDate"> = {
  id: "ev1",
  recordPrefix: "SES",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
};

// Fixture "table" of submission rows, spanning: an approved session in the
// target event, a pending (not-yet-approved) session in the target event,
// and an approved session belonging to a DIFFERENT event.
const SUBMISSION_TABLE = [
  {
    id: "approved-in-event",
    eventId: "ev1",
    status: "accepted",
    contentStatus: "approved",
    seq: 1,
    title: "Approved In Event",
    description: null,
    icsSequence: 0,
  },
  {
    id: "pending-in-event",
    eventId: "ev1",
    status: "submitted",
    contentStatus: "draft",
    seq: 2,
    title: "Pending In Event",
    description: null,
    icsSequence: 0,
  },
  {
    id: "approved-other-event",
    eventId: "ev2",
    status: "accepted",
    contentStatus: "approved",
    seq: 3,
    title: "Approved Other Event",
    description: null,
    icsSequence: 0,
  },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function makeDb() {
  let selectCall = 0;
  return {
    select: () => {
      selectCall += 1;
      const chain: any = {
        from: (_table: unknown) => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        orderBy: () => chain,
        where: (cond: unknown) => {
          // Call 1 is the submission read hydrateSessions guards; every
          // other call (tracks/speakers/slots/format) is irrelevant here
          // and returns empty.
          if (selectCall !== 1) return makeChain([]);
          const parts = walkCondition(cond);
          const requestedIds = new Set(
            parts.filter((p) => p.startsWith("val:")).map((p) => JSON.parse(p.slice(4))),
          );
          const wantsEventId = parts.includes(`val:"ev1"`);
          const wantsAccepted = parts.includes(`val:"accepted"`);
          const wantsApproved = parts.includes(`val:"approved"`);
          const rows = SUBMISSION_TABLE.filter(
            (r) =>
              requestedIds.has(r.id) &&
              (!wantsEventId || r.eventId === "ev1") &&
              (!wantsAccepted || r.status === "accepted") &&
              (!wantsApproved || r.contentStatus === "approved"),
          );
          return makeChain(rows);
        },
      };
      return chain;
    },
  } as any;
}

describe("hydrateSessions (DEC-274 defence-in-depth gate)", () => {
  it("returns only the approved id belonging to the given event", async () => {
    const db = makeDb();
    const result = await hydrateSessions(
      db,
      ["approved-in-event", "pending-in-event", "approved-other-event"],
      EVENT,
    );
    expect(result.map((r) => r.id)).toEqual(["approved-in-event"]);
  });
});
