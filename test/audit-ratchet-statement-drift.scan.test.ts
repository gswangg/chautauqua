// Audit-ratchet-statement-drift instrument (DEC-903 wave-37, task w37-e).
//
// WHY: this wave's own planner lost two investigations to exactly this
// shape -- an audit doc under docs/design/audit/ whose NEWEST prose
// statement about a `*_CEILING`/`*_FLOOR`/`*_TRIPWIRE` ratchet constant no
// longer matches the constant's LIVE exported value. Two docs were found
// stale this way:
//   - cancelled-padding-gap-v12.md: its `## Instrument` paragraph still
//     said `CANCELLED_PADDING_GAP_CEILING` was "seeded at 22" with the
//     repair "left for a future wave"; the live
//     `app/src/cancelled-padding-gap.scan.test.ts` reads
//     `CANCELLED_PADDING_GAP_CEILING = 0` and the repair (`gap: 29px` on
//     every named container, landed in speakers.css/task-view.css) is
//     already built.
//   - frame-control-floor-390-v12.md: its WAVE 31 `### 3.`/`### 5.`
//     paragraphs still read "`FRAME_FLOOR_DIVERGENCE_CEILING`: **0 -> 1**"
//     with "left for a future wave's repair lane"; the live
//     `test/frame-control-floor.scan.test.ts` reads
//     `FRAME_FLOOR_DIVERGENCE_CEILING = 0` and the one offender it named
//     ("Draft" vs "Save draft") is ALREADY RULED in DEVIATIONS.md
//     (DEC-613 wave-96).
//
// Both docs are repaired this wave (append-only, DEC-069: the stale
// paragraph is marked SUPERSEDED-IN-PLACE by a new trailing section, never
// deleted or rewritten in place). This file is the INSTRUMENT that caught
// them and now guards against a third recurrence.
//
// POPULATION (DEC-808: enumerated via readdirSync, never a hand-listed
// file list): every `docs/design/audit/**/*.md` file.
//
// STATEMENT GRAMMAR: a line pairing a `[A-Z][A-Z0-9_]*_(CEILING|FLOOR|
// TRIPWIRE)` name with an integer, covering the four shapes the corpus
// actually uses (verified by hand-grepping the whole population before
// writing this regex set):
//   1. `NAME = N`                       -- e.g. `CANCELLED_PADDING_GAP_CEILING = 0`
//   2. `` `NAME` (seeded at N ``        -- e.g. `` `CANCELLED_PADDING_GAP_CEILING` (seeded at 22 ``
//   3. `` NAME`: **M -> N**``           -- e.g. `` `FRAME_FLOOR_DIVERGENCE_CEILING`: **0 -> 1** ``
//      (the RESULTING value, N, is the statement's own claim about the
//      constant -- the pre-image M is a historical fact about a prior
//      wave, not a claim about the constant's value now)
//   4. `NAME (N)`                       -- a name immediately followed by a
//      bare parenthesised integer (covers a shape not yet seen live but
//      named in this task's own brief; kept for robustness)
//
// A doc's STATEMENTS about one NAME are ordered by their position in the
// file (byte offset == document order, per this task's own instruction:
// "newest is by document order"). Only the LAST (newest) statement for a
// given NAME in a given file is graded -- an earlier, once-true statement
// that a later paragraph in the same file corrects is not an offender by
// construction; this is the exact "superseded-then-corrected" shape the
// negative control below exercises.
//
// LIVE VALUE: resolved by grepping `export const NAME = <integer>;` across
// app/src/**, test/**, scripts/** (readdirSync, recursive, .ts/.tsx only --
// DEC-808: a directory is not a population until it is actually read). A
// name with no live `export const` anywhere in those three roots is OUT OF
// POPULATION for this scan (not every `*_CEILING`-shaped word in an audit
// doc is a real exported ratchet constant -- some are quoted inside
// explanatory prose about a retired/renamed constant; grading those would
// produce noise this instrument cannot resolve honestly).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_069, DEC_808, DEC_903 } from "../src/decisions";
import { stripTsComments } from "./helpers/strip-ts-comments";
import { stripHtmlComments } from "./helpers/strip-html-comments";

void DEC_903; // this file's whole reason to exist: catch a doc's newest ratchet statement disagreeing with the live constant
void DEC_808; // population enumerated via readdirSync, never a hand-listed file list
void DEC_069; // repairs are append-only -- a stale paragraph is marked SUPERSEDED-IN-PLACE, never deleted

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const AUDIT_ROOT = join(REPO_ROOT, "docs", "design", "audit");

/** Every `docs/design/audit/**\/*.md` file (DEC-808: readdirSync, not a
 * hand-listed manifest). */
function auditMarkdownFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(AUDIT_ROOT, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const NAME_RE = `[A-Z][A-Z0-9_]*_(?:CEILING|FLOOR|TRIPWIRE)`;

// Ordered so the most specific (arrow, seeded-at) shapes are tried before
// the loosest (bare `= N`) shape on the same text -- each regex is run
// independently over the whole file text (not line-by-line) so a statement
// wrapped across a markdown line break (a bolded arrow inside a bullet) is
// still read as one statement.
const STATEMENT_RES: RegExp[] = [
  // Arrow/transition shapes -- take the RESULT value N, not the pre-image
  // M. Covers every arrow spelling actually found in the corpus (hand-
  // audited): `` `NAME`: **0 -> 1** ``, `` `NAME`: 13 → 6 `` (unicode
  // arrow), `` `NAME` lowered `4 -> 0` ``, `` `NAME` lowered `4` -> `3` ``
  // (each side independently backtick-wrapped), `` `NAME` raised `0 -> 4` ``
  // -- the name and up to 40 non-newline characters of connective prose
  // ("lowered", ": **", etc) may sit between the name and the transition,
  // and each number may independently carry its own backticks/bold.
  new RegExp(
    "`?(" + NAME_RE + ")`?[^\\n]{0,40}?\\*{0,2}`?-?\\d+`?\\s*(?:->|→)\\s*`?(-?\\d+)`?\\*{0,2}",
    "g",
  ),
  // `` `NAME` (seeded at N `` -- optionally backtick-quoted name.
  new RegExp("`?(" + NAME_RE + ")`?\\s*\\(seeded at (-?\\d+)", "g"),
  // `NAME (N)` -- name immediately followed by a bare parenthesised integer.
  new RegExp("(" + NAME_RE + ")\\s*\\((-?\\d+)\\)", "g"),
  // `NAME = N` -- plain assignment prose, optionally backtick-quoted
  // (`` `NAME` = 0 `` as well as bare `NAME = 0`; never inside a backtick
  // span naming a code identifier alone -- the export-line shape itself,
  // e.g. "export const NAME = N;", is exactly the LIVE-value shape too, and
  // grading it as a DOC statement is fine: a doc quoting its own instrument
  // export line verbatim is asserting that value as current).
  new RegExp("`?(" + NAME_RE + ")`?\\s*=\\s*(-?\\d+)", "g"),
];

interface Statement {
  name: string;
  value: number;
  offset: number; // document order
}

/** Every ratchet-name/integer statement in `text`, in document order. Where
 * more than one regex matches the same (name, offset) span (the `= N` shape
 * always also matches inside an already-matched arrow/seeded-at span's
 * tail), only the FIRST (most specific) regex's hit for that span survives
 * -- deduplicated by (name, offset). */
function extractStatements(text: string): Statement[] {
  const byOffset = new Map<string, Statement>();
  for (const re of STATEMENT_RES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1]!;
      const value = Number(m[2]);
      const key = `${m.index}:${name}`;
      if (byOffset.has(key)) continue; // a more specific regex already claimed this exact span
      byOffset.set(key, { name, value, offset: m.index });
    }
  }
  return [...byOffset.values()].sort((a, b) => a.offset - b.offset);
}

/** The newest (last, by document order) statement per NAME in `statements`. */
function newestPerName(statements: Statement[]): Map<string, Statement> {
  const out = new Map<string, Statement>();
  for (const s of statements) out.set(s.name, s); // later overwrites earlier -- document order
  return out;
}

const SOURCE_ROOTS = ["app/src", "test", "scripts"];
const SOURCE_EXTS = [".ts", ".tsx"];

let _liveValueCache: Map<string, number[]> | null = null;

/** Every `export const NAME = <int>` found across app/src/**, test/**,
 * scripts/** (readdirSync, recursive), keyed by NAME. A name defined in
 * more than one file (should not happen for a real ratchet constant, but
 * this instrument does not assume it) keeps every value found -- a doc
 * statement is graded as matching if it equals ANY of them, so this
 * instrument never manufactures a false offender out of a genuine
 * multi-definition it cannot itself adjudicate. */
function liveConstantValues(): Map<string, number[]> {
  if (_liveValueCache !== null) return _liveValueCache;
  const map = new Map<string, number[]>();
  const exportRe = new RegExp(`export const (${NAME_RE}) = (-?\\d+);`, "g");
  for (const root of SOURCE_ROOTS) {
    const abs = join(REPO_ROOT, root);
    for (const entry of readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) continue;
      const filePath = join(entry.parentPath, entry.name);
      // Comment-blind guard (DEC-374 wave-44, task w44-i, shared
      // test/helpers/strip-ts-comments.ts -- DEC-613, never a private
      // copy): a comment merely QUOTING an `export const NAME = N;`
      // declaration must never be read as this constant's live value.
      const text = stripTsComments(readFileSync(filePath, "utf-8"));
      exportRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = exportRe.exec(text)) !== null) {
        const name = m[1]!;
        const value = Number(m[2]);
        const existing = map.get(name);
        if (existing) {
          if (!existing.includes(value)) existing.push(value);
        } else {
          map.set(name, [value]);
        }
      }
    }
  }
  _liveValueCache = map;
  return map;
}

interface Offender {
  file: string;
  name: string;
  docValue: number;
  liveValues: number[];
}

function findOffenders(): Offender[] {
  const live = liveConstantValues();
  const offenders: Offender[] = [];
  for (const abs of auditMarkdownFiles()) {
    const rel = relative(REPO_ROOT, abs);
    // Comment-blind guard (shared test/helpers/strip-html-comments.ts --
    // DEC-613, never a private copy): an `<!-- -->`-hidden old statement
    // must never be read as the doc's newest.
    const text = stripHtmlComments(readFileSync(abs, "utf-8"));
    const newest = newestPerName(extractStatements(text));
    for (const [name, statement] of newest) {
      const liveValues = live.get(name);
      if (liveValues === undefined) continue; // not a real exported constant -- out of population
      if (liveValues.includes(statement.value)) continue;
      offenders.push({ file: rel, name, docValue: statement.value, liveValues });
    }
  }
  return offenders.sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file.localeCompare(b.file)));
}

// RATCHET (DEC-808 shape: forced to -1, roster printed, read back -- never
// arithmetic). This instrument's population is EVERY docs/design/audit/**/
// *.md file, not just the two this task repairs -- forcing the ceiling to
// -1 and reading the printed roster back (after both doc repairs landed)
// measured exactly 2 offenders, both in docs this task does not own
// (outside FILES YOU OWN, so not repaired here; a future wave repairs them
// and lowers this ceiling in the same commit, DEC-808 two-sided discipline):
//   - docs/design/audit/code-comment-citation-v12.md:
//     `CODE_COMMENT_CITATION_CEILING = 37`, live value 0.
//   - docs/design/audit/decisions-registry-citation-v12.md:
//     `DECISIONS_REGISTRY_CITATION_CEILING` states 1234, live value 1228.
const AUDIT_RATCHET_STATEMENT_DRIFT_CEILING = 2;

describe("audit-ratchet-statement-drift", () => {
  it("VACUOUS-POPULATION TRIPWIRE: the walk finds both docs this wave repaired, and each carries at least one real statement", () => {
    const files = auditMarkdownFiles();
    expect(files.some((f) => f.endsWith("cancelled-padding-gap-v12.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("frame-control-floor-390-v12.md"))).toBe(true);
    const cancelledText = stripHtmlComments(readFileSync(join(AUDIT_ROOT, "cancelled-padding-gap-v12.md"), "utf-8"));
    const statements = extractStatements(cancelledText);
    expect(statements.some((s) => s.name === "CANCELLED_PADDING_GAP_CEILING")).toBe(true);
  });

  it("resolves the LIVE value of a real exported ratchet constant from the tree", () => {
    const live = liveConstantValues();
    expect(live.get("CANCELLED_PADDING_GAP_CEILING")).toEqual([0]);
    expect(live.get("FRAME_FLOOR_DIVERGENCE_CEILING")).toEqual([0]);
  });

  it("extracts all four documented statement shapes from synthetic fixture text", () => {
    const fixture = [
      "`FOO_CEILING` (seeded at 22, this branch's own measurement)",
      "`BAR_TRIPWIRE`: **106 -> 105**",
      "BAZ_FLOOR (7)",
      "QUUX_CEILING = 0",
    ].join("\n");
    const statements = extractStatements(fixture);
    const byName = new Map(statements.map((s) => [s.name, s.value]));
    expect(byName.get("FOO_CEILING")).toBe(22);
    expect(byName.get("BAR_TRIPWIRE")).toBe(105); // the RESULT of the arrow, not the pre-image
    expect(byName.get("BAZ_FLOOR")).toBe(7);
    expect(byName.get("QUUX_CEILING")).toBe(0);
  });

  it("POSITIVE control: a fabricated doc whose ONLY statement about a real live constant disagrees with the live value is a detected offender", () => {
    const liveCancelledPadding = liveConstantValues().get("CANCELLED_PADDING_GAP_CEILING");
    expect(liveCancelledPadding).toEqual([0]); // premise: the live value really is 0 today
    const fabricatedDoc =
      "This fabricated fixture doc claims `CANCELLED_PADDING_GAP_CEILING` (seeded at 999, a value that has never been true) and never corrects it.";
    const newest = newestPerName(extractStatements(fabricatedDoc));
    const statement = newest.get("CANCELLED_PADDING_GAP_CEILING")!;
    expect(statement.value).toBe(999);
    expect(liveCancelledPadding!.includes(statement.value)).toBe(false); // this IS an offender shape
  });

  it("NEGATIVE control: a fabricated doc whose superseded-then-corrected pair ends on the LIVE value is not a detected offender (newest wins, by document order)", () => {
    const liveCancelledPadding = liveConstantValues().get("CANCELLED_PADDING_GAP_CEILING")!;
    const fabricatedDoc = [
      "## Original measurement",
      "`CANCELLED_PADDING_GAP_CEILING` (seeded at 999, this branch's own measurement).",
      "",
      "## Wave N amendment: SUPERSEDED-IN-PLACE",
      "The paragraph above is stale. Re-measured: `CANCELLED_PADDING_GAP_CEILING` = 0.",
    ].join("\n");
    const newest = newestPerName(extractStatements(fabricatedDoc));
    const statement = newest.get("CANCELLED_PADDING_GAP_CEILING")!;
    expect(statement.value).toBe(0); // the LATER paragraph's statement wins, not the earlier 999
    expect(liveCancelledPadding.includes(statement.value)).toBe(true); // not an offender
  });

  it("the two docs this wave repaired now carry a newest statement matching their live constant", () => {
    const live = liveConstantValues();
    for (const fname of ["cancelled-padding-gap-v12.md", "frame-control-floor-390-v12.md"]) {
      const abs = join(AUDIT_ROOT, fname);
      const text = stripHtmlComments(readFileSync(abs, "utf-8"));
      const newest = newestPerName(extractStatements(text));
      const ceilingStatements = [...newest.values()].filter((s) =>
        s.name.endsWith("_CEILING") && live.has(s.name),
      );
      expect(ceilingStatements.length).toBeGreaterThan(0);
      for (const s of ceilingStatements) {
        const liveValues = live.get(s.name)!;
        expect(liveValues.includes(s.value)).toBe(true);
      }
    }
  });

  it("ratchet: no audit doc's newest statement about a real live ratchet constant disagrees with the live value", () => {
    const offenders = findOffenders();
    if (offenders.length > AUDIT_RATCHET_STATEMENT_DRIFT_CEILING) {
      throw new Error(
        `${offenders.length} audit-doc ratchet-statement-drift offender(s) exceed ` +
          `AUDIT_RATCHET_STATEMENT_DRIFT_CEILING = ${AUDIT_RATCHET_STATEMENT_DRIFT_CEILING} -- a doc's ` +
          `newest statement about a live *_CEILING/*_FLOOR/*_TRIPWIRE constant no longer matches the ` +
          `tree. The doc moves, the constant never does:\n` +
          offenders
            .map(
              (o) =>
                `  ${o.file} -- ${o.name} states ${o.docValue}, live value(s): ${o.liveValues.join(", ")}`,
            )
            .join("\n"),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(AUDIT_RATCHET_STATEMENT_DRIFT_CEILING);
  });

  // BELOW-direction companion (DEC-808 two-sided ratchet discipline): fails
  // when the measured offender count drops below the pinned ceiling,
  // forcing the constant down in the same commit that lands the fix rather
  // than letting the ceiling sit stale above the truth -- the exact defect
  // this whole file exists to catch, one level up, applied to itself.
  it("ratchet (BELOW-direction companion): the ceiling is not stale -- the measured offender count must not have dropped below AUDIT_RATCHET_STATEMENT_DRIFT_CEILING without the constant being lowered to match", () => {
    const offenders = findOffenders();
    if (offenders.length < AUDIT_RATCHET_STATEMENT_DRIFT_CEILING) {
      throw new Error(
        `${offenders.length} audit-doc ratchet-statement-drift offender(s) measured, below ` +
          `AUDIT_RATCHET_STATEMENT_DRIFT_CEILING = ${AUDIT_RATCHET_STATEMENT_DRIFT_CEILING} -- the ceiling ` +
          `itself is stale (a fix landed since it was last set). Lower it to match:\n` +
          `  const AUDIT_RATCHET_STATEMENT_DRIFT_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(AUDIT_RATCHET_STATEMENT_DRIFT_CEILING);
  });
});
