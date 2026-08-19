// Decision-registry citation contract (DEC-976 wave-106 amendment, task
// w2-j). The user filed an INTEGRITY item into docs/mobile-campaign.md
// ('Eval root-cause round, 2026-08-19 evening', clause c): the decision
// registry -- the one artefact every other document defers to -- sat
// OUTSIDE every citation scan's population, and a scribe wave wrote a
// completed-work narrative into DEC-986.md that does not match the tree.
// This file puts src/decisions-data/*.md inside the population, mirroring
// app/src/frame-citation.scan.test.ts's two-directional citation contract
// (a path:line citation must resolve; a backtick-quoted literal that
// immediately follows it must appear verbatim at that line) rather than
// inventing a third vocabulary for the same shape (field guide DEC-613:
// "a second copy of a citation vocabulary is a trap with a delay fuse").
//
// SCOPE NOTE (narrowest reasonable reading, flagged per this task's own
// instruction): this file's citation grammar covers only citations to
// CODE and DOC files inside the repo tree -- extensions .ts/.tsx/.css/.md
// -- the forms the task itself names as examples (cfp.css.ts:253,
// src/views/form-render.tsx:278, app/src/styles.css:2182-2261,
// submit-views.tsx:202-204). It deliberately EXCLUDES
// `docs/design/*.dc.html:<line>` frame citations, which decisions-data
// prose already cites constantly but in a DIFFERENT, incompatible quoting
// convention -- straight double-quoted paraphrase ("padding alone does not
// reach the floor...") far more often than an immediately-following
// backtick literal, the exact shape app/src/frame-citation.scan.test.ts's
// STRICT_RE/quoteAfter pairing was built to check. Folding .dc.html
// citations into this file's population would require a second, separate
// grammar and produce a wall of false positives on quoting style, not on
// truth -- out of this task's stated scope (a NEW scan plus doc
// corrections, not a frame-citation grammar rewrite). A citation is only
// checked against this file's DIRECTION 2 when a backtick literal
// immediately follows it (same rule as frame-citation.scan): a citation
// whose supporting text uses straight quotes, or whose quote precedes
// rather than follows the citation (e.g. "Track radios carry `required`
// on all N, submit-views.tsx:202-204"), is resolved for existence only
// (DIRECTION 1), never guessed at for DIRECTION 2.
//
// This file is DISTINCT from test/decision-path-references.scan.test.ts,
// which scans the OLDER, unrelated `decisions/` directory (1000 files,
// disjoint DEC numbering from src/decisions-data/'s ~35) for bare path
// existence only, with no line-number or quote check -- different
// population, different directory, different assertion depth. Reusing its
// name or its regex here would be the DEC-613 trap in the other direction
// (silently believing an unrelated scan already covers this ground); it
// does not.
//
// PROSE-ONLY CLAIMS ARE NOT CHECKED HERE (task-required note): a false
// claim written as plain prose with no `path:line` citation attached is
// invisible to any scan built from a citation grammar -- there is nothing
// to resolve. Per this task's instruction, all seven scribe-wave-10/11
// docs (DEC-727, DEC-986, DEC-991, DEC-383, DEC-613, DEC-681, DEC-808)
// were additionally read by hand; the material finding from that hand
// read (DEC-986's "Fixed (1)/(2)" narrative describing work that has not
// landed on main) is corrected in the document itself, not encoded as a
// new scan rule -- a scan cannot tell a completed act from a promised one
// in prose with no citation to check it against.
import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const DECISIONS_DATA_DIR = join(ROOT, "src", "decisions-data");

/** Every DEC-*.md file directly under src/decisions-data/, enumerated by
 * readdirSync -- never a hand-listed manifest (DEC-808: "a directory is
 * not a population" cuts the other way too -- you must actually read the
 * directory, not assume its shape from a prior wave's count). */
function decisionDocFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^DEC-\d+\.md$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

// Extension alternation tries the LONGER extension first (tsx before ts) --
// JS regex alternation does not backtrack for a longer overall match, so
// `ts|tsx` would truncate every `.tsx` citation to `.ts` and misreport its
// line count against the wrong-length file (the exact bug
// test/decision-path-references.scan.test.ts's own header documents
// hitting while it was built).
const CITATION_RE =
  /\b((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html):(\d+)((?:[-,/]\d+)*)/g;

interface Citation {
  /** The decision doc file carrying the citation (e.g. "DEC-986.md"), or
   * a synthetic label for a fixture used by the negative-control tests. */
  doc: string;
  /** The raw path/basename text as written in the doc. */
  rawPath: string;
  /** First line number the citation names. */
  firstLine: number;
  /** Full matched citation text, for failure messages. */
  matchText: string;
  /** Index in `content` immediately after the citation, where a backtick
   * quote is checked for. */
  index: number;
  /** True when the character immediately BEFORE the citation's own start
   * is a backtick -- i.e. the citation itself is written as a markdown
   * code span, `` `path:line` `` (common in these docs). In that case the
   * character immediately after `index` is that code span's own CLOSING
   * backtick, not the opening delimiter of a receipt quote, and
   * quoteAfter must skip past it before searching. */
  ownClosingBacktickFollows: boolean;
}

function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

function findCitations(doc: string, content: string): Citation[] {
  const out: Citation[] = [];
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(content))) {
    const end = m.index + m[0].length;
    out.push({
      doc,
      rawPath: m[1]!,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
      index: end,
      ownClosingBacktickFollows: content[m.index - 1] === "`" && content[end] === "`",
    });
  }
  return out;
}

/** The first backtick-quoted literal within `window` characters after a
 * citation's end, or null if none is found there -- mirrors
 * app/src/frame-citation.scan.test.ts's quoteAfter, same window
 * discipline: immediately-following only, not "somewhere later in this
 * giant paragraph" (these decision paragraphs run to 1000+ characters on
 * one physical line and often carry several unrelated backtick quotes). */
function quoteAfter(
  content: string,
  index: number,
  skipOwnClosingBacktick: boolean,
  gapWindow = 25,
  maxQuoteLen = 400,
): string | null {
  // A citation written as a markdown code span (`` `path:line` ``) has its
  // own closing backtick sitting immediately at `index`; that backtick
  // terminates the citation's OWN span, it is not the opening delimiter
  // of a receipt quote, so skip exactly one character past it before
  // searching (see Citation.ownClosingBacktickFollows).
  const searchFrom = skipOwnClosingBacktick && content[index] === "`" ? index + 1 : index;
  const gapSlice = content.slice(searchFrom, searchFrom + gapWindow);
  const openRel = gapSlice.indexOf("`");
  if (openRel === -1) return null;
  const openAbs = searchFrom + openRel + 1;
  const closeAbs = content.indexOf("`", openAbs);
  if (closeAbs === -1 || closeAbs - openAbs > maxQuoteLen) return null;
  return content.slice(openAbs, closeAbs).replace(/\\/g, "");
}

// The GAP before the opening backtick is intentionally SHORT (25 chars,
// not frame-citation's flat 400-char window): these decision paragraphs
// run 1000+ characters on one physical line and routinely carry several
// backtick quotes unrelated to any nearby citation (a constant name, a
// CSS declaration quoted for a different point). Measured while building
// this scan: every genuine citation-then-receipt pairing in the corpus
// (the ones this task's own verification confirmed true, e.g.
// "cfp-steps-script.tsx:33 still reads `setStep('2')`") sits within about
// 15 characters of connective tissue ("hides", "declares", "called",
// "still reads"); a wide gap instead pairs a citation with the NEXT
// unrelated backtick literal anywhere in the paragraph and manufactures
// false mismatches. Once a quote's OPENING backtick is found within the
// short gap, the quote's own LENGTH is allowed to run up to 400 chars
// (some receipted CSS declarations are long) -- gap discipline and quote
// length are two different limits, conflating them into one window either
// truncates a long real quote or lets the gap run too wide.

function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Every file in the repo (excluding node_modules/.git/dist-like build
 * output), enumerated once via readdirSync recursion -- basis for
 * resolving a bare-basename citation (e.g. "profile.tsx:153",
 * "cfp.css.ts:253") to a unique repo-relative path. */
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

const BASENAME_MAP = new Map<string, string[]>();
for (const abs of ALL_REPO_FILES) {
  const base = abs.slice(abs.lastIndexOf("/") + 1);
  const rel = abs.slice(ROOT.length + 1);
  const list = BASENAME_MAP.get(base);
  if (list) list.push(rel);
  else BASENAME_MAP.set(base, [rel]);
}

interface Resolution {
  ok: boolean;
  /** Repo-relative path resolved to, if ok. */
  relPath?: string;
  /** Human-readable reason when not ok: "missing" or "ambiguous: a, b". */
  reason?: string;
}

/** Resolves a citation's raw path text to a single repo-relative file.
 * A path containing "/" is treated as already repo-relative (this
 * codebase's convention throughout decisions-data: every slash-bearing
 * citation names a path from the repo root, e.g. "src/views/form-render.tsx",
 * "app/src/pages/content/UploadZone.tsx", "docs/design/audit/foo.md" --
 * never a path relative to some other root). A bare basename with no "/"
 * is resolved against BASENAME_MAP: exactly one match resolves, zero or
 * more than one is reported as a violation rather than guessed at. */
function resolvePath(rawPath: string, repoRoot: string, allFiles: Set<string>, basenameMap: Map<string, string[]>): Resolution {
  if (rawPath.includes("/")) {
    if (allFiles.has(rawPath)) return { ok: true, relPath: rawPath };
    return { ok: false, reason: "missing (no such repo-relative path)" };
  }
  const matches = basenameMap.get(rawPath) ?? [];
  if (matches.length === 1) return { ok: true, relPath: matches[0] };
  if (matches.length === 0) return { ok: false, reason: "missing (no file with this basename anywhere in the repo)" };
  return { ok: false, reason: `ambiguous: ${matches.join(", ")}` };
}

const ALL_REL_FILES = new Set(ALL_REPO_FILES.map((abs) => abs.slice(ROOT.length + 1)));

interface Violation {
  message: string;
}

/** Runs both citation directions over one (doc, content) pair, returning
 * every violation found. Shared by the real population and the
 * negative-control fixtures so both exercise the identical logic
 * (DEC-613: one implementation, not a scan copy and a fixture copy that
 * quietly diverge). */
function checkCitations(doc: string, content: string): Violation[] {
  const violations: Violation[] = [];
  for (const c of findCitations(doc, content)) {
    const resolved = resolvePath(c.rawPath, ROOT, ALL_REL_FILES, BASENAME_MAP);
    if (!resolved.ok) {
      violations.push({
        message: `${c.doc}: "${c.matchText}" does not resolve -- ${resolved.reason}`,
      });
      continue;
    }
    const targetAbs = join(ROOT, resolved.relPath!);
    const targetLines = readFileSync(targetAbs, "utf-8").split("\n");
    if (c.firstLine > targetLines.length) {
      violations.push({
        message: `${c.doc}: "${c.matchText}" cites line ${c.firstLine} of ${resolved.relPath}, which has only ${targetLines.length} lines`,
      });
      continue;
    }
    const quote = quoteAfter(content, c.index, c.ownClosingBacktickFollows);
    if (!quote || quote.length === 0) continue; // no immediately-following backtick claim to check (see header)
    const targetLine = targetLines[c.firstLine - 1] ?? "";
    if (!normalise(targetLine).includes(normalise(quote))) {
      violations.push({
        message:
          `${c.doc}: quote \`${quote}\` following "${c.matchText}" does not appear verbatim at ` +
          `${resolved.relPath}:${c.firstLine} (that line reads: "${targetLine.trim()}")`,
      });
    }
  }
  return violations;
}

const DECISION_DOC_NAMES = decisionDocFiles(DECISIONS_DATA_DIR);
const DECISION_DOC_CONTENTS = new Map<string, string>(
  DECISION_DOC_NAMES.map((name) => [name, readFileSync(join(DECISIONS_DATA_DIR, name), "utf-8")]),
);

const ALL_VIOLATIONS: Violation[] = DECISION_DOC_NAMES.flatMap((name) =>
  checkCitations(name, DECISION_DOC_CONTENTS.get(name)!),
);

// Ratchet (DEC-976 wave-106 amendment, DEC-808 wave-106 two-sided-ratchet
// rule): this is a TO-DO LIST, not a licence. Seeded at the count measured
// on this branch AFTER the DEC-986 correction landed (see step 2 of this
// task) -- it may only be LOWERED as further drift gets fixed, never
// raised to paper over a regression, and a companion test below fails the
// moment the true count drops below the ceiling so the constant is
// re-tightened in the same change that fixes an offender, not left stale.
export const UNRESOLVED_CITATION_CEILING = 30;

// The 30 measured on this branch are a MIX, not a uniform class -- future
// lanes spending this ceiling down should expect two different repairs:
//   (a) genuine stale line-number drift (a doc's citation pointed at the
//       right declaration when written, a later edit moved it -- the
//       DEC-986/DEC-383 pattern this task fixed two instances of: correct
//       the line number, the underlying claim is still true) -- and
//   (b) this scan's own heuristic limits surfacing as noise rather than a
//       real document defect: a citation whose "receipt" is a MULTI-LINE
//       quote checked only against its FIRST cited line (this file, like
//       frame-citation.scan.test.ts, only ever checks firstLine); a
//       citation sitting inside a prose LIST of several file:line
//       pointers where the nearest backtick literal after it is a later
//       sentence's general remark, not that specific citation's receipt;
//       and a quote that is a deliberate elision paraphrase (literal
//       "..." standing in for an interpolated runtime value, e.g.
//       `wrap.querySelector('[data-field-id="..."]')` against source that
//       actually interpolates `r.fieldId`) rather than a false claim.
// A lane fixing an item here must re-read the cited file by hand first
// (this file's own instruction: correct the document, never widen a
// quote-matching heuristic to swallow a real defect) and lower the
// ceiling only for what it actually fixed.

// VERIFICATION NOTE (DEC-967 wave-107 doc-integrity lens, task w3-u,
// mandate step 1, second claim): docs/mobile-campaign.md's "Citation
// corrections for the doc-integrity lens" section also claims DEC-302 is
// miscited for flag-not-block scheduling. Grepped the whole tree
// (app/**, src/**, test/**, docs/**, decisions/**) for every "DEC-302"
// occurrence: all of them are inside docs/verification-log/**
// build-test reports or decisions/DEC-308.md, and every single one is a
// correct npm-audit dev-dependency-advisory citation ("Per DEC-302, these
// are recorded findings, not open items" and equivalents) -- exactly what
// decisions/DEC-302.md itself declares ("dev-dependency-only advisories
// are accepted for stage 1 and must be recorded, not waved off"). This
// claim does NOT hold; no sweep is needed or performed for it, per the
// task's own instruction not to invent one.
//
// ---------------------------------------------------------------------------
// WIDENED POPULATION (DEC-967 wave-107 doc-integrity lens, task w3-u): the
// campaign's own authority documents -- docs/design/audit/*.md,
// docs/design/DEVIATIONS.md, docs/design/DESIGN-RULINGS.md and
// docs/mobile-campaign.md -- get the SAME two-directional grammar
// (findCitations/resolvePath/quoteAfter/checkCitations) as
// src/decisions-data/*.md above. Not a second grammar (DEC-613): every
// helper function is reused verbatim, only the file population differs.
// Kept as a SEPARATE describe block / ratchet from the decisions-data one
// above rather than merged into it, so this task's widening cannot
// disturb the already-tuned UNRESOLVED_CITATION_CEILING=30 exactness
// this file shipped with; the walk itself is still literally "the same
// walk" -- same functions, same two directions, only a longer file list.
// ---------------------------------------------------------------------------

const AUDIT_DIR = join(ROOT, "docs", "design", "audit");

function auditDocFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

const AUDIT_DOC_NAMES = auditDocFiles(AUDIT_DIR);
const AUDIT_ENTRIES: [string, string][] = AUDIT_DOC_NAMES.map((name) => [
  `docs/design/audit/${name}`,
  readFileSync(join(AUDIT_DIR, name), "utf-8"),
]);

const DEVIATIONS_ENTRY: [string, string] = [
  "docs/design/DEVIATIONS.md",
  readFileSync(join(ROOT, "docs", "design", "DEVIATIONS.md"), "utf-8"),
];
const DESIGN_RULINGS_ENTRY: [string, string] = [
  "docs/design/DESIGN-RULINGS.md",
  readFileSync(join(ROOT, "docs", "design", "DESIGN-RULINGS.md"), "utf-8"),
];
const MOBILE_CAMPAIGN_ENTRY: [string, string] = [
  "docs/mobile-campaign.md",
  readFileSync(join(ROOT, "docs", "mobile-campaign.md"), "utf-8"),
];

/** One source class = one label plus the (doc, content) pairs it
 * contributes to the walk. Each class gets its own vacuous-population
 * tripwire below (the task's explicit requirement: a widened population
 * that silently contributes zero checked citations from one of its four
 * new classes would be indistinguishable from a class that was never
 * added). */
const WIDENED_SOURCE_CLASSES: { label: string; entries: [string, string][] }[] = [
  { label: "docs/design/audit/*.md", entries: AUDIT_ENTRIES },
  { label: "docs/design/DEVIATIONS.md", entries: [DEVIATIONS_ENTRY] },
  { label: "docs/design/DESIGN-RULINGS.md", entries: [DESIGN_RULINGS_ENTRY] },
  { label: "docs/mobile-campaign.md", entries: [MOBILE_CAMPAIGN_ENTRY] },
];

/** Citations that DIRECTION 1 resolved (real file, in-range line) -- the
 * "checked citation" the per-class tripwire counts. A citation that fails
 * to resolve at all is a violation, not a "checked citation" (it never
 * reached a state where DIRECTION 2 could apply), matching this file's
 * existing checkCitations control flow (a `continue` right after the
 * resolve-failure push). */
function countResolved(entries: [string, string][]): number {
  let n = 0;
  for (const [doc, content] of entries) {
    for (const c of findCitations(doc, content)) {
      const resolved = resolvePath(c.rawPath, ROOT, ALL_REL_FILES, BASENAME_MAP);
      if (!resolved.ok) continue;
      const targetLines = readFileSync(join(ROOT, resolved.relPath!), "utf-8").split("\n");
      if (c.firstLine > targetLines.length) continue;
      n++;
    }
  }
  return n;
}

const WIDENED_VIOLATIONS: Violation[] = WIDENED_SOURCE_CLASSES.flatMap(({ entries }) =>
  entries.flatMap(([doc, content]) => checkCitations(doc, content)),
);

// Ratchet (DEC-967 wave-107, DEC-808 wave-106 two-sided-ratchet rule):
// seeded at the count this scan itself measured on this branch (never
// inherited from the task's own calibration prose, which is a rough
// figure for a different, narrower slice -- "resolvable" citations under
// DIRECTION 1 only, not this ceiling's DIRECTION-1-plus-DIRECTION-2
// violation count). May only be LOWERED as the four new classes' drift
// gets fixed, never raised to paper over a regression.
export const WIDENED_UNRESOLVED_CITATION_CEILING = 42;

describe("widened citation scan: campaign authority documents (DEC-967 wave-107 doc-integrity lens)", () => {
  it.each(WIDENED_SOURCE_CLASSES)(
    "vacuous-population tripwire: $label contributes at least one checked (DIRECTION-1-resolved) citation",
    ({ entries }) => {
      expect(countResolved(entries)).toBeGreaterThan(0);
    },
  );

  it(`every citation in the widened population resolves to a real file/line and, where a backtick quote immediately follows, matches it verbatim (ceiling: WIDENED_UNRESOLVED_CITATION_CEILING, may only be lowered)`, () => {
    if (WIDENED_VIOLATIONS.length > WIDENED_UNRESOLVED_CITATION_CEILING) {
      throw new Error(
        `${WIDENED_VIOLATIONS.length} widened-population citations are unresolved, above the ratchet ceiling of ` +
          `${WIDENED_UNRESOLVED_CITATION_CEILING} (may only be LOWERED, never raised to paper over a regression):\n` +
          WIDENED_VIOLATIONS.map((v) => v.message).join("\n"),
      );
    }
    expect(WIDENED_VIOLATIONS.length).toBeLessThanOrEqual(WIDENED_UNRESOLVED_CITATION_CEILING);
  });

  it("the ceiling is not stale: the measured violation count is not below WIDENED_UNRESOLVED_CITATION_CEILING (two-sided ratchet, DEC-808 wave-106 amendment)", () => {
    if (WIDENED_VIOLATIONS.length < WIDENED_UNRESOLVED_CITATION_CEILING) {
      throw new Error(
        `measured ${WIDENED_VIOLATIONS.length} unresolved widened-population citations, below the declared ` +
          `ceiling of ${WIDENED_UNRESOLVED_CITATION_CEILING} -- lower the constant: ` +
          `export const WIDENED_UNRESOLVED_CITATION_CEILING = ${WIDENED_VIOLATIONS.length};`,
      );
    }
    expect(WIDENED_VIOLATIONS.length).toBeGreaterThanOrEqual(WIDENED_UNRESOLVED_CITATION_CEILING);
  });
});

describe("decision-registry citation scan (DEC-976 wave-106 amendment, task w2-j)", () => {
  it("vacuous-population tripwire: finds decision docs, including the known member DEC-986.md", () => {
    expect(DECISION_DOC_NAMES.length).toBeGreaterThan(0);
    expect(DECISION_DOC_NAMES).toContain("DEC-986.md");
  });

  it("citation population sanity: finds at least one path:line citation (a broken regex must not pass vacuously)", () => {
    const total = DECISION_DOC_NAMES.reduce(
      (n, name) => n + findCitations(name, DECISION_DOC_CONTENTS.get(name)!).length,
      0,
    );
    expect(total).toBeGreaterThan(50);
  });

  it(`every citation in src/decisions-data/DEC-*.md resolves to a real file/line and, where a backtick quote immediately follows, matches it verbatim (ceiling: UNRESOLVED_CITATION_CEILING, may only be lowered)`, () => {
    if (ALL_VIOLATIONS.length > UNRESOLVED_CITATION_CEILING) {
      throw new Error(
        `${ALL_VIOLATIONS.length} decision-doc citations are unresolved, above the ratchet ceiling of ` +
          `${UNRESOLVED_CITATION_CEILING} (may only be LOWERED, never raised to paper over a regression):\n` +
          ALL_VIOLATIONS.map((v) => v.message).join("\n"),
      );
    }
    expect(ALL_VIOLATIONS.length).toBeLessThanOrEqual(UNRESOLVED_CITATION_CEILING);
  });

  it("the ceiling is not stale: the measured violation count is not below UNRESOLVED_CITATION_CEILING (two-sided ratchet, DEC-808 wave-106 amendment)", () => {
    if (ALL_VIOLATIONS.length < UNRESOLVED_CITATION_CEILING) {
      throw new Error(
        `measured ${ALL_VIOLATIONS.length} unresolved citations, below the declared ceiling of ` +
          `${UNRESOLVED_CITATION_CEILING} -- lower the constant: ` +
          `export const UNRESOLVED_CITATION_CEILING = ${ALL_VIOLATIONS.length};`,
      );
    }
    expect(ALL_VIOLATIONS.length).toBeGreaterThanOrEqual(UNRESOLVED_CITATION_CEILING);
  });
});

// ---------------------------------------------------------------------------
// Negative controls (house rule: every scan ships one). A temp directory
// stands in for "the repo", carrying one real cited source file, so all
// three controls run through the exact same findCitations/resolvePath/
// quoteAfter/checkCitations logic the population test above uses --  never
// a hand-simulated duplicate of the resolution logic.
// ---------------------------------------------------------------------------

describe("negative controls", () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), "decision-doc-citation-fixture-"));
  const citedRelPath = "fixture-cited.ts";
  const citedAbs = join(tmpRoot, citedRelPath);
  // 5 lines; line 3 carries the literal the "pass" and "bad quote" fixtures
  // reference.
  writeFileSync(citedAbs, "line one\nline two\nexport const FIXTURE_TOKEN = 42;\nline four\nline five");

  const allRelFiles = new Set([citedRelPath]);
  const basenameMap = new Map<string, string[]>([[citedRelPath, [citedRelPath]]]);

  function checkFixture(content: string): Violation[] {
    const violations: Violation[] = [];
    for (const c of findCitations("fixture.md", content)) {
      const resolved = resolvePath(c.rawPath, tmpRoot, allRelFiles, basenameMap);
      if (!resolved.ok) {
        violations.push({ message: `"${c.matchText}" does not resolve -- ${resolved.reason}` });
        continue;
      }
      const targetLines = readFileSync(join(tmpRoot, resolved.relPath!), "utf-8").split("\n");
      if (c.firstLine > targetLines.length) {
        violations.push({
          message: `"${c.matchText}" cites line ${c.firstLine}, which has only ${targetLines.length} lines`,
        });
        continue;
      }
      const quote = quoteAfter(content, c.index, c.ownClosingBacktickFollows);
      if (!quote) continue;
      const targetLine = targetLines[c.firstLine - 1] ?? "";
      if (!normalise(targetLine).includes(normalise(quote))) {
        violations.push({ message: `quote \`${quote}\` does not match line ${c.firstLine}` });
      }
    }
    return violations;
  }

  it("a citation whose line resolves and whose backtick quote matches verbatim passes", () => {
    const doc = "fixture-cited.ts:3 declares `export const FIXTURE_TOKEN = 42;` at the top level.";
    expect(checkFixture(doc)).toEqual([]);
  });

  it("a citation whose line number is past EOF is flagged", () => {
    const doc = "fixture-cited.ts:99 declares `export const FIXTURE_TOKEN = 42;` at the top level.";
    const violations = checkFixture(doc);
    expect(violations.length).toBe(1);
    expect(violations[0]!.message).toMatch(/has only 5 lines/);
  });

  it("a citation whose backtick literal is absent from the cited file's line is flagged", () => {
    const doc = "fixture-cited.ts:3 declares `export const NOT_REALLY_THERE = 1;` at the top level.";
    const violations = checkFixture(doc);
    expect(violations.length).toBe(1);
    expect(violations[0]!.message).toMatch(/does not match line 3/);
  });

  // Cleanup is a hook, not a test: it must run even when a control above
  // throws, and a test asserting nothing is a tautology (DEC-967 wave-57).
  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// PAIRING SENTINEL (DEC-967 wave-107 doc-integrity lens, task w3-u): the
// mandate's corrected-citation site (app/src/pages/comms/ComposeWizard.tsx
// and its selection.render.test.tsx sibling) cited DEC-919 -- a wave-105
// amendment about unreceipted PHONE HIDES -- for the bulk bar's
// always-mounted contract, which DEC-752 actually names. This sentinel
// keeps that specific miscitation from re-propagating: no CODE COMMENT
// under app/src/**, src/** or test/** may name "DEC-919" within a short
// line-window of bulk-bar vocabulary ("bulkbar", "bulk bar",
// "bulk-action bar", "always mounted").
//
// DELIBERATELY NOT a same-file or same-comment-block check: DEC-919's OWN
// legitimate citations sprawl across ~40-line comment blocks (e.g.
// app/src/phone-capability-removal.scan.test.ts's UNOWNED WORK ITEMS
// list, app/src/pages/submissions/submissions.css's phone-hide grammar
// notes) that happen to also mention an unrelated ".chq-bulkbar-actions"
// selector or "bulk-action bar" phrase ten-plus lines away in a different
// bullet -- those are not the miscitation pattern and must not trip this
// sentinel (a sentinel anchored on a real offender makes fixing that
// offender illegal, DEC-967 wave-103; the inverse failure mode -- a
// sentinel that also convicts everything ELSE that happens to share a
// file -- is just as illegal). A short window (3 lines) was chosen by
// measuring the actual miscitation (DEC-919 and "ALWAYS mounted" sat on
// adjacent comment lines in ComposeWizard.tsx before this task's fix) and
// verifying, at authoring time, that no other DEC-919 mention anywhere in
// the current tree sits within that window of any vocabulary term --
// this sentinel goes GREEN the moment step 1's fix lands, never before
// and never by accident (field-guide rule: a sentinel anchored on a live
// offender makes fixing that offender illegal).
const SENTINEL_SCAN_DIRS = ["app/src", "src", "test"];
const SENTINEL_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SENTINEL_WINDOW = 3;
const BULK_BAR_VOCAB_RE = /bulkbar|bulk bar|bulk-action bar|always mounted/i;
const DEC_919_RE = /DEC-919/;

/** Splits one file's text into its comment-only line contents (code lines
 * and the non-comment portion of mixed lines are dropped), preserving
 * 1-based line numbers -- covers both `//` line comments and `/* ... *\/`
 * block comments (CSS has only the latter; TS/TSX use both). Deliberately
 * NOT a full tokenizer (no string-literal awareness): a `//` or `/*`
 * appearing inside a string literal in this codebase's own source is not
 * a pattern seen anywhere in the population this sentinel walks, and
 * treating it as a comment opener in the rare case it occurred would only
 * make the sentinel MORE cautious (widen what counts as "in a comment"),
 * never blind to a real miscitation. */
function commentLines(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const lines = text.split("\n");
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    let piece = "";
    let rest = raw;
    if (inBlock) {
      const close = rest.indexOf("*/");
      if (close === -1) {
        piece += rest;
        rest = "";
      } else {
        piece += rest.slice(0, close);
        rest = rest.slice(close + 2);
        inBlock = false;
      }
    }
    // Scan the remainder of the line left-to-right for `//` or `/*`.
    while (rest.length > 0) {
      const lineIdx = rest.indexOf("//");
      const blockIdx = rest.indexOf("/*");
      if (lineIdx === -1 && blockIdx === -1) break;
      if (lineIdx !== -1 && (blockIdx === -1 || lineIdx < blockIdx)) {
        piece += rest.slice(lineIdx + 2);
        rest = "";
        break;
      }
      // blockIdx comes first (or is the only match)
      const close = rest.indexOf("*/", blockIdx + 2);
      if (close === -1) {
        piece += rest.slice(blockIdx + 2);
        inBlock = true;
        rest = "";
      } else {
        piece += rest.slice(blockIdx + 2, close);
        rest = rest.slice(close + 2);
      }
    }
    if (piece.length > 0) out.push({ line: i + 1, text: piece });
  }
  return out;
}

/** Every DEC-919 mention inside a comment that also carries bulk-bar
 * vocabulary within SENTINEL_WINDOW comment-bearing lines (in either
 * direction) -- the reusable core the population scan and the synthetic
 * positive control both exercise (DEC-613: one implementation). */
function findPairingViolations(fileLabel: string, text: string): string[] {
  const comments = commentLines(text);
  const decIdx = comments.filter((c) => DEC_919_RE.test(c.text));
  const vocabIdx = comments.filter((c) => BULK_BAR_VOCAB_RE.test(c.text));
  const out: string[] = [];
  for (const d of decIdx) {
    for (const v of vocabIdx) {
      if (Math.abs(d.line - v.line) <= SENTINEL_WINDOW) {
        out.push(
          `${fileLabel}: "DEC-919" (comment line ${d.line}) sits within ${SENTINEL_WINDOW} lines of ` +
            `bulk-bar vocabulary (comment line ${v.line}) -- re-cite to DEC-752/DEC-825, the actual bulk ` +
            `bar authority (DEC-919 is the wave-105 unreceipted-phone-hides amendment).`,
        );
      }
    }
  }
  return out;
}

function walkSourceFiles(root: string, relDirs: string[], extensions: Set<string>): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf(".");
        if (dot !== -1 && extensions.has(entry.name.slice(dot))) out.push(join(dir, entry.name));
      }
    }
  }
  for (const rel of relDirs) walk(join(root, rel));
  return out;
}

// This file itself is excluded from the walked population: it necessarily
// discusses the miscitation pattern in prose (this very header) and
// carries synthetic fixture strings that literally spell "// DEC-919 ..."
// as STRING CONTENT for the positive/negative controls below -- the
// sentinel's own naive `//`/`/* */` scanner (no string-literal awareness,
// documented above) would read those fixture strings as real comments and
// convict its own defining file. Excluding it is not weakening the
// contract: this file is the sentinel's specification, not app source
// that could re-propagate the miscitation into shipped behaviour.
const OWN_FILE = resolve(__dirname, "decision-doc-citation.scan.test.ts");

describe("pairing sentinel: DEC-919 must never re-propagate as the bulk-bar authority (DEC-967 wave-107)", () => {
  const SENTINEL_FILES = walkSourceFiles(ROOT, SENTINEL_SCAN_DIRS, SENTINEL_EXTENSIONS).filter(
    (abs) => abs !== OWN_FILE,
  );

  it("population sanity: the sentinel walks a non-trivial number of source files", () => {
    expect(SENTINEL_FILES.length).toBeGreaterThan(100);
  });

  it("no comment under app/src/**, src/** or test/** names DEC-919 within a short line-window of bulk-bar vocabulary", () => {
    const violations = SENTINEL_FILES.flatMap((abs) =>
      findPairingViolations(abs.slice(ROOT.length + 1), readFileSync(abs, "utf-8")),
    );
    if (violations.length > 0) {
      throw new Error(
        `${violations.length} comment(s) re-cite DEC-919 for bulk-bar behaviour (should be DEC-752/DEC-825):\n` +
          violations.join("\n"),
      );
    }
    expect(violations).toEqual([]);
  });

  // Synthetic positive control: the sentinel must actually be able to
  // fire, not just report zero because its own logic is inert (the same
  // house rule the negative-control block above documents).
  it("synthetic positive control: the detector fires on a fixture reproducing the original miscitation shape", () => {
    const fixture = [
      "// DEC-919 wave-96: the 2026-08-16 user ruling supersedes DEC-350",
      "// for every multi-select surface -- the selection bar is now",
      "// ALWAYS mounted below the filters and directly above the table.",
    ].join("\n");
    const violations = findPairingViolations("fixture.tsx", fixture);
    expect(violations.length).toBeGreaterThan(0);
  });

  // Negative control: a legitimate DEC-919 mention (phone-hide topic) far
  // from any bulk-bar vocabulary must not fire.
  it("negative control: a DEC-919 mention with no nearby bulk-bar vocabulary does not fire", () => {
    const fixture = [
      "// DEC-919 wave-7: the ColumnPicker is the one control legally",
      "// hidden at phone width once the table stacks into cards.",
    ].join("\n");
    expect(findPairingViolations("fixture.css", fixture)).toEqual([]);
  });

  // Negative control: DEC-919 and bulk-bar vocabulary both present in the
  // same file but far apart (the real shape seen in
  // phone-capability-removal.scan.test.ts and submissions.css) must not
  // fire -- the window is line-distance, not same-file co-occurrence.
  it("negative control: DEC-919 and bulk-bar vocabulary far apart in the same comment run do not fire", () => {
    const lines: string[] = ["// DEC-919 wave-106: gained their receipt this wave."];
    for (let i = 0; i < 10; i++) lines.push(`// unrelated bullet point number ${i}.`);
    lines.push("// the .chq-bulkbar-actions secondary action disappears at 390.");
    expect(findPairingViolations("fixture2.ts", lines.join("\n"))).toEqual([]);
  });
});
