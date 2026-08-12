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
// OverviewPayload interface is only the v1 aggregate subset). This is
// scoped to DEC-400's actual concern, the eleven wire *keys*: a full deep
// assignability check (`const x: ClientOverviewPayload = server value`)
// also fails today on pre-existing, DEC-400-unrelated nested-field
// differences the two lanes chose independently — e.g. client TriageRow.
// format is `string` where the server's is `string | null` (an
// intentionally flagged open gap, see TriageQueueRow above), and client
// AgendaConflict.kind is `string` where the server's ConflictRow.kind is
// the narrower union. Neither of those is a wire-key mismatch, and fixing
// them is out of this task's scope (app/src/pages/overview/types.ts is not
// owned by this lane). `KeysMatch` below fails to compile if either side
// gains, loses, or renames a top-level key relative to the other, in
// either direction.
type KeysMatch<A, B> = [keyof A] extends [keyof B] ? ([keyof B] extends [keyof A] ? true : false) : false;
const _serverKeysSubsetOfClient: KeysMatch<ServerOverviewPayload, ClientOverviewPayload> = true;
const _clientKeysSubsetOfServer: KeysMatch<ClientOverviewPayload, ServerOverviewPayload> = true;
void _serverKeysSubsetOfClient;
void _clientKeysSubsetOfServer;

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
    [{ count: 0 }], // evaluationsSubmitted
    [{ closeDate: null }], // planClose
    [{ closeDate: null }], // formClose
    [], // pendingAssignments
    [], // overdueDetail
    [], // triageDetail
    [{ total: 0, reuploaded: 0 }], // contentAgg
    [], // contentDetail
    [], // accepted
    [{ sentLast7Days: 0, lastSentAt: null }], // comms
  ];
}

describe("DEC-400: overview payload wire keys pinned against the client contract", () => {
  it("Object.keys(payload) is exactly the eleven DEC-370 keys, byte-for-byte", async () => {
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
        "review",
        "speakers",
        "triage",
        "triage-counts",
      ].sort(),
    );
  });
});
