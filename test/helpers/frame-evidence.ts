// DEC-374 (wave 18 amendment): FRAME EVIDENCE IS NOT PRODUCT COPY. A test
// file that quotes a docs/design/*.dc.html line VERBATIM -- as a citation
// comment, a `verbatimLine(...)` literal, or a test title naming the
// literal -- is receipting the frame, not writing product copy or product
// markup. A vocabulary/glyph scan whose subject is product copy (what the
// app actually renders) must exclude a test file's frame-quoting spans
// from its offender population, or it flags the pack's own prose as if the
// product wrote it.
//
// This is the ONE shared predicate (DEC-613: never a second derivation) --
// both select-caret.scan.test.ts and remind-skip-vocabulary.scan.test.ts
// import it rather than reimplementing the "is this span a frame quote"
// check.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const DESIGN_DIR = join(REPO_ROOT, "docs", "design");

let cachedPackLines: Set<string> | undefined;

/** Reads every docs/design/*.dc.html file once and caches the set of
 * trimmed lines it contains, for verbatim-quote membership checks. Lazily
 * populated (not at module load) so importers that never call
 * isFrameEvidence never pay the I/O. */
function packLines(): Set<string> {
  if (cachedPackLines !== undefined) return cachedPackLines;
  const lines = new Set<string>();
  for (const entry of readdirSync(DESIGN_DIR)) {
    if (!entry.endsWith(".dc.html")) continue;
    const text = readFileSync(join(DESIGN_DIR, entry), "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length > 0) lines.add(trimmed);
    }
  }
  return (cachedPackLines = lines);
}

/** Test-only escape hatch: forces the next packLines() call to re-read the
 * pack from disk. Used by frame-evidence.test.ts's vacuous-population
 * tripwire and controls so each test observes a fresh read. */
export function resetFrameEvidenceCacheForTests(): void {
  cachedPackLines = undefined;
}

/** Returns the smallest backtick-delimited or quote-delimited (', ")
 * string literal span on `line` that encloses `charIndex`, trimmed -- or
 * undefined if `charIndex` is not inside any such span. "Smallest" means
 * the innermost pair of matching delimiters around the index, so a
 * backtick string containing a nested quoted attribute still resolves to
 * the whole backtick span (the delimiter that actually encloses the
 * comment/literal), not a fragment of it. */
function enclosingLiteral(line: string, charIndex: number): string | undefined {
  const delimiters: Array<'"' | "'" | "`"> = ['"', "'", "`"];
  let best: string | undefined;
  for (const delim of delimiters) {
    let start = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== delim) continue;
      if (start === -1) {
        start = i;
        continue;
      }
      // [start, i] is a closed span for this delimiter.
      if (start <= charIndex && charIndex <= i) {
        const span = line.slice(start + 1, i);
        // Prefer the narrowest enclosing span found across delimiter kinds.
        if (best === undefined || span.length < best.length) best = span;
      }
      start = -1;
    }
  }
  return best?.trim();
}

/** True iff `filePath` is a test file AND the smallest quoted/backtick
 * literal on `sourceLine` enclosing `matchIndex` appears verbatim (after
 * trimming) as a line somewhere in docs/design/*.dc.html. This is the
 * whole rule: frame evidence is a test file quoting the pack, never
 * product source, and never a paraphrase. */
export function isFrameEvidence(filePath: string, sourceLine: string, matchIndex: number): boolean {
  if (!/\.test\.tsx?$/.test(filePath)) return false;
  const literal = enclosingLiteral(sourceLine, matchIndex);
  if (literal === undefined || literal.length === 0) return false;
  return packLines().has(literal);
}
