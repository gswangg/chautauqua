// Line-keyed citation detector (DEC-967 amendment, task w11-t).
//
// Extracted from test/citation-form-drift.scan.test.ts (contention-hotspot
// decomposition, custodian task custodian-test_citation_form_drift_scan_test_ts):
// pure extraction, no behavior change.
//
// This module checks citation FORM: does a citation into app/src/, src/,
// test/, scripts/ or migrations/ still use the fragile line-keyed shape
// (`path:line` immediately followed by a backtick quote) instead of the
// drift-proof one. It does not check whether a citation is TRUE (that is
// test/decision-doc-citation.scan.test.ts's job -- citation RESOLUTION).
//
// STRUCTURAL CARVE-OUT: docs/design/*.dc.html citations keep `file:line`
// and are NOT counted here. The frame is the coordinate system and never
// moves -- CITATION_RE's extension alternation below does not include
// `html` at all, so a `.dc.html` citation never matches the shape in the
// first place (belt); the negative-lookbehind `(?<!\.dc\.html)` is kept
// anyway, verbatim from test/decision-doc-citation.scan.test.ts's own
// CITATION_RE, as a second, redundant guard against a future extension
// widening silently reopening the carve-out (suspenders).
import { resolve } from "node:path";
import { isExhibitCitation } from "../citation-grammar";
import { buildRepoIndex, resolvesUnderScope } from "./repo-index";

// Repo root is two levels up from this file (test/citation-form-drift/ ->
// repo root), matching the original single-file scan's
// resolve(__dirname, "..") when __dirname was test/. Built once at module
// load, same discipline the original file used for its module-level
// ALL_REPO_FILES/BASENAME_MAP.
const ROOT = resolve(__dirname, "..", "..");
const REPO_INDEX = buildRepoIndex(ROOT);

// Line-keyed citation shape: `<path>:<line>[-<line>]`, extension alternation
// tries the LONGER extension first (tsx before ts) for the same reason
// test/decision-doc-citation.scan.test.ts's CITATION_RE does -- JS regex
// alternation does not backtrack for a longer overall match, so `ts|tsx`
// would truncate a `.tsx` citation to `.ts`. `.dc.html` is excluded twice
// over (see header): it is not in the extension list at all, and the
// negative lookbehind is kept as a second guard.
export const CITATION_RE =
  /\b((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html):(\d+)(?:-(\d+))?/g;

/** Bare-path drift-proof shape (DEC-967 wave-115): a path with no ":line"
 * at all. Used only by the negative-control test to prove the detector
 * does NOT fire on the converted form. */
export const BARE_PATH_RE =
  /(?<![\w./*`-])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html)/g;

/** First backtick-quoted literal within `gapWindow` characters after
 * `index`, or null. Mirrors
 * test/decision-doc-citation.scan.test.ts's quoteAfter, same gap
 * discipline (short gap so the citation pairs with ITS OWN receipt, not
 * the next unrelated backtick literal in a long paragraph). */
export function quoteAfter(
  content: string,
  index: number,
  skipOwnClosingBacktick: boolean,
  gapWindow = 25,
): string | null {
  const searchFrom = skipOwnClosingBacktick && content[index] === "`" ? index + 1 : index;
  const gapSlice = content.slice(searchFrom, searchFrom + gapWindow);
  const openRel = gapSlice.indexOf("`");
  if (openRel === -1) return null;
  const openAbs = searchFrom + openRel + 1;
  const closeAbs = content.indexOf("`", openAbs);
  if (closeAbs === -1 || closeAbs - openAbs > 400) return null;
  return content.slice(openAbs, closeAbs);
}

export interface Offender {
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
 * makes), so it is skipped past before searching for a real quote.
 *
 * EXHIBIT!-sigilled citations (DEC-967 wave-137/138, ../citation-grammar)
 * are excluded from this population outright, never converted: an
 * exhibit is a DEAD anchor, catalogued by a ruling as evidence of a
 * defect it measured -- there is no live file/line to search a quote in,
 * so the drift-proof bare-path shape (which requires the quote to
 * eventually resolve SOMEWHERE in the cited file) is unavailable to it by
 * construction. Converting an exhibit to drift-proof form would either
 * make it resolve (destroying the evidence the ruling needs) or leave it
 * permanently unresolved in a shape whose entire contract is "this quote
 * exists in this file" -- neither is the exhibit grammar's job; that is
 * test/decision-doc-citation.scan.test.ts's INVERTED grading. */
export function findLineKeyedOffenders(doc: string, content: string): Offender[] {
  const out: Offender[] = [];
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(content))) {
    if (isExhibitCitation(content, m.index)) continue;
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
    const resolved = REPO_INDEX.resolvePath(rawPath);
    if (!resolved || !resolvesUnderScope(resolved)) continue;
    out.push({ doc, relPath: resolved, line, quote, matchText: m[0] });
  }
  return out;
}
