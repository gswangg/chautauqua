// DEC-515: the J12 submissions export must carry the submission's abstract
// (submission.description) and every custom (non-locked-built-in) form
// field's answer as its own dynamic column, named by the field's label with
// disambiguation on collision — not just the eight identity/status columns
// that existed before. Uses the fakeDb select-queue pattern established by
// test/participant-attribution.test.ts to drive buildExport('submissions')
// through its real chunkIds fan-out (src/server/repo/exports.ts), rather
// than calling the pure shapeSubmissionsExport directly (that's covered by
// test/exports.test.ts) — this file proves the DB-reading half wires
// description/custom-field columns correctly end to end.

import { describe, expect, it } from "vitest";
import { buildExport } from "../src/server/repo/exports";
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

/** Feeds successive db.select() calls the queued row sets, in order. */
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

// exportSubmissions' db.select() call order (src/server/repo/exports.ts):
// 1. getRecordPrefix  2. submissions  3. trackJoinRows (1 chunk)
// 4. participantRows (1 chunk)  5. forms for event  6. fieldRows (1 chunk)
// 7. answerRows (1 chunk)
function submissionsExportQueue(opts: {
  fieldRows: { id: string; formId: string; position: number; label: string }[];
  answerRows: { submissionId: string; formFieldId: string; valueJson: string }[];
}) {
  return [
    [{ recordPrefix: "SES" }],
    [
      {
        id: "sub-1",
        seq: 1,
        title: "Talk One",
        description: "Abstract text here.",
        status: "accepted",
        contentStatus: "approved",
        trackId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    [], // trackJoinRows
    [], // participantRows
    [{ id: "form-1" }], // forms for event
    opts.fieldRows,
    opts.answerRows,
  ];
}

describe("DEC-515: submissions export carries description and custom-field answers", () => {
  it("(a) a submission's abstract text and a custom dropdown/long-text answer both appear in CSV and JSON records", async () => {
    const db = fakeDb(
      submissionsExportQueue({
        fieldRows: [
          { id: "field-abstract", formId: "form-1", position: 1, label: "Extended Abstract" },
          { id: "field-level", formId: "form-1", position: 2, label: "Level" },
        ],
        answerRows: [
          { submissionId: "sub-1", formFieldId: "field-abstract", valueJson: JSON.stringify("A deep dive into abstracts.") },
          { submissionId: "sub-1", formFieldId: "field-level", valueJson: JSON.stringify("Advanced") },
        ],
      }),
    );

    const table = await buildExport(db, "event-1", "submissions");

    const descCol = table.header.indexOf("description");
    const abstractCol = table.header.indexOf("Extended Abstract");
    const levelCol = table.header.indexOf("Level");
    expect(descCol).toBeGreaterThanOrEqual(0);
    expect(abstractCol).toBeGreaterThanOrEqual(0);
    expect(levelCol).toBeGreaterThanOrEqual(0);

    expect(table.rows[0]![descCol]).toBe("Abstract text here.");
    expect(table.rows[0]![abstractCol]).toBe("A deep dive into abstracts.");
    expect(table.rows[0]![levelCol]).toBe("Advanced");

    expect(table.records[0]).toMatchObject({
      description: "Abstract text here.",
      "Extended Abstract": "A deep dive into abstracts.",
      Level: "Advanced",
    });
  });

  it("(b) a locked built-in field is excluded from dynamic columns, and a field whose answer was deleted as rule-hidden yields an empty cell, never leaking a stale value", async () => {
    const db = fakeDb(
      submissionsExportQueue({
        fieldRows: [
          // Locked built-in (session Title) — must never become a dynamic column.
          { id: "form-1:title", formId: "form-1", position: 0, label: "Title" },
          { id: "field-hidden", formId: "form-1", position: 1, label: "Conditional Field" },
        ],
        // No answer row for field-hidden: simulates DEC-501 deleting the
        // answer once the field's visibility rule hid it.
        answerRows: [],
      }),
    );

    const table = await buildExport(db, "event-1", "submissions");

    expect(table.header).not.toContain("Title");
    const hiddenCol = table.header.indexOf("Conditional Field");
    expect(hiddenCol).toBeGreaterThanOrEqual(0);
    expect(table.rows[0]![hiddenCol]).toBe("");
    expect(table.records[0]!["Conditional Field"]).toBe("");
  });

  it("(c) two custom fields sharing one label produce two distinct header cells, each carrying its own answer", async () => {
    const db = fakeDb(
      submissionsExportQueue({
        fieldRows: [
          { id: "field-dup-a", formId: "form-1", position: 1, label: "Notes" },
          { id: "field-dup-b", formId: "form-1", position: 2, label: "Notes" },
        ],
        answerRows: [
          { submissionId: "sub-1", formFieldId: "field-dup-a", valueJson: JSON.stringify("First notes field.") },
          { submissionId: "sub-1", formFieldId: "field-dup-b", valueJson: JSON.stringify("Second notes field.") },
        ],
      }),
    );

    const table = await buildExport(db, "event-1", "submissions");

    expect(table.header).toContain("Notes (field-dup-a)");
    expect(table.header).toContain("Notes (field-dup-b)");
    // Distinct header cells -> buildTable's JSON records don't collide.
    expect(table.records[0]!["Notes (field-dup-a)"]).toBe("First notes field.");
    expect(table.records[0]!["Notes (field-dup-b)"]).toBe("Second notes field.");
  });
});
