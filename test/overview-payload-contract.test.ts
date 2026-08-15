// DEC-400: pins the overview endpoint's wire keys to app/src/pages/overview/
// types.ts, the client-side contract of record (DEC-246). This can't be
// caught by test/spa-contract-sweep.test.ts's route test: that test mocks
// `getOverviewPayload` itself and the route handler (src/routes/api/
// overview.ts) is a bare pass-through (`c.json(payload)`), so a repo-level
// key rename would flow straight through the mock and the route test would
// keep passing even if the real getOverviewPayload's keys drifted from the
// client type. This file checks the *real* server type/implementation
// against the client type directly — both at compile time (structural
// assignability, both directions) and at runtime (exact key set) — with no
// route or mock in between.
import { describe, expect, it } from "vitest";
import { getOverviewPayload, type OverviewPayloadV2 as ServerOverviewPayload } from "../src/server/repo/overview";
import type { OverviewPayload as ClientOverviewPayload } from "../app/src/pages/overview/types";

// Compile-time mutual TOP-LEVEL key-set check (against OverviewPayloadV2,
// the full shape getOverviewPayload actually returns — the bare exported
// OverviewPayload interface is only the v1 aggregate subset). `KeysMatch`
// below fails to compile if either side gains, loses, or renames a
// top-level key relative to the other, in either direction.
type KeysMatch<A, B> = [keyof A] extends [keyof B] ? ([keyof B] extends [keyof A] ? true : false) : false;
const _serverKeysSubsetOfClient: KeysMatch<ServerOverviewPayload, ClientOverviewPayload> = true;
const _clientKeysSubsetOfServer: KeysMatch<ClientOverviewPayload, ServerOverviewPayload> = true;
void _serverKeysSubsetOfClient;
void _clientKeysSubsetOfServer;

// Real deep structural assignability, both directions: a server-shaped
// payload must satisfy the client's type, and vice versa. This is stricter
// than the top-level key check above — it also catches nested-field
// mismatches (e.g. a field one side types nullable and the other doesn't).
// Both directions must compile for the wire contract to be honored.
function _serverPayloadAssignableToClient(server: ServerOverviewPayload): ClientOverviewPayload {
  return server;
}
function _clientPayloadAssignableToServer(client: ClientOverviewPayload): ServerOverviewPayload {
  return client;
}
void _serverPayloadAssignableToClient;
void _clientPayloadAssignableToServer;

// Same fake-db response-queue pattern as test/overview.test.ts.
function makeFakeDb(responses: unknown[]) {
  let cursor = 0;
  function chain(): any {
    const obj: any = {};
    const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
    for (const m of passthrough) obj[m] = () => obj;
    obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (cursor >= responses.length) {
        throw new Error(`makeFakeDb: query #${cursor + 1} has no queued response (only ${responses.length} queued)`);
      }
      const value = responses[cursor];
      cursor += 1;
      return Promise.resolve(value).then(resolve, reject);
    };
    return obj;
  }
  return { select: () => chain() } as any;
}

function emptyResponses() {
  return [
    [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // event
    [], // statusRows
    [{ count: 0 }], // planCount
    [{ expected: 0, submitted: 0 }], // evaluationsAgg
    [{ closeDate: null }], // planClose
    [{ closeDate: null }], // formClose
    [], // pendingAssignments
    [{ count: 0 }], // overdueAssignmentCount (DEC-776)
    [], // overdueDetail
    [], // triageDetail
    [{ total: 0, reuploaded: 0 }], // contentAgg
    [], // contentDetail
    [{ count: 0 }], // unplacedCount (DEC-370 wave-56 amendment)
    [], // unplacedDetail
    [], // slotRows (always fires now)
    [], // DEC-010 amendment: breaks for the event
    [{ sentLast7Days: 0, lastSentAt: null }], // comms
    [{ count: 0 }], // DEC-370 amendment (wave 5): publishedSessionCount
  ];
}

describe("DEC-400: overview payload wire keys pinned against the client contract", () => {
  it("Object.keys(payload) is exactly the twelve DEC-370 keys, byte-for-byte", async () => {
    const now = 1_735_999_999_999;
    const db = makeFakeDb(emptyResponses());
    const payload = await getOverviewPayload(db, "event-1", now);

    expect(Object.keys(payload).sort()).toEqual(
      [
        "agenda",
        "agendaWork",
        "comms",
        "content",
        "contentApproval",
        "deadlines",
        "overdueTasks",
        "publishedSessionCount",
        "review",
        "speakers",
        "triage",
        "triage-counts",
      ].sort(),
    );
  });
});

// DEC-589 amendment (wave 49): getOverviewPayload's Phase 1 queries (the ten
// that take only eventId/now as input) must be in flight TOGETHER, not one
// round trip at a time. A db harness that records each query's start order
// separately from its resolve order proves this: if Phase 1 were still
// sequential, query #2 wouldn't START until query #1 RESOLVED, so "started"
// and "resolved" would interleave 1-1. Under Promise.all, every Phase-1
// query starts (its `.then()` is attached) before any of them resolves.
describe("DEC-589 amendment (wave 49): overview Phase 1 queries are concurrent, not sequential", () => {
  it("every Phase 1 query starts before the first one resolves", async () => {
    const now = 1_735_999_999_999;
    const responses = [
      [{ recordPrefix: "DFC", startDate: "2027-03-10" }], // event
      [], // statusRows
      [{ count: 0 }], // planCount
      [{ expected: 0, submitted: 0 }], // evaluationsAgg
      [{ closeDate: null }], // planClose
      [{ closeDate: null }], // formClose
      [], // speakerAgg
      [{ count: 0 }], // overdueAssignmentCount
      [], // overdueDetail
      [], // triageDetail
      [{ total: 0, reuploaded: 0 }], // contentAgg
      [], // contentDetail
      [{ count: 0 }], // unplacedCount (DEC-370 wave-56 amendment)
      [], // unplacedDetail
      [], // slotRows (always fires now)
      [], // DEC-010 amendment: breaks for the event
      [{ sentLast7Days: 0, lastSentAt: null }], // comms
      [{ count: 0 }], // DEC-370 amendment (wave 5): publishedSessionCount
    ];
    let cursor = 0;
    let seq = 0;
    const startedAt: number[] = [];
    const resolvedAt: number[] = [];

    function chain(): any {
      const obj: any = {};
      const passthrough = ["from", "where", "innerJoin", "orderBy", "limit", "offset", "select", "groupBy"];
      for (const m of passthrough) obj[m] = () => obj;
      obj.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        // "start" = the moment something calls .then() on this query (i.e.
        // awaits/subscribes to it) -- record BEFORE any resolution happens.
        const myIndex = startedAt.length;
        startedAt.push(seq++);
        if (cursor >= responses.length) {
          throw new Error(`makeFakeDb: query #${cursor + 1} has no queued response (only ${responses.length} queued)`);
        }
        const value = responses[cursor];
        cursor += 1;
        return Promise.resolve(value).then((v) => {
          resolvedAt[myIndex] = seq++;
          return resolve(v);
        }, reject);
      };
      return obj;
    }
    const db = { select: () => chain() } as any;

    await getOverviewPayload(db, "event-1", now);

    // The first 10 responses queued above are exactly Phase 1's queries
    // (event, statusRows, planCount, evaluationsAgg, planClose, formClose,
    // speakerAgg, overdueAssignmentCount, overdueDetail, triageDetail).
    // Under Promise.all, every one of them STARTS (calls .then()) before
    // ANY of them RESOLVES: the max "started" sequence number among the
    // first 10 queries must be smaller than the min "resolved" sequence
    // number among that same set. A still-sequential Phase 1 would instead
    // interleave start/resolve pairs one at a time (query 2 wouldn't start
    // until query 1 resolved), failing this.
    expect(startedAt.length).toBeGreaterThanOrEqual(10);
    const phase1Started = startedAt.slice(0, 10);
    const phase1Resolved = resolvedAt.slice(0, 10);
    expect(Math.max(...phase1Started)).toBeLessThan(Math.min(...phase1Resolved));
  });
});
