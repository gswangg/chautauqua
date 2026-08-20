// DEC-564: the notify pipeline must reproduce the same order across
// requests. loadComposeSubmissions' two reads are DEC-078-chunked (so SQL
// order alone can't survive across batches), and
// listFeedbackCommentsForSubmissions numbers reviewers positionally — so
// this file pins:
//   1. loadComposeSubmissions -> expandRecipients yields an identical
//      recipient order regardless of the shuffled row order a chunked DB
//      read hands back (submissions by seq asc, participants by
//      (order asc, contactId asc) — DEC-562's canonical people order).
//   2. listFeedbackCommentsForSubmissions numbers 'Reviewer N' identically
//      regardless of row shuffle (createdAt asc, id asc tiebreak).

import { describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import { loadComposeSubmissions, listFeedbackCommentsForSubmissions } from "../src/server/repo/comms";
import { expandRecipients, formatFeedback } from "../src/domain/compose";

type Db = AppEnv["Variables"]["db"];

function makeChain(rows: unknown[], orderByLog?: unknown[][]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    // DEC-271 (wave-110): listFeedbackCommentsForSubmissions now anti-joins
    // review_recusal, so the chain must answer .leftJoin like the real
    // drizzle builder does -- it is a pure builder step here, the fake's
    // row set already stands for "after the anti-join".
    leftJoin: () => chain,
    where: () => chain,
    orderBy: (...args: unknown[]) => {
      orderByLog?.push(args);
      return chain;
    },
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** A fake db distinguishing queries by their selected-column shape (this
 * repo has no local sqlite/D1 test driver — see
 * test/comms-invite-scope.test.ts's header comment), returning rows in a
 * SHUFFLED order to simulate a chunked read whose SQL ORDER BY can't
 * survive the JS-side concatenation across chunkIds batches. */
function makeComposeDb(params: {
  submissionRows: { id: string; title: string; seq: number }[];
  participantRows: { submissionId: string; contactId: string; firstName: string; lastName: string; email: string; order: number }[];
}): Db {
  return {
    select: (proj: Record<string, unknown>) => {
      if ("seq" in proj) return makeChain(params.submissionRows);
      if ("order" in proj) return makeChain(params.participantRows);
      throw new Error(`unexpected projection: ${Object.keys(proj).join(",")}`);
    },
  } as unknown as Db;
}

function makeFeedbackDb(rows: unknown[], orderByLog?: unknown[][]): Db {
  return {
    select: () => makeChain(rows, orderByLog),
  } as unknown as Db;
}

describe("loadComposeSubmissions reproducible order (DEC-564)", () => {
  const submissionRowsInOrder = [
    { id: "sub-a", title: "Talk A", seq: 1 },
    { id: "sub-b", title: "Talk B", seq: 2 },
    { id: "sub-c", title: "Talk C", seq: 3 },
  ];

  const participantRowsInOrder = [
    { submissionId: "sub-a", contactId: "ct-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", order: 0 },
    { submissionId: "sub-b", contactId: "ct-2", firstName: "Grace", lastName: "Hopper", email: "grace@example.com", order: 0 },
    { submissionId: "sub-b", contactId: "ct-3", firstName: "Radia", lastName: "Perlman", email: "radia@example.com", order: 1 },
    { submissionId: "sub-c", contactId: "ct-4", firstName: "Margaret", lastName: "Hamilton", email: "margaret@example.com", order: 0 },
    { submissionId: "sub-c", contactId: "ct-5", firstName: "Katherine", lastName: "Johnson", email: "katherine@example.com", order: 1 },
  ];

  function shuffled<T>(arr: T[]): T[] {
    const copy = [...arr];
    // deterministic reversal-with-rotation shuffle — good enough to prove
    // the result doesn't depend on input order without a flaky RNG.
    return [copy[copy.length - 1], ...copy.slice(1, copy.length - 1).reverse(), copy[0]].filter(
      (v): v is T => v !== undefined,
    );
  }

  it("yields an identical expandRecipients order for a shuffled row set", async () => {
    const orderedDb = makeComposeDb({ submissionRows: submissionRowsInOrder, participantRows: participantRowsInOrder });
    const shuffledDb = makeComposeDb({
      submissionRows: shuffled(submissionRowsInOrder),
      participantRows: shuffled(participantRowsInOrder),
    });

    const orderedSubs = await loadComposeSubmissions(orderedDb, "evt-1", ["sub-a", "sub-b", "sub-c"]);
    const shuffledSubs = await loadComposeSubmissions(shuffledDb, "evt-1", ["sub-a", "sub-b", "sub-c"]);

    const orderedRecipients = expandRecipients(orderedSubs);
    const shuffledRecipients = expandRecipients(shuffledSubs);

    expect(orderedRecipients).toEqual(shuffledRecipients);
    expect(orderedRecipients.ok).toBe(true);
    if (!orderedRecipients.ok) throw new Error("unreachable");
    expect(orderedRecipients.recipients.map((r) => r.contactId)).toEqual(["ct-1", "ct-2", "ct-3", "ct-4", "ct-5"]);
  });

  it("does not leak order onto the returned ComposeSubmission/ComposeParticipant shapes (seq IS present, DEC-912's ref source)", async () => {
    const db = makeComposeDb({ submissionRows: submissionRowsInOrder, participantRows: participantRowsInOrder });
    const subs = await loadComposeSubmissions(db, "evt-1", ["sub-a", "sub-b", "sub-c"]);
    for (const s of subs) {
      expect(Object.keys(s).sort()).toEqual(["id", "participants", "seq", "title"]);
      for (const p of s.participants) {
        expect(Object.keys(p).sort()).toEqual(["contactId", "email", "firstName", "lastName"]);
      }
    }
  });
});

describe("listFeedbackCommentsForSubmissions order (DEC-564)", () => {
  const scope = { planId: "plan-1", round: 1 };

  it("orders by createdAt asc THEN id asc (a real tiebreak for createdAt ties)", async () => {
    const orderByLog: unknown[][] = [];
    const db = makeFeedbackDb([], orderByLog);

    await listFeedbackCommentsForSubmissions(db, ["sub-x"], scope);

    expect(orderByLog).toHaveLength(1);
    const orderByArgs = orderByLog[0]!;
    expect(orderByArgs).toHaveLength(2);
    const cols = (orderByArgs as any[]).map((o) => o.queryChunks[1]);
    expect(cols).toEqual([schema.evaluation.createdAt, schema.evaluation.id]);
    expect(orderByArgs[0]).toEqual(asc(schema.evaluation.createdAt));
    expect(orderByArgs[1]).toEqual(asc(schema.evaluation.id));
  });

  it("numbers Reviewer N from whatever order the (now tiebreak-stable) query hands back, unmodified", async () => {
    // Simulates the DB already having applied createdAt asc, id asc — two
    // comments tied on createdAt are disambiguated by id, so the SAME
    // logical row set always arrives in the SAME order regardless of
    // physical storage order (what the id tiebreak buys in production).
    const stableRows = [
      { submissionId: "sub-x", comment: "First comment", submittedAt: new Date(1000) },
      { submissionId: "sub-x", comment: "Second comment (tied createdAt, lower id)", submittedAt: new Date(2000) },
      { submissionId: "sub-x", comment: "Third comment (tied createdAt, higher id)", submittedAt: new Date(2000) },
    ];
    const db = makeFeedbackDb(stableRows);

    const map = await listFeedbackCommentsForSubmissions(db, ["sub-x"], scope);

    expect(formatFeedback(map.get("sub-x") ?? [])).toBe(
      "Reviewer 1: First comment\nReviewer 2: Second comment (tied createdAt, lower id)\nReviewer 3: Third comment (tied createdAt, higher id)",
    );
  });
});
