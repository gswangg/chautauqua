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
// which scans the OLDER `decisions/` directory (999 DEC-NNN.md files plus
// README.md) for bare path existence only, with no line-number or quote
// check -- different population, different directory, different assertion
// depth. The numbering is NOT disjoint: every one of src/decisions-data/'s
// 77 ids also exists in decisions/, and 35 of those 77 pairs carry a
// DIFFERENT H1 title under the same id (a genuine collision, not two
// separate id spaces) -- see
// docs/design/audit/decision-registry-collision-v12.md and
// test/decision-registry-collision.scan.test.ts (DEC-976 wave-155, task
// w11-pd) for the measured counts and the campaign-governing subset's
// registry notes. Reusing decision-path-references.scan.test.ts's name or
// its regex here would be the DEC-613 trap in the other direction (silently
// believing an unrelated scan already covers this ground); it does not.
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
import { isExhibitCitation } from "./citation-grammar";

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
  /** Index in `content` where the matched citation text (the path's own
   * first captured character) begins -- the anchor isExhibitCitation
   * checks against, distinct from `index` below (the position AFTER the
   * citation, used for the receipt-quote search). */
  start: number;
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
      start: m.index,
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

// ---------------------------------------------------------------------------
// ADDITIVE drift-proof citation shape (DEC-967 wave-115, task w4-ab). This
// file has now had its OnboardingGrid.tsx citations repointed four
// consecutive waves running as the cited construct's line number kept
// moving underneath it -- a structural fix, not another repoint. A citation
// written as a BARE path (no ":line") IMMEDIATELY followed by a backtick
// quote resolves if that quote appears verbatim ANYWHERE in the cited file,
// rather than pinned to one line. This is strictly ADDITIVE: CITATION_RE
// and quoteAfter above are byte-for-byte unchanged, and a bare path with no
// immediately-following quote is not a citation at all (no new loophole --
// a pointer with no receipt still asserts nothing, same rule as DIRECTION 1
// for the strict shape).
// ---------------------------------------------------------------------------

// The negative lookbehind before the capturing group is load-bearing: these
// decision/audit docs are full of prose that ends in a real extension but
// is NOT a path (a `*.css.ts` filename glob, a bare `.ts` mentioned as an
// extension) or a path that is ITSELF wrapped in its own markdown code span
// (`` `app/src/styles.css` ``, a markdown-table cell). \b alone lets both
// slip through -- "." and "*" are non-word so \b still fires at the "c" of
// "css.ts" inside "*.css.ts", and a path's own opening backtick is not a
// word character either. Excluding [\w./*`-] immediately before the match
// start rules out both: a genuine drift-proof citation is bare prose text
// (no backtick, no glob-wildcard prefix, no adjoining word/path character)
// immediately before the path.
const BARE_PATH_RE =
  /(?<![\w./*`-])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html)/g;

interface DriftProofCitation {
  doc: string;
  rawPath: string;
  quote: string;
  matchText: string;
  /** Index in `content` where the matched path text begins -- see
   * Citation.start above. */
  start: number;
}

/** Finds bare-path drift-proof citations in `content`. Reuses quoteAfter
 * (unchanged) with gapWindow=1 to enforce "immediately" -- zero characters
 * of prose between the path and the opening backtick -- rather than a
 * hand-rolled duplicate of quoteAfter's own-closing-backtick skip logic
 * (DEC-613: one implementation). A path immediately followed by ":<digit>"
 * is a STRICT path:line citation already matched by CITATION_RE above; it
 * is skipped here so the two shapes never double-count the same text. */
function findDriftProofCitations(doc: string, content: string): DriftProofCitation[] {
  const out: DriftProofCitation[] = [];
  BARE_PATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_PATH_RE.exec(content))) {
    const end = m.index + m[0].length;
    if (/^:\d/.test(content.slice(end, end + 2))) continue;
    // A path can sit at the TAIL of an already-open code span whose prefix
    // isn't excluded by the lookbehind above ("`npx vitest run\napp/src/
    // foo.ts`" -- "run " precedes the path, not a path character, and
    // these hand-wrapped paragraphs let a span's own text cross a line
    // break -- so the lookbehind doesn't catch it). There the backtick
    // immediately after the path is that SPAN'S OWN CLOSING backtick, not
    // a receipt quote's opener -- treating it as one would pair the
    // citation with whatever unrelated backtick text comes next in the
    // paragraph. Detect this by backtick PARITY from the start of the
    // document: an odd count of backticks before the match means a span is
    // already open, so skip.
    const backticksBefore = (content.slice(0, m.index).match(/`/g) ?? []).length;
    if (backticksBefore % 2 === 1) continue;
    const quote = quoteAfter(content, end, false, 1);
    if (!quote || quote.length === 0) continue; // no immediately-following quote -> not a citation
    out.push({ doc, rawPath: m[1]!, quote, matchText: `${m[0]}\`${quote}\``, start: m.index });
  }
  return out;
}

/** DIRECTION check for a drift-proof citation: resolves the path, then
 * requires the quote to appear verbatim ANYWHERE in the cited file's raw
 * content (not one fixed line -- that is the whole point of this shape).
 * Exhibit-sigilled drift-proof citations (see EXHIBIT grammar,
 * ./citation-grammar) are graded INVERTED, same as strict citations in
 * checkCitationsPartitioned below: an exhibit that resolves AND matches
 * has healed and must be retired, everything else about it is silence. */
function checkDriftProofCitationsPartitioned(
  doc: string,
  content: string,
  repoRoot: string,
  allFiles: Set<string>,
  basenameMap: Map<string, string[]>,
): { ordinary: Violation[]; exhibitHealed: Violation[] } {
  const ordinary: Violation[] = [];
  const exhibitHealed: Violation[] = [];
  for (const c of findDriftProofCitations(doc, content)) {
    const isExhibit = isExhibitCitation(content, c.start);
    const resolved = resolvePath(c.rawPath, repoRoot, allFiles, basenameMap);
    if (!resolved.ok) {
      if (!isExhibit) {
        ordinary.push({ message: `${c.doc}: "${c.matchText}" does not resolve -- ${resolved.reason}` });
      }
      continue; // exhibit correctly still unresolved -> no violation
    }
    const targetContent = readFileSync(join(repoRoot, resolved.relPath!), "utf-8");
    const matches = targetContent.includes(c.quote);
    if (isExhibit) {
      if (matches) {
        exhibitHealed.push({
          message:
            `${c.doc}: exhibit drift-proof quote \`${c.quote}\` following "${c.rawPath}" now appears ` +
            `verbatim in ${resolved.relPath} (was catalogued as dead) -- retire the EXHIBIT! sigil, this ` +
            `citation has healed`,
        });
      }
      continue;
    }
    if (!matches) {
      ordinary.push({
        message:
          `${c.doc}: drift-proof quote \`${c.quote}\` following "${c.rawPath}" does not appear ` +
          `verbatim anywhere in ${resolved.relPath}`,
      });
    }
  }
  return { ordinary, exhibitHealed };
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

/** Runs both citation directions over one (doc, content) pair, PARTITIONED
 * into ordinary citations (graded as before: a violation when they fail
 * to resolve/match) and EXHIBIT citations (DEC-967 wave-137/138: a
 * coordinate marked with the EXHIBIT! sigil is the SUBJECT of its
 * sentence, not a live reference, and is graded INVERTED -- a violation
 * is raised only when the exhibit HEALS, i.e. it unexpectedly resolves
 * and its quote unexpectedly matches). Shared by the real population and
 * the negative-control fixtures so both exercise the identical logic
 * (DEC-613: one implementation, not a scan copy and a fixture copy that
 * quietly diverge). */
function checkCitationsPartitioned(doc: string, content: string): { ordinary: Violation[]; exhibitHealed: Violation[] } {
  const ordinary: Violation[] = [];
  const exhibitHealed: Violation[] = [];
  for (const c of findCitations(doc, content)) {
    const isExhibit = isExhibitCitation(content, c.start);
    const resolved = resolvePath(c.rawPath, ROOT, ALL_REL_FILES, BASENAME_MAP);
    if (!resolved.ok) {
      if (!isExhibit) {
        ordinary.push({ message: `${c.doc}: "${c.matchText}" does not resolve -- ${resolved.reason}` });
      }
      continue; // exhibit correctly still unresolved -> no violation
    }
    const targetAbs = join(ROOT, resolved.relPath!);
    const targetLines = readFileSync(targetAbs, "utf-8").split("\n");
    if (c.firstLine > targetLines.length) {
      if (!isExhibit) {
        ordinary.push({
          message: `${c.doc}: "${c.matchText}" cites line ${c.firstLine} of ${resolved.relPath}, which has only ${targetLines.length} lines`,
        });
      }
      continue; // exhibit correctly still out of range -> no violation
    }
    const quote = quoteAfter(content, c.index, c.ownClosingBacktickFollows);
    if (!quote || quote.length === 0) {
      if (isExhibit) {
        // Resolved AND in-range with nothing left to check: the anchor
        // itself has healed (the file/line now exists where it used to
        // be missing) -- the exhibit's catalogued claim no longer holds.
        exhibitHealed.push({
          message: `${c.doc}: exhibit "${c.matchText}" now resolves to a real file/line (was catalogued as ` +
            `dead) -- retire the EXHIBIT! sigil, this coordinate has healed`,
        });
      }
      continue;
    }
    const targetLine = targetLines[c.firstLine - 1] ?? "";
    const matches = normalise(targetLine).includes(normalise(quote));
    if (isExhibit) {
      if (matches) {
        exhibitHealed.push({
          message:
            `${c.doc}: exhibit quote \`${quote}\` following "${c.matchText}" now matches verbatim at ` +
            `${resolved.relPath}:${c.firstLine} (was catalogued as drifted) -- retire the EXHIBIT! sigil, ` +
            `this citation has healed`,
        });
      }
      continue;
    }
    if (!matches) {
      ordinary.push({
        message:
          `${c.doc}: quote \`${quote}\` following "${c.matchText}" does not appear verbatim at ` +
          `${resolved.relPath}:${c.firstLine} (that line reads: "${targetLine.trim()}")`,
      });
    }
  }
  const driftProof = checkDriftProofCitationsPartitioned(doc, content, ROOT, ALL_REL_FILES, BASENAME_MAP);
  ordinary.push(...driftProof.ordinary);
  exhibitHealed.push(...driftProof.exhibitHealed);
  return { ordinary, exhibitHealed };
}

const DECISION_DOC_NAMES = decisionDocFiles(DECISIONS_DATA_DIR);
const DECISION_DOC_CONTENTS = new Map<string, string>(
  DECISION_DOC_NAMES.map((name) => [name, readFileSync(join(DECISIONS_DATA_DIR, name), "utf-8")]),
);

const ALL_PARTITIONED = DECISION_DOC_NAMES.map((name) => checkCitationsPartitioned(name, DECISION_DOC_CONTENTS.get(name)!));
const ALL_VIOLATIONS: Violation[] = ALL_PARTITIONED.flatMap((p) => p.ordinary);
const ALL_EXHIBIT_HEALED: Violation[] = ALL_PARTITIONED.flatMap((p) => p.exhibitHealed);

// Ratchet (DEC-976 wave-106 amendment, DEC-808 wave-106 two-sided-ratchet
// rule): this is a TO-DO LIST, not a licence. Seeded at the count measured
// on this branch AFTER the DEC-986 correction landed (see step 2 of this
// task) -- it may only be LOWERED as further drift gets fixed, never
// raised to paper over a regression, and a companion test below fails the
// moment the true count drops below the ceiling so the constant is
// re-tightened in the same change that fixes an offender, not left stale.
// Lowered 30 -> 29 in wave 109, in the same change that landed DEC-986's
// ruling: the fix rewrote form-render.tsx's un-require write path and
// cfp-steps-script.tsx's Next handler, so the three docs that receipted the
// OLD text (DEC-986, DEC-976, DEC-681) were rewritten against the new lines
// -- the two-sided ratchet below is what forced the constant down with them.
export const UNRESOLVED_CITATION_CEILING = 0;

// The 29 measured on this branch are a MIX, not a uniform class -- future
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
// disturb the already-tuned UNRESOLVED_CITATION_CEILING exactness
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

// PROBES CLASS (DEC-976 wave-114 amendment, task w3-ah): docs/probes/*.md is
// the Tier-0 authority nothing else checks -- the mandate's own opening
// section names these three files as the VERIFIED RED SET that Tier 0 works
// before all else, so a stale coordinate here outranks a stale audit
// coordinate. Enumerated by readdirSync, never hand-listed (DEC-180: "a
// hand-listed population is not a population"), exactly like AUDIT_ENTRIES
// above. It inherits the existing checkCitations grammar unchanged -- no new
// vocabulary (DEC-613).
const PROBES_DIR = join(ROOT, "docs", "probes");

function probeDocFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

const PROBE_DOC_NAMES = probeDocFiles(PROBES_DIR);
const PROBE_ENTRIES: [string, string][] = PROBE_DOC_NAMES.map((name) => [
  `docs/probes/${name}`,
  readFileSync(join(PROBES_DIR, name), "utf-8"),
]);

// DECISIONS REGISTRY CLASS (DEC-518 wave-155, task ph): the OLDER, disjoint
// `decisions/` directory (1000 files) that test/decision-path-references.
// scan.test.ts already checks for bare path EXISTENCE only -- no line-range,
// no quote. This class runs the SAME two-directional grammar
// (findCitations/resolvePath/quoteAfter/checkCitationsPartitioned) every
// other widened class above uses -- not a second grammar (DEC-613), only a
// longer file list. Enumerated by readdirSync, never a hand-listed manifest
// (DEC-808/DEC-180). Kept OUT of WIDENED_VIOLATIONS/WIDENED_PARTITIONED
// below and given its own separately-named ratchet
// (DECISIONS_REGISTRY_CITATION_CEILING) deliberately: this is a 1000-file
// population never before measured beyond existence, and folding its first
// count into WIDENED_UNRESOLVED_CITATION_CEILING -- already drained to 0
// against a DIFFERENT, previously-measured population -- would silently
// move that ceiling's goalposts mid-convergence.
const DECISIONS_REGISTRY_DIR = join(ROOT, "decisions");

function decisionsRegistryDocFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^DEC-\d+\.md$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

const DECISIONS_REGISTRY_DOC_NAMES = decisionsRegistryDocFiles(DECISIONS_REGISTRY_DIR);
const DECISIONS_REGISTRY_ENTRIES: [string, string][] = DECISIONS_REGISTRY_DOC_NAMES.map((name) => [
  `decisions/${name}`,
  readFileSync(join(DECISIONS_REGISTRY_DIR, name), "utf-8"),
]);

/** One source class = one label plus the (doc, content) pairs it
 * contributes to the walk. Each class gets its own vacuous-population
 * tripwire below (the task's explicit requirement: a widened population
 * that silently contributes zero checked citations from one of its four
 * new classes would be indistinguishable from a class that was never
 * added). The `decisions/DEC-*.md` sixth entry (DEC-518 wave-155) is
 * included here so it shares that same tripwire coverage, but is EXCLUDED
 * from WIDENED_PARTITIONED/WIDENED_VIOLATIONS below -- see
 * DECISIONS_REGISTRY_LABEL and the dedicated ratchet further down. */
const DECISIONS_REGISTRY_LABEL = "decisions/DEC-*.md";
const WIDENED_SOURCE_CLASSES: { label: string; entries: [string, string][] }[] = [
  { label: "docs/design/audit/*.md", entries: AUDIT_ENTRIES },
  { label: "docs/design/DEVIATIONS.md", entries: [DEVIATIONS_ENTRY] },
  { label: "docs/design/DESIGN-RULINGS.md", entries: [DESIGN_RULINGS_ENTRY] },
  { label: "docs/mobile-campaign.md", entries: [MOBILE_CAMPAIGN_ENTRY] },
  { label: "docs/probes/*.md", entries: PROBE_ENTRIES },
  { label: DECISIONS_REGISTRY_LABEL, entries: DECISIONS_REGISTRY_ENTRIES },
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

const WIDENED_PARTITIONED = WIDENED_SOURCE_CLASSES.filter(
  ({ label }) => label !== DECISIONS_REGISTRY_LABEL,
).flatMap(({ entries }) => entries.map(([doc, content]) => checkCitationsPartitioned(doc, content)));
const WIDENED_VIOLATIONS: Violation[] = WIDENED_PARTITIONED.flatMap((p) => p.ordinary);
const WIDENED_EXHIBIT_HEALED: Violation[] = WIDENED_PARTITIONED.flatMap((p) => p.exhibitHealed);

// Separate walk + ratchet for the decisions/ registry class (DEC-518
// wave-155) -- same functions, its own population, its own ceiling. See
// DECISIONS_REGISTRY_LABEL comment above for why this is not folded into
// WIDENED_PARTITIONED/WIDENED_VIOLATIONS.
const DECISIONS_REGISTRY_PARTITIONED = DECISIONS_REGISTRY_ENTRIES.map(([doc, content]) =>
  checkCitationsPartitioned(doc, content),
);
const DECISIONS_REGISTRY_VIOLATIONS: Violation[] = DECISIONS_REGISTRY_PARTITIONED.flatMap((p) => p.ordinary);
const DECISIONS_REGISTRY_EXHIBIT_HEALED: Violation[] = DECISIONS_REGISTRY_PARTITIONED.flatMap(
  (p) => p.exhibitHealed,
);

// Ratchet (DEC-967 wave-107, DEC-808 wave-106 two-sided-ratchet rule):
// seeded at the count this scan itself measured on this branch (never
// inherited from the task's own calibration prose, which is a rough
// figure for a different, narrower slice -- "resolvable" citations under
// DIRECTION 1 only, not this ceiling's DIRECTION-1-plus-DIRECTION-2
// violation count). May only be LOWERED as the four new classes' drift
// gets fixed, never raised to paper over a regression.
// Lowered 20 -> 0 by the merge train on 2026-08-19 (megabatch gate), forced
// by the two-sided companion below. The measured count had first RISEN to 29
// -- above the ceiling -- so the repair was the citations, never the
// constant: all 29 widened-population rows in docs/design/audit/*.md were
// re-pointed at the lines that actually carry their quoted receipts (or, for
// the rows where the scan was reading a neighbouring pointer in a prose list
// as the receipt, the prose was reflowed so each citation carries its own).
// Re-measured 0 by running this scan on the integrated tree, per DEC-989
// clause a.
// Lowered 0 -> 0 (wave-141, task w16-aa): drained the audit-doc citation
// catalogue (docs/design/audit/code-comment-citation-v12.md, which carried
// every one of the prior 44 widened-population offenders -- see that
// file's "Wave-141 repair pass" section). Re-measured 0 by forcing this
// constant to -1 and reading the printed offender list.
export const WIDENED_UNRESOLVED_CITATION_CEILING = 0;

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

  // EXHIBIT grammar (DEC-967 wave-137/138): a coordinate marked with the
  // EXHIBIT! sigil is the SUBJECT of its sentence, cataloguing a dead
  // anchor as evidence -- it is graded INVERTED. A violation here means
  // the exhibit HEALED (it now resolves and, where quoted, matches),
  // which is the scan's way of telling the author to retire the sigil.
  it("every EXHIBIT!-marked citation in the widened population still fails to resolve/match (retire the sigil the moment one heals)", () => {
    if (WIDENED_EXHIBIT_HEALED.length > 0) {
      throw new Error(
        `${WIDENED_EXHIBIT_HEALED.length} widened-population EXHIBIT! citation(s) have healed -- retire their ` +
          `sigils (they are no longer dead anchors):\n` + WIDENED_EXHIBIT_HEALED.map((v) => v.message).join("\n"),
      );
    }
    expect(WIDENED_EXHIBIT_HEALED).toEqual([]);
  });
});

// Ratchet for the decisions/ registry class (DEC-518 wave-155, task ph):
// this is a 1000-file population never before checked beyond bare path
// existence (test/decision-path-references.scan.test.ts). MEASURE-ONLY
// landing per this task's explicit instruction -- fix no offenders, change
// no decisions/*.md body. Seeded by forcing this to -1 and reading the
// printed count off this tree (see docs/design/audit/decisions-registry-
// citation-v12.md for the measured shape).
// Lowered 1290 -> 1277 (wave-19, task w19-c, DEC-967 amendment): re-measured
// by forcing this to -1 first, which found the true count had RISEN to 1294
// (drift, not a stale ceiling) -- so the repair was the citations, never a
// raise of the constant. 17 offenders repaired in decisions/DEC-004.md,
// DEC-005.md, DEC-006.md, DEC-011.md, DEC-013.md and DEC-018.md, each
// rewritten to the repo-relative-path-plus-backtick-quoted-content shape
// with NO :line suffix (mandatory per this task) so the citation resolves
// by content and cannot rot from line drift again. Re-measured 1277 by
// re-running this scan on the repaired tree.
// DEC-069 RULE (wave-10, task w10-th): this ratchet moves DOWN every wave
// it is red -- a ceiling sitting one row over its own measurement is a
// ledger that stopped measuring, and a red decisions/ citation scan blocks
// the exit predicate the same as any other tier-2 gate. Lowered 1277 ->
// 1260 (wave-10, task w10-th, DEC-069): re-measured by running this scan
// fresh, which confirmed the tree had drifted to 1278 (one row OVER the
// declared ceiling, exactly as this task's own measurement reported) --
// so the repair was 18 offenders in decisions/DEC-008.md (comma-adjacent
// `path:line` citations reading as each other's receipt quote -- broken
// by de-adjacent-ing them into a plain list, not by inventing quotes),
// DEC-009.md, DEC-010.md (two paragraphs, one genuinely describing a
// since-CLOSED split-brain bug, reworded past-tense and re-anchored on the
// construct that closed it) and DEC-037.md (nine bare basenames with no
// directory prefix that used to resolve before an unrelated file move,
// plus one stale "single exception" clause whose exception has since been
// fixed), each repaired with the DEC-518 drift-proof
// repo-relative-path-plus-backtick-quote shape (no `:line`) wherever the
// cited construct still exists, and re-anchored on its current home where
// it had moved. Re-measured 1260 by re-running this scan on the repaired
// tree.
// Lowered 1260 -> 1234 (wave-26, task w26-c, DEC-518 amendment): re-measured
// by forcing this constant to -1 and reading the printed offender list,
// which confirmed the tree had drifted to 1265 (five rows OVER the declared
// ceiling) -- so the repair was the citations, never a raise of the
// constant. All 31 offenders in decisions/DEC-422.md (the wave's top
// density row) were repaired: two isolated shape-(b) drifted-line citations
// (save-draft's handler, since split out to submit-draft.tsx; a moved
// MAX_CRITERION_GUIDANCE_LENGTH declaration), one shape-(a) coordinate
// misread as its own PARENTHESISED quote's neighbour (`export` read out of
// unrelated prose next to the pagination.ts citation, fixed by dropping the
// backticks around the prose word rather than the citation), one plain
// missing-prefix bare path (routes/api/views.ts), and four paragraphs that
// had gone stale because the bug or gap they described had since been
// CLOSED by a later amendment in the same file (the FIVE-refusal-grammar
// audit, PlanEditor's hand-typed MAX_CRITERIA, the participant-cap overage
// copy, and the repeated-single-value-answer merge) -- each reworded
// past-tense and re-anchored on the construct that closed it (the DEC-010
// wave-10 precedent), which also retired the seventeen comma-adjacent bare
// `path:line` fragments the FIVE-refusal-grammar paragraph had accumulated
// as its own citations misread each other's neighbouring quote. Re-measured
// 1234 by re-running this scan on the repaired tree.
// Wave-28 merge train (thunderdome medic): re-measured 1233. Lane v12m-w26-c
// measured 1234 on a worktree that did not yet contain v12m-w24-g's Comms
// compose field-label repair (8fa3c9894), which inserted 14 lines into
// app/src/pages/comms/ComposeWizard.tsx. That shift moved line 496 from
// `return ids.length > 0 ? ids : null;` to
// `const end = el?.selectionEnd ?? bodyText.length;`, which contains the
// substring `body` that decisions/DEC-817.md:24's line-keyed
// `ComposeWizard.tsx:496` citation quotes -- so exactly one violation healed
// on integrated main (verified: 1 resolved, 0 new). A ratchet may only be
// LOWERED, and this is a lowering.
export const DECISIONS_REGISTRY_CITATION_CEILING = 1233;

describe("decisions/ registry citation scan (DEC-518 wave-155, task ph)", () => {
  it("vacuous-population tripwire: finds decisions/DEC-*.md files, including the known member DEC-001.md", () => {
    expect(DECISIONS_REGISTRY_DOC_NAMES.length).toBeGreaterThan(0);
    expect(DECISIONS_REGISTRY_DOC_NAMES).toContain("DEC-001.md");
  });

  it(`every citation in decisions/DEC-*.md resolves to a real file/line and, where a backtick quote immediately follows, matches it verbatim (ceiling: DECISIONS_REGISTRY_CITATION_CEILING, may only be lowered)`, () => {
    if (DECISIONS_REGISTRY_VIOLATIONS.length > DECISIONS_REGISTRY_CITATION_CEILING) {
      throw new Error(
        `${DECISIONS_REGISTRY_VIOLATIONS.length} decisions/ registry citations are unresolved, above the ratchet ` +
          `ceiling of ${DECISIONS_REGISTRY_CITATION_CEILING} (may only be LOWERED, never raised to paper over a ` +
          `regression):\n` + DECISIONS_REGISTRY_VIOLATIONS.map((v) => v.message).join("\n"),
      );
    }
    expect(DECISIONS_REGISTRY_VIOLATIONS.length).toBeLessThanOrEqual(DECISIONS_REGISTRY_CITATION_CEILING);
  });

  it("the ceiling is not stale: the measured violation count is not below DECISIONS_REGISTRY_CITATION_CEILING (two-sided ratchet, DEC-808 wave-106 amendment)", () => {
    if (DECISIONS_REGISTRY_VIOLATIONS.length < DECISIONS_REGISTRY_CITATION_CEILING) {
      throw new Error(
        `measured ${DECISIONS_REGISTRY_VIOLATIONS.length} unresolved decisions/ registry citations, below the ` +
          `declared ceiling of ${DECISIONS_REGISTRY_CITATION_CEILING} -- lower the constant: ` +
          `export const DECISIONS_REGISTRY_CITATION_CEILING = ${DECISIONS_REGISTRY_VIOLATIONS.length};`,
      );
    }
    expect(DECISIONS_REGISTRY_VIOLATIONS.length).toBeGreaterThanOrEqual(DECISIONS_REGISTRY_CITATION_CEILING);
  });

  it("every EXHIBIT!-marked citation in decisions/DEC-*.md still fails to resolve/match (retire the sigil the moment one heals)", () => {
    if (DECISIONS_REGISTRY_EXHIBIT_HEALED.length > 0) {
      throw new Error(
        `${DECISIONS_REGISTRY_EXHIBIT_HEALED.length} decisions/ registry EXHIBIT! citation(s) have healed -- ` +
          `retire their sigils (they are no longer dead anchors):\n` +
          DECISIONS_REGISTRY_EXHIBIT_HEALED.map((v) => v.message).join("\n"),
      );
    }
    expect(DECISIONS_REGISTRY_EXHIBIT_HEALED).toEqual([]);
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

  // EXHIBIT grammar (DEC-967 wave-137/138): see the matching block in the
  // widened-population describe above for the full rationale. This is the
  // decision-registry population's own copy of the same inverted grading
  // -- src/decisions-data/DEC-967.md:121/123's wave-136/wave-137 catalogue
  // paragraphs are the live exhibits this closes.
  it("every EXHIBIT!-marked citation in src/decisions-data/DEC-*.md still fails to resolve/match (retire the sigil the moment one heals)", () => {
    if (ALL_EXHIBIT_HEALED.length > 0) {
      throw new Error(
        `${ALL_EXHIBIT_HEALED.length} decision-registry EXHIBIT! citation(s) have healed -- retire their sigils ` +
          `(they are no longer dead anchors):\n` + ALL_EXHIBIT_HEALED.map((v) => v.message).join("\n"),
      );
    }
    expect(ALL_EXHIBIT_HEALED).toEqual([]);
  });

  it("vacuous exhibit tripwire: the decision registry actually contains at least one EXHIBIT!-marked citation today", () => {
    // Non-vacuity over the real population, not a synthetic fixture: proves
    // the exhibit branch of checkCitationsPartitioned is reachable and not
    // dead code silently contributing nothing (the same house rule as the
    // widened-population vacuous-population tripwires above, applied to
    // the EXHIBIT partition specifically).
    let exhibitCount = 0;
    for (const name of DECISION_DOC_NAMES) {
      const content = DECISION_DOC_CONTENTS.get(name)!;
      for (const c of findCitations(name, content)) {
        if (isExhibitCitation(content, c.start)) exhibitCount++;
      }
    }
    expect(exhibitCount).toBeGreaterThan(0);
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
    violations.push(...checkDriftProofCitationsPartitioned("fixture.md", content, tmpRoot, allRelFiles, basenameMap).ordinary);
    return violations;
  }

  /** Exhibit-aware fixture check, mirroring checkCitationsPartitioned's
   * strict-citation branch but scoped to the tmp fixture root (the real
   * checkCitationsPartitioned is hardcoded to ROOT/ALL_REL_FILES/
   * BASENAME_MAP, which do not see fixture files). Only the strict-shape
   * branch is exercised here -- the fixture controls above already cover
   * drift-proof shape without exhibits, and no exhibit in the real
   * population today is drift-proof (see DEC-967.md's catalogue: all 13
   * are the strict `path:line` shape). */
  function checkFixtureExhibits(content: string): { ordinary: Violation[]; exhibitHealed: Violation[] } {
    const ordinary: Violation[] = [];
    const exhibitHealed: Violation[] = [];
    for (const c of findCitations("fixture.md", content)) {
      const isExhibit = isExhibitCitation(content, c.start);
      const resolved = resolvePath(c.rawPath, tmpRoot, allRelFiles, basenameMap);
      if (!resolved.ok) {
        if (!isExhibit) ordinary.push({ message: `"${c.matchText}" does not resolve -- ${resolved.reason}` });
        continue;
      }
      const targetLines = readFileSync(join(tmpRoot, resolved.relPath!), "utf-8").split("\n");
      if (c.firstLine > targetLines.length) {
        if (!isExhibit) ordinary.push({ message: `"${c.matchText}" cites line ${c.firstLine}, out of range` });
        continue;
      }
      const quote = quoteAfter(content, c.index, c.ownClosingBacktickFollows);
      if (!quote) {
        if (isExhibit) exhibitHealed.push({ message: `"${c.matchText}" now resolves -- healed` });
        continue;
      }
      const targetLine = targetLines[c.firstLine - 1] ?? "";
      const matches = normalise(targetLine).includes(normalise(quote));
      if (isExhibit) {
        if (matches) exhibitHealed.push({ message: `exhibit quote \`${quote}\` now matches -- healed` });
        continue;
      }
      if (!matches) ordinary.push({ message: `quote \`${quote}\` does not match line ${c.firstLine}` });
    }
    return { ordinary, exhibitHealed };
  }

  it("an EXHIBIT!-sigilled citation that still fails to resolve contributes no violation either way", () => {
    const doc = "The old rule lived at EXHIBIT!fixture-cited.ts:999 declares `export const GONE = 1;` -- moved since.";
    const { ordinary, exhibitHealed } = checkFixtureExhibits(doc);
    expect(ordinary).toEqual([]);
    expect(exhibitHealed).toEqual([]);
  });

  it("an EXHIBIT!-sigilled citation that NOW resolves and matches is reported as healed (INVERTED grading)", () => {
    const doc = "The old rule lived at EXHIBIT!fixture-cited.ts:3 declares `export const FIXTURE_TOKEN = 42;` -- moved since.";
    const { ordinary, exhibitHealed } = checkFixtureExhibits(doc);
    expect(ordinary).toEqual([]);
    expect(exhibitHealed.length).toBe(1);
    expect(exhibitHealed[0]!.message).toMatch(/healed/);
  });

  it("an EXHIBIT! sigil written three sentences away does not attach to a later, unrelated citation", () => {
    const doc =
      "EXHIBIT!fixture-cited.ts:999 was dead. Several sentences later, an unrelated live pointer: " +
      "fixture-cited.ts:3 declares `export const FIXTURE_TOKEN = 42;` correctly.";
    const { ordinary, exhibitHealed } = checkFixtureExhibits(doc);
    // The far-away sigil does not attach to the second, unrelated citation:
    // that citation is graded ORDINARY (and passes, since it is true), and
    // the first (genuinely sigilled, genuinely dead) citation contributes
    // no violation either way -- it is a correctly-still-broken exhibit.
    expect(ordinary).toEqual([]);
    expect(exhibitHealed).toEqual([]);
  });

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

  // Positive control (DEC-967 wave-115): a drift-proof citation -- bare
  // path, no ":line", immediately followed by a backtick quote -- resolves
  // when the quote appears verbatim anywhere in the cited file, even
  // though no line number is given at all.
  it("a drift-proof citation (bare path immediately followed by a backtick quote) whose quote is present anywhere in the file passes", () => {
    const doc = "The rule now lives at fixture-cited.ts`export const FIXTURE_TOKEN = 42;` and nowhere else.";
    expect(checkFixture(doc)).toEqual([]);
  });

  it("a drift-proof citation whose quote is absent from the cited file is flagged", () => {
    const doc = "The rule now lives at fixture-cited.ts`export const NOT_REALLY_THERE = 1;` and nowhere else.";
    const violations = checkFixture(doc);
    expect(violations.length).toBe(1);
    expect(violations[0]!.message).toMatch(/does not appear verbatim anywhere/);
  });

  // Negative control: a bare path with NO immediately-following backtick
  // quote is not a citation at all -- it must contribute nothing to the
  // population (no new loophole: a pointer with no receipt still asserts
  // nothing, same rule as the strict shape's DIRECTION 1).
  it("a bare path with no following quote is not a citation and contributes no violation", () => {
    const doc = "See fixture-cited.ts for the full implementation.";
    expect(checkFixture(doc)).toEqual([]);
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
