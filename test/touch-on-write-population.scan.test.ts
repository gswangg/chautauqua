// DEC-725 (task-w10-tb): a DERIVED scan over
// src/server/repo/participants.ts ONLY. Any exported function whose body
// writes (insert/update/delete) against schema.participant must also call
// touchSubmissions, per submissions/touch.ts's touch-ON-WRITE contract — the
// same defect class that let removeParticipantRow skip the stamp until this
// task. The one legitimate exemption (insertActiveParticipants) is read from
// its OWN in-code comment ("No touchSubmissions call ...") rather than an
// allowlist constant, per DEC-180/DEC-808: a hand-listed exemption drifts,
// an in-code one lives next to the code it exempts.
//
// This is deliberately scoped to participants.ts alone — widening the scan
// to the whole repo is out of this task's stated scope.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PARTICIPANTS_REPO_PATH = path.join(__dirname, "..", "src", "server", "repo", "participants.ts");

/** One exported top-level function's name + full source (signature through
 * closing brace), extracted by brace-counting from the first `{` after the
 * `export async function NAME(` (or `export function NAME(`) header to its
 * matching close. Good enough for this single, controlled file — this is a
 * derived scan, not a general-purpose TS parser. */
interface ExtractedFn {
  name: string;
  body: string;
}

function extractExportedFunctions(source: string): ExtractedFn[] {
  const fns: ExtractedFn[] = [];
  const headerRe = /export\s+async\s+function\s+(\w+)\s*\([^)]*\)[^{]*\{/g;
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(source)) !== null) {
    const name = match[1]!;
    const bodyStart = match.index + match[0].length - 1; // index of the opening `{`
    let depth = 0;
    let i = bodyStart;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = source.slice(match.index, i + 1);
    fns.push({ name, body });
  }
  return fns;
}

/** Does this function body issue an insert/update/delete against
 * schema.participant? Matches drizzle's `.insert(schema.participant)`,
 * `.update(schema.participant)`, `.delete(schema.participant)` call shapes
 * (chunked-insert loops still call `db.insert(schema.participant)` inside
 * the loop body, so this catches those too). */
function writesParticipantTable(body: string): boolean {
  return /\.(insert|update|delete)\(\s*schema\.participant\s*\)/.test(body);
}

function callsTouchSubmissions(body: string): boolean {
  return /\btouchSubmissions\s*\(/.test(body);
}

/** The one legal exemption is documented IN the function's own body as a
 * comment, never in an external allowlist (DEC-180/DEC-808). */
function hasInCodeExemptionComment(body: string): boolean {
  return /No touchSubmissions call/.test(body);
}

/** Names of every exported function in `source` that writes
 * schema.participant, calls neither touchSubmissions nor carries the
 * in-code exemption comment. */
function findUnexemptedTouchOffenders(source: string): string[] {
  const offenders: string[] = [];
  for (const fn of extractExportedFunctions(source)) {
    if (!writesParticipantTable(fn.body)) continue;
    if (callsTouchSubmissions(fn.body)) continue;
    if (hasInCodeExemptionComment(fn.body)) continue;
    offenders.push(fn.name);
  }
  return offenders;
}

describe("DEC-725 (task-w10-tb): every participant-table writer in participants.ts touches its submission", () => {
  it("participants.ts has zero unexempted offenders", () => {
    const source = readFileSync(PARTICIPANTS_REPO_PATH, "utf8");
    const offenders = findUnexemptedTouchOffenders(source);
    expect(offenders).toEqual([]);
  });

  // DEC-725 wave-22 amendment: insertActiveParticipants' in-code exemption
  // premise ("this function's one caller ... always calls it in the same
  // request that just createSubmission'd submissionId") was FALSE --
  // attachOrCreateRosterSession (src/server/repo/contacts/push.ts) is a
  // second caller that attaches to a PRE-EXISTING submission, exactly the
  // case the premise excluded. The exemption is now gone from the file
  // (insertActiveParticipants calls touchSubmissions like every other
  // writer here). This assertion makes sure the file has zero LIVE
  // exemption comments -- a scan whose one real exemption disappears must
  // say so, rather than silently continuing to hold the door open (via
  // hasInCodeExemptionComment/the positive control above) for the next
  // writer that copies the same false premise into a new comment.
  it("participants.ts carries no live in-code touch exemption comment", () => {
    const source = readFileSync(PARTICIPANTS_REPO_PATH, "utf8");
    expect(source).not.toMatch(/No touchSubmissions call/);
  });

  it("removeParticipantRow itself is present, writes schema.participant, and calls touchSubmissions", () => {
    const source = readFileSync(PARTICIPANTS_REPO_PATH, "utf8");
    const fns = extractExportedFunctions(source);
    const target = fns.find((f) => f.name === "removeParticipantRow");
    expect(target).toBeDefined();
    expect(writesParticipantTable(target!.body)).toBe(true);
    expect(callsTouchSubmissions(target!.body)).toBe(true);
  });

  it("negative control: a synthetic writer with no touchSubmissions call and no exemption comment IS flagged", () => {
    const synthetic = `
export async function untouchedWriter(db: Db, participantId: string): Promise<void> {
  await db.delete(schema.participant).where(eq(schema.participant.id, participantId));
}
`;
    expect(findUnexemptedTouchOffenders(synthetic)).toEqual(["untouchedWriter"]);
  });

  it("positive control: a writer carrying the documented in-code exemption is NOT flagged", () => {
    const synthetic = `
export async function exemptBatchWriter(db: Db, rows: unknown[]): Promise<void> {
  for (const chunk of chunkRowsForInsert(rows)) {
    await db.insert(schema.participant).values(chunk);
  }
  // No touchSubmissions call (see submissions/touch.ts header for the
  // general contract this deliberately doesn't need).
}
`;
    expect(findUnexemptedTouchOffenders(synthetic)).toEqual([]);
  });

  it("a writer that DOES call touchSubmissions is not flagged even without the comment", () => {
    const synthetic = `
export async function touchedWriter(db: Db, participantId: string, submissionId: string): Promise<void> {
  const now = new Date();
  await db.update(schema.participant).set({ visible: true }).where(eq(schema.participant.id, participantId));
  await touchSubmissions(db, [submissionId], now);
}
`;
    expect(findUnexemptedTouchOffenders(synthetic)).toEqual([]);
  });

  it("a function that never touches schema.participant is ignored regardless of touchSubmissions", () => {
    const synthetic = `
export async function readsOnly(db: Db, submissionId: string): Promise<number> {
  const rows = await db.select({ count: sql\`count(*)\` }).from(schema.participant).where(eq(schema.participant.submissionId, submissionId));
  return rows[0]?.count ?? 0;
}
`;
    expect(findUnexemptedTouchOffenders(synthetic)).toEqual([]);
  });
});
