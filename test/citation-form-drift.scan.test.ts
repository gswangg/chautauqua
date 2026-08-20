// Citation-FORM-drift ratchet (DEC-967 amendment, task w11-t).
//
// WHY: five consecutive waves went red on the same defect -- a
// backtick-quoted citation keyed on a line number in a file someone else
// edits (test/decision-doc-citation.scan.test.ts's own
// UNRESOLVED_CITATION_CEILING population) -- and five consecutive merge
// trains RE-POINTED the line instead of converting the citation to the
// drift-proof shape that test/decision-doc-citation.scan.test.ts already
// blessed (DEC-967 wave-115, task w4-ab): a bare path immediately followed
// by a backtick quote, resolved against the WHOLE cited file rather than
// one pinned line. Commit 0603c596's own body: "Repointing would only
// drift again next wave" -- and the population is still there.
//
// This file does not check whether a citation is TRUE (that is
// test/decision-doc-citation.scan.test.ts's UNRESOLVED_CITATION_CEILING /
// WIDENED_UNRESOLVED_CITATION_CEILING job -- citation RESOLUTION). This
// file checks citation FORM: does a citation into app/src/, src/, test/,
// scripts/ or migrations/ still use the fragile line-keyed shape
// (`path:line` immediately followed by a backtick quote) instead of the
// drift-proof one. An integrity property of the ledger's own durability,
// not a v12 frame or 390-geometry conformance fact -- see this constant's
// entry in scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE.
//
// POPULATION: the SAME widened population
// test/decision-doc-citation.scan.test.ts already derives --
// src/decisions-data/DEC-*.md, docs/design/audit/*.md, docs/probes/*.md,
// docs/design/DEVIATIONS.md, docs/design/DESIGN-RULINGS.md and
// docs/mobile-campaign.md -- derived here by the SAME mechanism
// (readdirSync over each directory, never a hand-listed manifest; DEC-808:
// "a directory is not a population" cuts the other way too, you must
// actually read the directory). This file does not import that file's
// internals (only its two ratchet constants are exported) -- the
// enumeration is small and re-derived here directly against the
// filesystem, exactly the "same walk" discipline
// test/decision-doc-citation.scan.test.ts's own widened-population section
// uses for its four extra classes (readdirSync, never an assumption about
// a prior wave's count).
//
// STRUCTURAL CARVE-OUT: docs/design/*.dc.html citations keep `file:line`
// and are NOT counted here. The frame is the coordinate system and never
// moves -- CITATION_RE's extension alternation below does not include
// `html` at all, so a `.dc.html` citation never matches the shape in the
// first place (belt); the negative-lookbehind `(?<!\.dc\.html)` is kept
// anyway, verbatim from test/decision-doc-citation.scan.test.ts's own
// CITATION_RE, as a second, redundant guard against a future extension
// widening silently reopening the carve-out (suspenders).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Population (same four extra classes + the decision-registry class that
// test/decision-doc-citation.scan.test.ts's widened population uses).
// ---------------------------------------------------------------------------

function mdFilesIn(dir: string, namePattern: RegExp = /\.md$/): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && namePattern.test(e.name))
    .map((e) => e.name)
    .sort();
}

const DECISIONS_DATA_DIR = join(ROOT, "src", "decisions-data");
const AUDIT_DIR = join(ROOT, "docs", "design", "audit");
const PROBES_DIR = join(ROOT, "docs", "probes");

const DECISION_DOC_NAMES = mdFilesIn(DECISIONS_DATA_DIR, /^DEC-\d+\.md$/);
const AUDIT_DOC_NAMES = mdFilesIn(AUDIT_DIR);
const PROBE_DOC_NAMES = mdFilesIn(PROBES_DIR);

interface SourceDoc {
  /** Label used in offender messages, e.g. "src/decisions-data/DEC-986.md". */
  doc: string;
  content: string;
}

const POPULATION_CLASSES: { label: string; docs: SourceDoc[] }[] = [
  {
    label: "src/decisions-data/DEC-*.md",
    docs: DECISION_DOC_NAMES.map((name) => ({
      doc: `src/decisions-data/${name}`,
      content: readFileSync(join(DECISIONS_DATA_DIR, name), "utf-8"),
    })),
  },
  {
    label: "docs/design/audit/*.md",
    docs: AUDIT_DOC_NAMES.map((name) => ({
      doc: `docs/design/audit/${name}`,
      content: readFileSync(join(AUDIT_DIR, name), "utf-8"),
    })),
  },
  {
    label: "docs/probes/*.md",
    docs: PROBE_DOC_NAMES.map((name) => ({
      doc: `docs/probes/${name}`,
      content: readFileSync(join(PROBES_DIR, name), "utf-8"),
    })),
  },
  {
    label: "docs/design/DEVIATIONS.md",
    docs: [
      {
        doc: "docs/design/DEVIATIONS.md",
        content: readFileSync(join(ROOT, "docs", "design", "DEVIATIONS.md"), "utf-8"),
      },
    ],
  },
  {
    label: "docs/design/DESIGN-RULINGS.md",
    docs: [
      {
        doc: "docs/design/DESIGN-RULINGS.md",
        content: readFileSync(join(ROOT, "docs", "design", "DESIGN-RULINGS.md"), "utf-8"),
      },
    ],
  },
  {
    label: "docs/mobile-campaign.md",
    docs: [
      {
        doc: "docs/mobile-campaign.md",
        content: readFileSync(join(ROOT, "docs", "mobile-campaign.md"), "utf-8"),
      },
    ],
  },
];

const ALL_DOCS: SourceDoc[] = POPULATION_CLASSES.flatMap((c) => c.docs);

// ---------------------------------------------------------------------------
// Repo file index, for resolving a citation's path and checking which
// top-level directory it lives under. Same resolution contract as
// test/decision-doc-citation.scan.test.ts's resolvePath: a slash-bearing
// path is repo-relative as written; a bare basename resolves uniquely
// against every file in the tree or is dropped (ambiguous/missing
// citations are not this scan's job -- that is DIRECTION 1 resolution in
// test/decision-doc-citation.scan.test.ts; a citation that cannot be
// resolved at all cannot be classified as "resolves under" any directory,
// so it is simply not counted here).
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".wrangler"]);

function enumerateAllRepoFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        out.push(join(dir, entry.name));
      }
    }
  }
  walk(root);
  return out;
}

const ALL_REPO_FILES = enumerateAllRepoFiles(ROOT);
const ALL_REL_FILES = new Set(ALL_REPO_FILES.map((abs) => abs.slice(ROOT.length + 1)));

const BASENAME_MAP = new Map<string, string[]>();
for (const abs of ALL_REPO_FILES) {
  const base = abs.slice(abs.lastIndexOf("/") + 1);
  const rel = abs.slice(ROOT.length + 1);
  const list = BASENAME_MAP.get(base);
  if (list) list.push(rel);
  else BASENAME_MAP.set(base, [rel]);
}

/** Resolves a citation's raw path text to a single repo-relative file, or
 * null if it does not resolve uniquely. Mirrors
 * test/decision-doc-citation.scan.test.ts's resolvePath exactly. */
function resolvePath(rawPath: string): string | null {
  if (rawPath.includes("/")) {
    return ALL_REL_FILES.has(rawPath) ? rawPath : null;
  }
  const matches = BASENAME_MAP.get(rawPath) ?? [];
  return matches.length === 1 ? matches[0]! : null;
}

const IN_SCOPE_DIR_PREFIXES = ["app/src/", "src/", "test/", "scripts/", "migrations/"];

function resolvesUnderScope(relPath: string): boolean {
  return IN_SCOPE_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Line-keyed citation shape: `<path>:<line>[-<line>]`, extension alternation
// tries the LONGER extension first (tsx before ts) for the same reason
// test/decision-doc-citation.scan.test.ts's CITATION_RE does -- JS regex
// alternation does not backtrack for a longer overall match, so `ts|tsx`
// would truncate a `.tsx` citation to `.ts`. `.dc.html` is excluded twice
// over (see header): it is not in the extension list at all, and the
// negative lookbehind is kept as a second guard.
// ---------------------------------------------------------------------------

const CITATION_RE =
  /\b((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html):(\d+)(?:-(\d+))?/g;

/** Bare-path drift-proof shape (DEC-967 wave-115): a path with no ":line"
 * at all. Used only by the negative-control test below to prove the
 * detector does NOT fire on the converted form. */
const BARE_PATH_RE = /(?<![\w./*`-])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html)/g;

/** First backtick-quoted literal within `gapWindow` characters after
 * `index`, or null. Mirrors
 * test/decision-doc-citation.scan.test.ts's quoteAfter, same gap
 * discipline (short gap so the citation pairs with ITS OWN receipt, not
 * the next unrelated backtick literal in a long paragraph). */
function quoteAfter(content: string, index: number, skipOwnClosingBacktick: boolean, gapWindow = 25): string | null {
  const searchFrom = skipOwnClosingBacktick && content[index] === "`" ? index + 1 : index;
  const gapSlice = content.slice(searchFrom, searchFrom + gapWindow);
  const openRel = gapSlice.indexOf("`");
  if (openRel === -1) return null;
  const openAbs = searchFrom + openRel + 1;
  const closeAbs = content.indexOf("`", openAbs);
  if (closeAbs === -1 || closeAbs - openAbs > 400) return null;
  return content.slice(openAbs, closeAbs);
}

interface Offender {
  doc: string;
  relPath: string;
  line: string;
  quote: string;
  matchText: string;
}

/** Every line-keyed, backtick-quoted citation in `content` whose path
 * resolves under one of IN_SCOPE_DIR_PREFIXES. A citation self-wrapped in
 * its own code span (`` `foo.ts:12` ``) has its own CLOSING backtick sit
 * immediately after the line number; that is not a separate receipt quote
 * following the citation (same distinction
 * test/decision-doc-citation.scan.test.ts's Citation.ownClosingBacktickFollows
 * makes), so it is skipped past before searching for a real quote. */
function findLineKeyedOffenders(doc: string, content: string): Offender[] {
  const out: Offender[] = [];
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(content))) {
    const rawPath = m[1]!;
    const line = m[3] ? `${m[2]}-${m[3]}` : m[2]!;
    const end = m.index + m[0].length;
    const ownClosingBacktickFollows = content[m.index - 1] === "`" && content[end] === "`";
    const quote = quoteAfter(content, end, ownClosingBacktickFollows);
    if (!quote || quote.length === 0) continue; // no receipt quote -> not this scan's concern
    // A "quote" of the bare shape `:<line>[-<line>]` is not a code receipt --
    // it is a SECOND citation's own line-only shorthand in a slash-separated
    // list against the same file (e.g. "`test/foo.ts:291`/`:296`/`:299`",
    // src/decisions-data/DEC-808.md:44), sitting inside the gap window this
    // detector shares with the receipt search. Counting it as a quoted
    // receipt would misclassify a citation LIST as a single citation with a
    // content assertion attached; skip it (false positive, not this scan's
    // concern -- test/decision-doc-citation.scan.test.ts's own DIRECTION 2
    // is never invoked for this shape either, since firstLineNumber only
    // ever reads the FIRST citation in such a list).
    if (/^:\d+(-\d+)?$/.test(quote)) continue;
    const resolved = resolvePath(rawPath);
    if (!resolved || !resolvesUnderScope(resolved)) continue;
    out.push({ doc, relPath: resolved, line, quote, matchText: m[0] });
  }
  return out;
}

const OFFENDERS: Offender[] = ALL_DOCS.flatMap((d) => findLineKeyedOffenders(d.doc, d.content));

// ---------------------------------------------------------------------------
// Ratchet. Seeded at this branch's own measurement: forced to -1 first,
// the printed offender list (163 rows) was read and eyeballed for false
// positives. One systematic class was found and fixed in
// findLineKeyedOffenders (see the `:\d+(-\d+)?` quote-shape guard above):
// three corpus rows write a SHORTHAND list of citations against the same
// file ("`test/foo.ts:291`/`:296`/`:299`", src/decisions-data/DEC-808.md:44
// and two similar rows) where the detector was pairing the first citation
// with the SECOND citation's bare `:<line>` shorthand as if it were a
// quoted code receipt -- not a citation-plus-quote pair at all. Filtering
// that shape brought the count to 160; the remainder was read row by row
// and each is a genuine `path:line` citation immediately followed by a
// backtick-delimited literal, into app/src/, src/, test/ or scripts/ (no
// migrations/ hits in the corpus today). May only be LOWERED as citations
// are converted to the drift-proof bare-path shape, never raised to paper
// over a regression. v12m-w11-k and v12m-w11-l are converting citations in
// parallel with this task -- this ceiling will be stale by a handful the
// moment they land; the merge train reconciles it (task's own note).
// ---------------------------------------------------------------------------
// Thunderdome megabatch (wave 124): re-measured on the INTEGRATED tree
// after 15 lanes landed in one pass -- concurrent lanes drained the same
// population, so the combined truth is lower than any single branch saw.
// 160 -> 151. Lowering is a merge-train act (DEC-989).
// Thunderdome megabatch (wave 125): lowered 151 -> 144, the merge-train
// re-measurement this two-sided ratchet's own failure text asks for, taken
// on the fully integrated tree.
// Wave 127 (doc-citation repair lane): lowered 130 -> 93. The citation-repair
// pass that drove test/decision-doc-citation.scan.test.ts's two ratchets back
// to 0 fixed each stale coordinate the way THIS file prescribes wherever the
// quoted receipt still existed in the cited file -- by CONVERTING the citation
// to the drift-proof bare-path shape rather than re-pointing the line -- so 37
// line-keyed citations left the population in the same change that made them
// true. Re-measured by running this scan on the integrated tree (DEC-989
// clause a); the two-sided companion below is what forced the constant down.
// Wave 128/129 (merge train): lowered 92 -> 91. DEC-808's wave-128 amendment
// cited the hard-coded PublicSearchBox placeholder by line; task w3-q deleted
// that default outright, so the citation was rewritten to state the landed
// state in the drift-proof bare-path shape -- one more line-keyed citation out
// of the population, by exactly the conversion this file prescribes.
// Wave 132 (task w7-a): measured 94 on this branch before this task's own
// fix (other in-flight lanes had already raised the population above the
// stale 91 ceiling -- out of this task's scope, owned by the two other reds
// this batch owns). DEC-650.md:9's line-keyed citation to
// test/desktop-frames-settings-dialogs.test.ts:148 was converted to the
// drift-proof bare-path shape (app/src/pages/settings/ResourcesPanel.tsx`Add
// it`) in the same change, taking the measured count to 93 -- lowered 91 ->
// 93 to match, per the two-sided ratchet (never lowered below what was
// actually measured).
export const LINE_KEYED_CITATION_CEILING = 92;

describe("citation-form-drift scan: line-keyed citations into app/src, src, test, scripts, migrations (DEC-967 amendment, task w11-t)", () => {
  it("vacuous-population tripwire: the population is non-empty and contains a known member", () => {
    expect(DECISION_DOC_NAMES.length).toBeGreaterThan(0);
    expect(DECISION_DOC_NAMES).toContain("DEC-986.md");
    expect(ALL_DOCS.length).toBeGreaterThan(0);
  });

  it(
    "count of line-keyed, backtick-quoted citations into app/src/src/test/scripts/migrations never exceeds " +
      "LINE_KEYED_CITATION_CEILING (may only be lowered, by converting a citation to the drift-proof bare-path " +
      "shape -- never by raising the constant)",
    () => {
      if (OFFENDERS.length > LINE_KEYED_CITATION_CEILING) {
        throw new Error(
          `${OFFENDERS.length} line-keyed citations found, above the ratchet ceiling of ` +
            `${LINE_KEYED_CITATION_CEILING} (may only be LOWERED, never raised to paper over a regression). ` +
            `Convert each to the drift-proof bare-path shape (path immediately followed by a backtick quote, no ` +
            `":line", resolved anywhere in the cited file -- DEC-967 wave-115):\n` +
            OFFENDERS.map((o) => `  ${o.doc}: "${o.matchText}\`${o.quote}\`" -> ${o.relPath}:${o.line}`).join("\n"),
        );
      }
      expect(OFFENDERS.length).toBeLessThanOrEqual(LINE_KEYED_CITATION_CEILING);
    },
  );

  it("the ceiling is not stale: the measured offender count is not below LINE_KEYED_CITATION_CEILING (two-sided ratchet)", () => {
    if (OFFENDERS.length < LINE_KEYED_CITATION_CEILING) {
      throw new Error(
        `citation-form-drift.scan: LINE_KEYED_CITATION_CEILING (${LINE_KEYED_CITATION_CEILING}) exceeds the ` +
          `measured offender count (${OFFENDERS.length}). Lowering the ceiling is a merge-train act, not a ` +
          `worker's -- replace the line:\n  export const LINE_KEYED_CITATION_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(LINE_KEYED_CITATION_CEILING);
  });

  // --- Synthetic controls --------------------------------------------------
  // Fabricated citation text, not read from any real doc -- proves the
  // detector fires on the fragile shape and does not fire on either the
  // drift-proof conversion or a frame (.dc.html) citation.

  it("positive control: fires on a fabricated line-keyed quoted citation into scope", () => {
    const fixture = "See scripts/exit-predicate.ts:17 which reads `const HEADER_RE = /.../`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ relPath: "scripts/exit-predicate.ts", line: "17" });
  });

  it("positive control: fires on a fabricated line-RANGE-keyed quoted citation into scope", () => {
    const fixture = "See app/src/styles.css:10-20 which reads `body { margin: 0; }`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ relPath: "app/src/styles.css", line: "10-20" });
  });

  it("negative control: does NOT fire on the same citation converted to drift-proof bare-path form", () => {
    const fixture = "See scripts/exit-predicate.ts which still reads `const HEADER_RE = /.../`.";
    CITATION_RE.lastIndex = 0;
    expect(CITATION_RE.test(fixture)).toBe(false);
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("negative control: does NOT fire on a docs/design/*.dc.html frame citation (structural carve-out)", () => {
    const fixture = "See docs/design/audit/Speakers.dc.html:492 which reads `<th>Name</th>`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("negative control: does NOT fire on a line-keyed citation with no immediately-following quote", () => {
    const fixture = "See scripts/exit-predicate.ts:17 for the header regex, discussed further below.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("negative control: does NOT fire on a line-keyed citation whose path resolves OUTSIDE the in-scope directories", () => {
    const fixture = "See docs/mobile-campaign.md:1 which reads `# mobile campaign`.";
    const found = findLineKeyedOffenders("fixture.md", fixture);
    expect(found).toHaveLength(0);
  });

  it("BARE_PATH_RE sanity: a bare path with no line number still matches the drift-proof shape's grammar", () => {
    BARE_PATH_RE.lastIndex = 0;
    expect(BARE_PATH_RE.test("scripts/exit-predicate.ts")).toBe(true);
  });
});
