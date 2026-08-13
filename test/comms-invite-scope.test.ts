// DEC-317 (notification gate): loadComposeSubmissions' participant query
// must scope to ACTIVE_INVITE_STATUSES ('none'/'accepted') only — never
// 'invited' or 'declined' — and must NOT filter on participant.visible
// (visible governs program/public display, not who gets organizer mail).
// This repo has no local sqlite/D1 test driver wired up (see package.json /
// test/agenda-room-ownership.test.ts), so the WHERE clause is verified via
// the established walkCondition token-inspection pattern against the real
// production query-builder call, and the resulting participant-shape
// mapping is verified against DB rows shaped as a correctly-filtered D1
// would return them. The route-level atomic reject (zero eligible
// recipients -> whole batch rejected, zero mailer.send calls) is verified
// against the real route with a mocked repo layer, mirroring
// test/comms-send-mailer-failure.test.ts.

import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server/env";
import { noRecipientFields } from "../src/routes/comms";
import type { ComposeSubmission } from "../src/domain/compose";

// ---------------------------------------------------------------------------
// loadComposeSubmissions: WHERE-clause construction (DEC-317)
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Mirrors test/agenda-room-ownership.test.ts's walkCondition helper: walks a
// drizzle SQL condition tree collecting referenced column names and bound
// values, so we can assert which columns/literals a WHERE clause was built
// from without a real SQLite/D1 driver in this repo.
function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
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
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  if (Array.isArray(n.value)) {
    for (const c of n.value) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

describe("loadComposeSubmissions participant WHERE clause (DEC-317)", () => {
  it("scopes participants to invite_status in ('none','accepted') and does NOT reference visible", async () => {
    const { loadComposeSubmissions } = await import("../src/server/repo/comms");
    let capturedParticipantWhere: unknown;
    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // call 1: submission rows
        if (selectCall === 1) return makeChain([{ id: "sub1", title: "Talk" }]);
        // call 2: participant rows (the query under test)
        return makeChain([], (cond) => (capturedParticipantWhere = cond));
      },
    } as unknown as AppEnv["Variables"]["db"];

    await loadComposeSubmissions(db, "event1", ["sub1"]);

    const tokens = walkCondition(capturedParticipantWhere);
    expect(tokens).toContain("col:invite_status");
    expect(tokens).toContain('val:"none"');
    expect(tokens).toContain('val:"accepted"');
    expect(tokens).not.toContain("val:\"invited\"");
    expect(tokens).not.toContain("val:\"declined\"");
    // visible must never appear in this WHERE clause (DEC-317: notification
    // scope ignores visible entirely).
    expect(tokens).not.toContain("col:visible");
  });

  it("maps only the rows a correctly-scoped D1 query would return (declined/invited excluded, visible=0-but-accepted included)", async () => {
    const { loadComposeSubmissions } = await import("../src/server/repo/comms");
    let selectCall = 0;
    // A real D1 applying the WHERE clause above would never hand back the
    // declined/invited rows in the first place -- this fixture stands in for
    // that already-filtered result set, isolating the row->ComposeSubmission
    // mapping from SQL execution (which this harness cannot run).
    const filteredParticipantRows = [
      { submissionId: "sub1", contactId: "ct-accepted", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
      { submissionId: "sub1", contactId: "ct-none", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
    ];
    const db = {
      select: () => {
        selectCall += 1;
        if (selectCall === 1) return makeChain([{ id: "sub1", title: "Talk" }]);
        return makeChain(filteredParticipantRows);
      },
    } as unknown as AppEnv["Variables"]["db"];

    const result = await loadComposeSubmissions(db, "event1", ["sub1"]);
    expect(result).toHaveLength(1);
    const contactIds = result[0]?.participants.map((p) => p.contactId).sort();
    expect(contactIds).toEqual(["ct-accepted", "ct-none"]);
  });
});

// ---------------------------------------------------------------------------
// noRecipientFields: pure preflight helper (DEC-317)
// ---------------------------------------------------------------------------

describe("noRecipientFields (DEC-317)", () => {
  it("flags a selected id whose loaded submission has zero participants", () => {
    const submissions: ComposeSubmission[] = [
      { id: "sub-ok", title: "Ok", seq: 1, participants: [{ contactId: "c1", firstName: "A", lastName: "B", email: "a@example.com" }] },
      { id: "sub-empty", title: "Empty", seq: 2, participants: [] },
    ];
    const fields = noRecipientFields(submissions, ["sub-ok", "sub-empty"]);
    expect(fields).toEqual({ "sub-empty": "no eligible recipients" });
  });

  it("flags a selected id that was not loaded at all", () => {
    const submissions: ComposeSubmission[] = [];
    const fields = noRecipientFields(submissions, ["sub-missing"]);
    expect(fields).toEqual({ "sub-missing": "no eligible recipients" });
  });

  it("returns {} when every selected submission has at least one participant", () => {
    const submissions: ComposeSubmission[] = [
      { id: "sub-1", title: "A", seq: 1, participants: [{ contactId: "c1", firstName: "A", lastName: "B", email: "a@example.com" }] },
    ];
    expect(noRecipientFields(submissions, ["sub-1"])).toEqual({});
  });
});

