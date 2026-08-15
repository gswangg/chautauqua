// DEC-818 amendment (wave 64, task w64-d): the show-flow export must print a
// file's own STORED version_no (chain-head identity), never the flat count
// of every presentation-file row for a submission. Covers:
//  1) a chain with a deleted middle link (DEC-713: survivors keep {1,3}, not
//     renumbered to {1,2}) — showflow must print the head's stored "(v3)",
//     not "(v2)" (the row count).
//  2) a submission with TWO independent presentation chains — showflow must
//     pick the newest chain's own head and its own stored version_no, not
//     sum both chains' row counts.

import { describe, expect, it } from "vitest";
import { buildShowflowExport } from "../src/server/repo/exports/showflow";
import type { AppEnv } from "../src/server/env";

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

/** Feeds successive db.select() calls the queued row sets, in order — same
 * pattern as test/exports-order.test.ts. buildShowflowExport's select() call
 * order: 1 getRecordPrefix, 2 submissions, 3 breaks, 4 slotRows,
 * 5 trackJoinRows, 6 participantRows, 7 presentationFiles. */
function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function queue(presentationFiles: unknown[]) {
  return [
    [{ recordPrefix: "SES" }],
    [{ id: "sub-1", seq: 1, title: "Talk 1", description: "" }],
    [], // breaks
    [], // slotRows
    [], // trackJoinRows
    [], // participantRows
    presentationFiles,
  ];
}

describe("DEC-818 amendment (wave 64): showflow prints the chain head's stored version_no", () => {
  it("a deleted middle version: survivors {1,3} — showflow prints the head's stored v3, not the row count v2", async () => {
    const presentationFiles = [
      {
        submissionId: "sub-1",
        id: "file-1",
        filename: "deck.pdf",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        versionNo: 1,
        previousFileId: null,
      },
      {
        submissionId: "sub-1",
        id: "file-3",
        filename: "deck.pdf",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        versionNo: 3,
        // DEC-713: deleteFileVersion repoints the chain around the removed
        // middle link — file-3's previous now points straight to file-1.
        previousFileId: "file-1",
      },
    ];

    const table = await buildShowflowExport(fakeDb(queue(presentationFiles)), "event-1");
    const deckFileCol = table.header.indexOf("deck_file");
    expect(table.rows[0]![deckFileCol]).toBe("deck.pdf (v3)");
  });

  it("two independent presentation chains: picks the newest chain's own head + its own stored version_no, not the total row count", async () => {
    const presentationFiles = [
      // Chain A: two versions, head is file-a2 with stored versionNo 2.
      {
        submissionId: "sub-1",
        id: "file-a1",
        filename: "old-deck.pdf",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        versionNo: 1,
        previousFileId: null,
      },
      {
        submissionId: "sub-1",
        id: "file-a2",
        filename: "old-deck.pdf",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        versionNo: 2,
        previousFileId: "file-a1",
      },
      // Chain B: one version, uploaded later — its head is file-b1 with
      // stored versionNo 1. Newest createdAt across both chains' heads.
      {
        submissionId: "sub-1",
        id: "file-b1",
        filename: "new-deck.pdf",
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
        versionNo: 1,
        previousFileId: null,
      },
    ];

    const table = await buildShowflowExport(fakeDb(queue(presentationFiles)), "event-1");
    const deckFileCol = table.header.indexOf("deck_file");
    // Total row count across both chains is 3 — must NOT appear as "v3".
    expect(table.rows[0]![deckFileCol]).toBe("new-deck.pdf (v1)");
  });

  it("throws a data-corruption error when the chain head has no stored version_no", async () => {
    const presentationFiles = [
      {
        submissionId: "sub-1",
        id: "file-1",
        filename: "deck.pdf",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        versionNo: null,
        previousFileId: null,
      },
    ];

    await expect(buildShowflowExport(fakeDb(queue(presentationFiles)), "event-1")).rejects.toThrow(
      /latestDeckBySubmission: file file-1 has no stored version_no — data corruption/,
    );
  });
});
