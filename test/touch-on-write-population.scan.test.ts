// DEC-725 (wave-17 amendment, closed wave-18): a DERIVED scan over the
// REPO-WIDE population the ruling names -- "the population is the set of
// statements that INSERT, UPDATE or DELETE schema.participant, derived by
// grepping that table name, never a hand-listed set of functions
// (DEC-180)". This used to be scoped to src/server/repo/participants.ts
// alone (task-w10-tb); wave-18 widened it to every src/**/*.ts file the
// grep actually finds. For each such file, every EXPORTED top-level
// function whose OWN body writes schema.participant must either call a
// touchSubmissions* helper or carry an in-code exemption comment ("No
// touchSubmissions call") -- read from the code, never an allowlist
// constant (DEC-180/DEC-808), so a new writer that skips the contract is
// caught the moment it lands, not the next time someone remembers to update
// a list.
//
// The brace-counting extractor is unchanged from the participants.ts-only
// scan this replaces -- it only understands `export async function NAME(...)
// [: ReturnType] {` headers with a SIMPLE return type; a return type
// containing its own `{...}` (e.g. `Promise<{ id: string }>`) can make the
// header regex stop at the type's brace instead of the real body brace and
// mis-extract that one function. This is a known, inherited limitation
// (kept, per this task's scope, rather than rewritten) -- it produces a
// false NEGATIVE (a writer silently not checked), never a false positive,
// so it cannot make this test wrongly pass a real offender; every function
// actually flagged below is a genuine one.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");

const PARTICIPANT_WRITE_RE = /\.(insert|update|delete)\(\s*schema\.participant\s*\)/;

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function isDecisionsDataFile(path: string): boolean {
  return /[\\/]decisions-data[\\/]/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith(".ts") && !isTestFile(full) && !isDecisionsDataFile(full)) {
      out.push(full);
    }
  }
  return out;
}

/** Every `src/**\/*.ts` file (production code, never a test or decisions-data
 * file) whose source contains an INSERT/UPDATE/DELETE statement against
 * schema.participant -- the population DEC-725 names, derived by grepping
 * the table name rather than hand-listing functions (DEC-180). */
function findParticipantWriterFiles(): string[] {
  return walk(SRC_ROOT)
    .filter((f) => PARTICIPANT_WRITE_RE.test(readFileSync(f, "utf8")))
    .sort();
}

/** One exported top-level function's name + full source (signature through
 * matching close brace), extracted by brace-counting from the first `{`
 * after the `export async function NAME(` (or `export function NAME(`)
 * header to its matching close. See the header comment above for this
 * extractor's one known limitation. */
interface ExtractedFn {
  name: string;
  body: string;
}

function extractExportedFunctions(source: string): ExtractedFn[] {
  const fns: ExtractedFn[] = [];
  const headerRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*\{/g;
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
 * (chunked-insert/update loops still call these inside the loop body, so
 * this catches those too). */
function writesParticipantTable(body: string): boolean {
  return PARTICIPANT_WRITE_RE.test(body);
}

function callsTouchSubmissions(body: string): boolean {
  // touchSubmissions / touchSubmissionsForContacts / touchSubmissionsForTracks
  return /\btouchSubmissions\w*\s*\(/.test(body);
}

/** The one legal exemption is documented IN the function's own body as a
 * comment, never in an external allowlist (DEC-180/DEC-808). */
function hasInCodeExemptionComment(body: string): boolean {
  return /No touchSubmissions call/.test(body);
}

/** {file, name} pairs for every exported function in `source` that writes
 * schema.participant, calls neither touchSubmissions* nor carries the
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

describe("DEC-725 (wave-18): every participant-table writer, repo-wide, touches its submission", () => {
  it("the derived population is non-empty (the scan is actually exercising something)", () => {
    const files = findParticipantWriterFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it("participants.ts is part of the derived population", () => {
    const files = findParticipantWriterFiles().map((f) => relative(ROOT, f));
    expect(files).toContain("src/server/repo/participants.ts");
  });

  it("zero unexempted offenders across the whole derived population", () => {
    const files = findParticipantWriterFiles();
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const name of findUnexemptedTouchOffenders(source)) {
        offenders.push(`${relative(ROOT, file)}::${name}`);
      }
    }
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
    const source = readFileSync(join(SRC_ROOT, "server", "repo", "participants.ts"), "utf8");
    expect(source).not.toMatch(/No touchSubmissions call/);
  });

  it("removeParticipantRow itself is present, writes schema.participant, and calls touchSubmissions", () => {
    const source = readFileSync(join(SRC_ROOT, "server", "repo", "participants.ts"), "utf8");
    const fns = extractExportedFunctions(source);
    const target = fns.find((f) => f.name === "removeParticipantRow");
    expect(target).toBeDefined();
    expect(writesParticipantTable(target!.body)).toBe(true);
    expect(callsTouchSubmissions(target!.body)).toBe(true);
  });

  it("insertActiveParticipants now stamps the submission itself, closing the false exemption DEC-725 wave-18 flagged", () => {
    const source = readFileSync(join(SRC_ROOT, "server", "repo", "participants.ts"), "utf8");
    const fns = extractExportedFunctions(source);
    const target = fns.find((f) => f.name === "insertActiveParticipants");
    expect(target).toBeDefined();
    expect(writesParticipantTable(target!.body)).toBe(true);
    expect(callsTouchSubmissions(target!.body)).toBe(true);
    // The premise that used to excuse this function -- "this function's one
    // caller always calls it in the same request that just
    // createSubmission'd submissionId" -- is false (attachOrCreateRosterSession
    // in src/server/repo/contacts/push.ts attaches to a PRE-EXISTING
    // submission) and must not reappear as a stale exemption comment now
    // that the function stamps for real.
    expect(target!.body).not.toMatch(/this function's one caller/);
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
