// DEC-962 wave-58 amendment: "a WRITE carries its scope in the WHERE,
// exactly like the batched read". files-content-status.ts's updateContentStatus
// mutated by submission id alone with no event predicate of its own, safe
// only because one of its two callers checked ownership first. Per the
// wave-57 population doctrine, this scan derives its subjects as a
// PROPERTY, not a hand-listed set: every EXPORTED function under
// src/server/repo/**/*.ts whose body issues `db.update(schema.submission)`
// or `db.delete(schema.submission)`. Each member must reference
// `schema.submission.eventId` inside that statement, or sit in a NAMED
// exemption list whose entries carry STRUCTURAL reasons only (never a
// branch note, never a line-number citation — DEC-967 w57: a citation is
// not an assertion).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "src", "server", "repo");

/** Every .ts file under `root`, excluding test files. */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.ts$/.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface FoundFn {
  file: string;
  name: string;
  body: string;
}

// Matches `export async function NAME(` / `export function NAME(` at the
// start of a declaration — captures the name and the index right after the
// signature's opening `(`, from which the matching closing brace of the
// function body is located by brace-depth counting (never a naive regex
// over the whole file, which cannot know where one function ends and the
// next begins).
const EXPORTED_FN_RE = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;

/** Extracts every top-level exported function's name + body text from a
 * source file, by brace-depth counting from the declaration's first `{`. */
function extractExportedFunctions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  for (const m of src.matchAll(EXPORTED_FN_RE)) {
    const name = m[1] as string;
    const sigStart = (m.index ?? 0) + m[0].length;
    // Skip past the parameter list (balance parens) to find the body's `{`.
    let depth = 1;
    let i = sigStart;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    // From here to the function body's `{` is the return-type annotation,
    // which may itself contain `{...}` (an inline object type, e.g.
    // `Promise<{ reopened: boolean }>`) nested inside `<...>` generics. The
    // body's own opening brace is the first `{` encountered OUTSIDE any
    // `<...>` nesting (angle-bracket depth 0) -- never a naive
    // indexOf('{', i), which would stop at the return type's own brace.
    let angleDepth = 0;
    let braceStart = -1;
    for (let k = i; k < src.length; k++) {
      const ch = src[k];
      if (ch === "<") angleDepth++;
      else if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
      else if (ch === "{" && angleDepth === 0) {
        braceStart = k;
        break;
      }
    }
    if (braceStart === -1) continue;
    let braceDepth = 1;
    let j = braceStart + 1;
    while (j < src.length && braceDepth > 0) {
      if (src[j] === "{") braceDepth++;
      else if (src[j] === "}") braceDepth--;
      j++;
    }
    out.push({ name, body: src.slice(braceStart, j) });
  }
  return out;
}

// The fingerprint for a submission WRITE this DEC governs: an `.update(` or
// `.delete(` call whose argument is `schema.submission` (never a SELECT,
// and never a write to a different table).
const SUBMISSION_WRITE_RE = /\.(update|delete)\(\s*schema\.submission\s*\)/;

/** For one function body, every submission-write STATEMENT: from each
 * `.update(schema.submission)`/`.delete(schema.submission)` match forward to
 * the statement-terminating `;` — this codebase's chained-builder style
 * (`await db\n  .update(...)\n  .set(...)\n  .where(...);`) never nests a
 * semicolon inside one such statement. */
function submissionWriteStatements(body: string): string[] {
  const out: string[] = [];
  const re = new RegExp(SUBMISSION_WRITE_RE, "g");
  for (const m of body.matchAll(re)) {
    const start = m.index ?? 0;
    const end = body.indexOf(";", start);
    out.push(end === -1 ? body.slice(start) : body.slice(start, end + 1));
  }
  return out;
}

function hasSubmissionWrite(body: string): boolean {
  return SUBMISSION_WRITE_RE.test(body);
}

function scopedOnEventId(statement: string): boolean {
  return /schema\.submission\.eventId/.test(statement);
}

// -----------------------------------------------------------------------
// Named exemption list — STRUCTURAL reasons only.
// -----------------------------------------------------------------------
interface Exemption {
  file: string;
  fn: string;
  reason: string;
}

const EXEMPTIONS: Exemption[] = [
  {
    file: join(REPO_ROOT, "ics-sequence.ts"),
    fn: "bumpIcsSequences",
    reason:
      "Sets only icsSequence + updatedAt (a monotonic ICS invite counter, never content_status/title/description/status — a field that governs neither authz nor public visibility). Its id list is always the product of an already-scoped resolution one hop up in the caller (a submission the caller itself just wrote, or a set derived from a scoped SELECT), never raw external input threaded straight through.",
  },
  {
    file: join(REPO_ROOT, "ics-sequence.ts"),
    fn: "bumpIcsSequencesForRoom",
    reason:
      "Sets only icsSequence + updatedAt. Scoped by roomId via a joined subquery on schedule_slot — a room belongs to exactly one event by schema construction, so roomId is itself a scope predicate, just not the eventId column literally.",
  },
  {
    file: join(REPO_ROOT, "submissions", "touch.ts"),
    fn: "touchSubmissions",
    reason:
      "Sets only updatedAt (a bookkeeping timestamp, never a field governing authz/visibility/content). Ids are always the submission(s) a sibling write in the SAME caller just touched, never raw external input.",
  },
  {
    file: join(REPO_ROOT, "submissions", "touch.ts"),
    fn: "touchSubmissionsForContacts",
    reason:
      "Sets only updatedAt. Resolves dependent submission ids by a subquery correlated on participant.contactId, not from caller-supplied submission ids at all.",
  },
  {
    file: join(REPO_ROOT, "submissions", "touch.ts"),
    fn: "touchSubmissionsForTracks",
    reason:
      "Sets only updatedAt. Resolves dependent submission ids by a subquery correlated on submissionTrack.trackId, not from caller-supplied submission ids at all.",
  },
  {
    file: join(REPO_ROOT, "portal-edit.ts"),
    fn: "saveSubmissionEdits",
    reason:
      "Portal (speaker) writes use a DIFFERENT scoping doctrine than organizer writes: DEC-962's own wave-47 amendment scopes portal reads on contactId via a correlated participant join, not on eventId — the portal has no per-event admin boundary, only a per-speaker one. This write's WHERE carries that same correlated EXISTS-over-participant-on-contactId predicate (mirroring src/server/repo/tasks/crud.ts's acceptedSpeakerExistsForContact idiom) instead of an eventId equality, because eventId is not this write's ownership key.",
  },
];

describe("no src/server/repo/**/*.ts submission WRITE is missing its own scope predicate (DEC-962 wave-58 amendment)", () => {
  const FILES = allSourceFiles(REPO_ROOT);

  it("scanned more than 10 repo files", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it("every allowlist entry still names a live file", () => {
    for (const entry of EXEMPTIONS) {
      expect(() => statSync(entry.file), `exempted file no longer exists: ${entry.file}`).not.toThrow();
    }
  });

  // The population itself, derived as a PROPERTY: every exported function
  // (across the whole scanned tree) whose body issues a submission write.
  const POPULATION: FoundFn[] = [];
  for (const file of FILES) {
    const src = readFileSync(file, "utf-8");
    for (const { name, body } of extractExportedFunctions(src)) {
      if (hasSubmissionWrite(body)) POPULATION.push({ file, name, body });
    }
  }

  it("the population is non-empty", () => {
    expect(POPULATION.length).toBeGreaterThan(0);
  });

  it("every exempted (file, fn) pair is actually present in the population", () => {
    const present = new Set(POPULATION.map((p) => `${p.file}::${p.name}`));
    for (const entry of EXEMPTIONS) {
      expect(
        present.has(`${entry.file}::${entry.fn}`),
        `exemption ${relative(HERE, entry.file)}::${entry.fn} no longer issues a submission write -- remove the entry`,
      ).toBe(true);
    }
  });

  it("every population member either scopes on schema.submission.eventId, or is named in the exemption list", () => {
    const exemptSet = new Set(EXEMPTIONS.map((e) => `${e.file}::${e.fn}`));
    const offenders: string[] = [];
    for (const fn of POPULATION) {
      if (exemptSet.has(`${fn.file}::${fn.name}`)) continue;
      const statements = submissionWriteStatements(fn.body);
      const allScoped = statements.length > 0 && statements.every(scopedOnEventId);
      if (!allScoped) offenders.push(`${relative(HERE, fn.file)}::${fn.name}`);
    }
    expect(offenders, `unscoped, unexempted submission writers:\n${offenders.join("\n")}`).toEqual([]);
  });

  // Positive control: files-content-status.ts's own writers ARE detected
  // and DO scope on eventId now -- proves the detector isn't vacuously
  // passing everything.
  it("positive control: updateContentStatus/updateContentStatuses/reopenContentReview are in the population and scoped", () => {
    const names = new Set(
      POPULATION.filter((p) => p.file.endsWith(join("repo", "files-content-status.ts"))).map((p) => p.name),
    );
    expect(names).toEqual(new Set(["updateContentStatus", "updateContentStatuses", "reopenContentReview"]));
  });

  // Negative control: a synthetic unscoped submission write IS flagged by
  // the same predicate this scan uses -- proves the detector isn't blind.
  it("negative control: a synthetic unscoped submission update is reported by the same predicate", () => {
    const fixtureSrc = `
import { eq } from "drizzle-orm";
export async function unscopedWrite(db: Db, x: string): Promise<void> {
  await db
    .update(schema.submission)
    .set({ contentStatus: "approved" })
    .where(eq(schema.submission.id, x));
}
`;
    const fns = extractExportedFunctions(fixtureSrc);
    expect(fns.map((f) => f.name)).toEqual(["unscopedWrite"]);
    const body = fns[0]!.body;
    expect(hasSubmissionWrite(body)).toBe(true);
    const statements = submissionWriteStatements(body);
    expect(statements.length).toBe(1);
    expect(statements.every(scopedOnEventId)).toBe(false);
  });

  // Positive control (statement-shape): a synthetic SCOPED submission
  // update IS recognized as scoped -- proves the detector doesn't just
  // always fail.
  it("positive control: a synthetic eventId-scoped submission update is recognized as scoped", () => {
    const fixtureSrc = `
export async function scopedWrite(db: Db, eventId: string, x: string): Promise<void> {
  await db
    .update(schema.submission)
    .set({ contentStatus: "approved" })
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.id, x)));
}
`;
    const fns = extractExportedFunctions(fixtureSrc);
    const body = fns[0]!.body;
    const statements = submissionWriteStatements(body);
    expect(statements.length).toBe(1);
    expect(statements.every(scopedOnEventId)).toBe(true);
  });

  // Vacuous-scan tripwire.
  it("vacuous-scan tripwire: the repo scan walked more than 20 files and found more than one submission-writing function", () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(POPULATION.length).toBeGreaterThan(1);
  });
});
