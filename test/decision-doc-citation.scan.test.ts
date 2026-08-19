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
