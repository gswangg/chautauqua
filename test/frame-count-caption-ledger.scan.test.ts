// Frame COUNT-caption ledger (DEC-180 wave-28 amendment; task v12m-w28-h).
//
// DEC-180's wave-28 amendment names a fifth uninstrumented population: the
// caption ledger's own header text says a digit-bearing muted-prose span
// ("18 more · 23 is under the 100-recipient cap") is "a COMPOSED-from-data
// render, graded by a different instrument were one to exist" -- and none
// existed. This is that instrument.
//
// STALENESS NOTE, RECONCILED (DEC-180 wave-42 amendment; was: "flagged for
// the scribe to reconcile in a future amendment" -- now reconciled):
// test/frame-caption-ledger/population.ts's own wave-142/w17-f comment
// records that the caption ledger's digit discriminator was RETIRED before
// this DEC-180 wave-28 amendment was authored -- the amendment's header
// text ("that ledger's population excludes digits, this one requires one")
// quotes the caption ledger's *header prose*, which was never updated
// after the retirement, not its *live grammar*. Measured directly on this
// branch: docs/design/*.dc.html yields 378 rows under the caption ledger's
// colour/length/no-`@` grammar with NO digit filter (identical to
// ./frame-caption-ledger/population.ts's live ALL_CAPTIONS), of which 145
// carry a digit -- so this ledger's population is a SUBSET of the caption
// ledger's live population, in full containment, not disjoint from it (the
// "containment" test below proves and documents that true relationship).
// The wave-42 amendment closes the loop this staleness note opened: the
// OUT_OF_CAMPAIGN_SCOPE excuse's claim that every row here "resolves under
// [the caption ledger's] stronger grader" was, until this amendment,
// asserted on the strength of containment plus a 16-row hand sample, never
// run. `COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING` (below) is that grader
// run over the actual 113-row population, forced to -1 and read back: 0.
// The excuse's premise is now PROVEN for all 113 rows, not merely cited.
//
//   1. POPULATION -- derived from docs/design/*.dc.html at test time
//      (readdirSync, DEC-808), never hand-listed. Ported (not imported,
//      per this campaign's standing "port, don't cross-import a population
//      walk" convention -- see test/frame-eyebrow-label.scan.test.ts's own
//      header) from the caption ledger's own grammar
//      (test/frame-caption-ledger/population.ts): a
//      `<span|div|p style="...">TEXT</span|div|p>` (opening/closing tag
//      names matched via backreference) whose style carries
//      `color:#565A4B` / `color:#3F4237` / `color:#8E8A7A`, does NOT carry
//      `text-transform:uppercase`, whose TEXT contains no `<`/`>`/`{{` and
//      is >= 20 chars after trim and contains no `@` -- IDENTICAL to the
//      caption ledger's grammar with exactly one discriminator INVERTED:
//      the digit test. The caption ledger's population requires NO digit;
//      this one REQUIRES >= 1 digit. Measured on this branch: 145 rows
//      across 13 files.
//
//   2. EXCLUSIONS -- two tables, {fileName, line, text, reason}, each
//      entry asserted below to still resolve to its cited file:line:text
//      in the current pack (a stale exclusion fails loudly):
//        a. EXPLAINER -- the pack's own annotation panels, commentary
//           about the design system, not product copy a real screen
//           draws.
//        b. FIXTURE -- invented sample identities, sample body text and
//           the Docs frame's own exemplar article used as mock/demo
//           content inside a frame, not a caption a real screen draws.
//      Each reason is a PRINCIPLE (DEC-099), never a lane or a schedule.
//      Every entry below cites the SAME file:line:text the caption
//      ledger's own EXPLAINER_EXCLUSIONS / FIXTURE_EXCLUSIONS /
//      EXEMPLAR_ARTICLE_EXCLUSIONS tables already carry (DEC-613: this
//      ledger does not re-derive a classification another instrument
//      already established for the identical row -- it cites it).
//
//   3. GRADER (this is what makes it a new instrument and not a second
//      copy of the caption ledger, DEC-613): the source-side corpus,
//      comment-stripping and entity-decoding are IMPORTED verbatim from
//      test/frame-source-corpus.ts's `enumerateSourceFiles` /
//      `stripComments` / `normalizeSource` -- never re-implemented. On top
//      of that shared normalization, every run of digits on BOTH the pack
//      side and the source side is reduced to one placeholder token before
//      comparing (digit-collapse only -- deliberately NOT the caption
//      ledger's own further `${...}`/`{...}` merge-placeholder collapse,
//      which lives in test/frame-caption-ledger/match.ts and is that
//      ledger's own private technique; reusing it here would make this
//      grader the same instrument by another name). A row MATCHES when its
//      digit-collapsed skeleton occurs as a substring of the digit-
//      collapsed, comment-stripped, entity-decoded corpus.
//
//      Because this technique is narrower than the caption ledger's own
//      (no merge-placeholder collapse, no .md reach, the frame-source-
//      corpus.ts entity table rather than the caption ledger's wider one),
//      it resolves far fewer composed captions than that ledger does --
//      that is the expected, by-construction shape of "a new instrument
//      that measures a different thing", not a defect: this ledger
//      measures how much of the pack's count-bearing prose a SIMPLE
//      digit-collapse join can verify, a strictly weaker and therefore
//      strictly honest lower bound.
//
//   4. RATCHET -- FRAME_COUNT_CAPTION_UNMATCHED_CEILING, a single exported
//      const, hand-measured on this branch by forcing it to -1 and reading
//      the printed offender list back (never `= UNMATCHED.length`).
//      Two-sided, identical shape to every prior ledger in this campaign:
//      one `it` fails when the count rises above the ceiling (printing the
//      offender list), a companion `it` fails when it falls below (printing
//      the exact replacement line). DEC-180 wave-42 amendment adds a
//      second, identically-shaped two-sided ratchet,
//      COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING, over `UNMATCHED_BY_BOTH` --
//      the subset of `UNMATCHED` that ALSO fails the caption ledger's own
//      stronger grader. Measured 0: the OUT_OF_CAMPAIGN_SCOPE excuse's
//      premise holds for every row, proven rather than cited.
//
// This is a newly measured, previously-uncounted population -- registered
// in scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE with the same
// principled reason FRAME_EYEBROW_DIVERGENCE_CEILING and
// FRAME_FIELD_LABEL_DIVERGENCE_CEILING already carry, so it does not move
// the campaign exit gate's goalposts mid-convergence. MEASURE AND RATCHET
// ONLY -- this file moves no product byte; every one of the 16
// population rows this task found with no pre-existing caption-ledger
// exclusion citation is named in docs/design/audit/frame-count-caption-
// ledger-v12.md, none of them DIVERGES. DEC-180 wave-42 amendment: this is
// no longer an unverified claim -- `COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING`
// runs the caption ledger's own stronger, merge-placeholder-aware grader
// (imported from test/frame-caption-ledger/match.ts, never re-implemented)
// over all FRAME_COUNT_CAPTION_UNMATCHED_CEILING rows and measures 0: every
// one of them resolves under that ledger's own final UNMATCHED computation
// (the same one that produces its FRAME_CAPTION_UNMATCHED_CEILING = 0) --
// this ledger's own UNMATCHED count remains an instrument-completeness fact
// about ITS narrower technique, not a copy-fidelity claim about the app,
// and that fact is now checked rather than merely cited.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_099, DEC_180, DEC_613, DEC_808 } from '../src/decisions';
import { captionIsMatched, normalizeCaption, UNMATCHED as CAPTION_LEDGER_UNMATCHED } from './frame-caption-ledger/match';
import { ALL_CAPTIONS } from './frame-caption-ledger/population';
import { enumerateSourceFiles, normalizeSource, stripComments } from './frame-source-corpus';

// Compile-checked dependency markers (CLAUDE.md: code depending on a
// decision must reference its constant so the dependency is compile-
// checked).
void DEC_180; // this ledger's own ruling (wave-28 amendment): the digit-bearing caption population gets a new instrument.
void DEC_808; // population derived from the tree at test time, never hand-listed.
void DEC_613; // the source-side stripper/matcher is imported verbatim, never re-implemented; exclusion reasons cite the caption ledger's own established classifications rather than re-deriving them.
void DEC_099; // OUT_OF_CAMPAIGN_SCOPE reason below is a principle, not a schedule.

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population --------------------------------------------------------

export interface CountCaption {
  fileName: string;
  line: number;
  text: string;
}

const MUTED_COLOR_RE = /color:#565A4B|color:#3F4237|color:#8E8A7A/;
const UPPERCASE_RE = /text-transform:uppercase/;
const DIGIT_RE = /\d/;

// Same tag grammar as ./frame-caption-ledger/population.ts's own TAG_RE
// (ported, not imported -- see module header).
const TAG_RE = /<(span|div|p)\s+style="([^"]*)">([^<]*)<\/\1>/gs;

export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** Extracts every population-qualifying COUNT caption from raw frame-file
 * TEXT: identical to the caption ledger's own grammar with the digit
 * discriminator INVERTED (>= 1 digit required rather than forbidden).
 * Exported so the non-vacuity synthetic fixture below can drive this exact
 * function over a fabricated fixture, never a live product count. */
export function countCaptionsInText(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text)) !== null) {
    const style = m[2]!;
    const rawText = m[3]!;
    if (!MUTED_COLOR_RE.test(style)) continue;
    if (UPPERCASE_RE.test(style)) continue;
    if (rawText.includes('{{')) continue;
    const trimmed = rawText.trim();
    if (trimmed.length < 20) continue;
    if (trimmed.includes('@')) continue;
    if (!DIGIT_RE.test(trimmed)) continue; // digit REQUIRED (inverted from the caption ledger's own discriminator)
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ line, text: trimmed });
  }
  return out;
}

function countCaptionsInFile(fileName: string): CountCaption[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  return countCaptionsInText(content).map((c) => ({ fileName, line: c.line, text: c.text }));
}

export const ALL_COUNT_CAPTIONS: CountCaption[] = designFiles().flatMap(countCaptionsInFile);

// -- Exclusions ----------------------------------------------------------
// Each entry cites the SAME file:line:text the caption ledger's own
// EXPLAINER_EXCLUSIONS / FIXTURE_EXCLUSIONS / EXEMPLAR_ARTICLE_EXCLUSIONS
// tables already carry -- this ledger does not re-derive a classification
// another instrument already established for the identical row (DEC-613);
// it cites it.

interface Exclusion {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

// (a) EXPLAINER -- the pack's own annotation panels, commentary about the
// design system rather than product copy a real screen draws.
const EXPLAINER_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 262,
    text: 'Three levels. An article needing H4 is two articles.',
    reason:
      "the Docs frame's own 'element library' annotation panel naming the article-heading-depth rule -- design-system vocabulary, not a Docs article the app renders (same row the caption ledger's own EXPLAINER_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 300,
    text: 'screenshot · /admin/route · 1600×900',
    reason:
      'a screenshot-block placeholder caption inside the Docs frame\'s own annotation panel, not a real Docs article the app renders (same row the caption ledger\'s own EXPLAINER_EXCLUSIONS carries).',
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 388,
    text: 'Each state is drawn at 900 and at 390, so there is no guessing which layout is being specified. Desktop lays an event out as a three-column row — dates, name and state, action. Phone stacks the same fields into a card with a full-width button.',
    reason:
      "the pack's own responsive-annotation panel explaining how the frame itself is authored -- commentary about the design system, not a caption any screen renders (same row the caption ledger's own EXPLAINER_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 408,
    text: 'The seed holds one event. The autumn-workshops and 2026 rows exist to show what the shape does with several — they are not seeded data.',
    reason:
      "the pack's own annotation explaining its OWN demo-data choices to the reader of the frame file, not a caption any screen renders (same row the caption ledger's own EXPLAINER_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 367,
    text: 'Overview, session detail, forms, settings panels, every public page. Prose and single decisions. The gutters are the design, not waste — a 60-character measure does not improve at 1800px.',
    reason:
      "the pack's own grid-system annotation panel explaining the design rationale for column widths, not a caption any screen renders (same row the caption ledger's own EXPLAINER_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 380,
    text: 'Submissions, Contacts directory, Content worklist, Review results, Comms, Settings. Tables want width — but past about 1440 the eye loses the row between the title and the action at the far end, and the fix is a wider gap, not a wider table.',
    reason:
      "the pack's own grid-system annotation panel explaining the design rationale for table gutters, not a caption any screen renders (same row the caption ledger's own EXPLAINER_EXCLUSIONS carries).",
  },
];

// (b) FIXTURE -- invented sample identities, sample body text and the Docs
// frame's own exemplar article, used as mock/demo content inside a frame,
// not a caption a real screen draws.
const FIXTURE_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Agenda.dc.html',
    line: 194,
    text: 'DFC-033 · lightning talk, 10 min',
    reason: "invented sample session identity used as mock agenda-card content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 713,
    text: '12–14 May 2027 · Moscone West, San Francisco',
    reason: "invented sample event dates/venue used as mock merge-field preview content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 374,
    text: 'Marcus O. · added 2 Aug',
    reason: "invented sample contact identity used as mock duplicate-review content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Contacts.dc.html',
    line: 597,
    text: 'DevFlow Conf 2028 · planning',
    reason: "invented sample event identity used as mock switcher content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 449,
    text: 'We take PDF, Keynote, PowerPoint and MP4 so reviewers and the AV team can open it without unpacking anything. A zip could hold anything.',
    reason: "invented sample help-text body used as mock deliverable-panel content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Content.dc.html',
    line: 453,
    text: 'Slides v3 is still the current file. Nothing was replaced.',
    reason: "invented sample confirmation body used as mock deliverable-panel content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 576,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model — including the two migrations that failed first.',
    reason: "invented sample submission abstract used as mock portal content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 616,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model.',
    reason: "invented sample submission abstract used as mock portal content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 927,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model — including the two migrations that failed first.',
    reason: "invented sample submission abstract used as mock portal content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1039,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model.',
    reason: "invented sample submission abstract used as mock portal content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1248,
    text: "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run. Live demo, real failure cases, and a checklist you can apply to your own docs this week. …",
    reason: "invented sample submission abstract used as mock portal content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1401,
    text: 'Our monorepo CI took 40 minutes on a good day. This talk walks through how we cut it to 6 minutes with content-addressed caching, remote execution, and a test-selection model.',
    reason: "invented sample submission abstract used as mock portal content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 211,
    text: 'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code — property tests, mutation coverage, snapshot judges, and CI gates — with data from 18 months of running them on a 200-engineer codebase.',
    reason: "invented sample submission abstract used as mock review-panel content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 294,
    text: 'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code — property tests, mutation coverage, snapshot judges, and CI gates — with data from 18 months of running them on a 200-engineer codebase.',
    reason: "invented sample submission abstract used as mock review-panel content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 235,
    text: 'Priya Raman · sent 2 Apr',
    reason: "invented sample speaker identity used as mock reminder-history content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 521,
    text: '12–14 May 2027 · Moscone West, San Francisco',
    reason: "invented sample event dates/venue used as mock merge-field preview content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 228,
    text: "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run. Live demo, real failure cases, and a checklist you can apply to your own docs this week.",
    reason: "invented sample submission abstract used as mock submissions-list content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 367,
    text: "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run.",
    reason: "invented sample submission abstract used as mock submissions-list content, not a real UI caption (same row the caption ledger's own FIXTURE_EXCLUSIONS carries).",
  },
  // EXEMPLAR-ARTICLE class folded into FIXTURE (DEC-099: both are "invented
  // demo content no real screen owes", the same principle stated two ways)
  // -- the Docs frame's own sample article, 'Triaging submissions'.
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 75,
    text: 'screenshot · /admin/submissions · 1600×900 · light',
    reason: "a screenshot-block placeholder caption inside the Docs frame's own sample article ('Triaging submissions'), not a real Docs article the app renders (same row the caption ledger's own EXEMPLAR_ARTICLE_EXCLUSIONS carries).",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 185,
    text: 'screenshot · 390 · tap to zoom',
    reason: "a screenshot-block placeholder caption inside the Docs frame's own sample article ('Triaging submissions'), not a real Docs article the app renders (same row the caption ledger's own EXEMPLAR_ARTICLE_EXCLUSIONS carries).",
  },
];

function isExcluded(c: CountCaption, table: Exclusion[]): boolean {
  return table.some((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
}

const AFTER_EXCLUSION: CountCaption[] = ALL_COUNT_CAPTIONS.filter(
  (c) => !isExcluded(c, EXPLAINER_EXCLUSIONS) && !isExcluded(c, FIXTURE_EXCLUSIONS)
);

// -- Grader ---------------------------------------------------------------

const DIGIT_COLLAPSE_TOKEN = '#';

/** Collapses every run of digits to one placeholder token. Applied
 * identically to both sides of the join (task's own grader spec: "reduce
 * every run of digits on BOTH the pack side and the source side to one
 * placeholder token before comparing"). Exported so the non-vacuity
 * synthetic fixture below can drive this exact function, never a live
 * product count. */
export function digitCollapse(s: string): string {
  return s.replace(/\d+/g, DIGIT_COLLAPSE_TOKEN);
}

function normalizeCountCaption(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** True when `text`'s digit-collapsed, whitespace-collapsed form occurs as
 * a substring of some already-normalized-and-digit-collapsed source blob.
 * Exported so the non-vacuity synthetic fixture below can drive this exact
 * function, never a live product count. */
export function countCaptionIsMatched(text: string, digitCollapsedBlobs: string[]): boolean {
  const needle = digitCollapse(normalizeCountCaption(text));
  if (needle.length === 0) return false;
  return digitCollapsedBlobs.some((blob) => blob.includes(needle));
}

export const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const DIGIT_COLLAPSED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) =>
  digitCollapse(normalizeSource(readFileSync(f, 'utf-8')))
);

export const UNMATCHED: CountCaption[] = AFTER_EXCLUSION.filter(
  (c) => !countCaptionIsMatched(c.text, DIGIT_COLLAPSED_SOURCE_BLOBS)
);

// -- Cross-check against the caption ledger's own stronger grader --------
// DEC-180 wave-42 amendment: the OUT_OF_CAMPAIGN_SCOPE excuse for
// FRAME_COUNT_CAPTION_UNMATCHED_CEILING claims every row below "already
// resolves under [the caption ledger's] stronger, merge-placeholder-aware
// grader" -- but nothing ran that grader over these 113 rows until now.
// `CAPTION_LEDGER_UNMATCHED` (imported, not re-derived, per DEC-613) IS
// that ledger's own final unmatched set: population -> its six exclusion
// tables (verbatim-cited hand classifications, not a second copy of them)
// -> `captionIsMatched`'s verbatim + digit-skeleton/merge-placeholder pass
// -- exactly the computation that produces that ledger's own
// FRAME_CAPTION_UNMATCHED_CEILING = 0. A row "resolves under ITS stronger
// grader" precisely when it is NOT a member of that set.
function resolvesUnderCaptionLedger(c: CountCaption): boolean {
  return !CAPTION_LEDGER_UNMATCHED.some((u) => u.fileName === c.fileName && u.line === c.line && u.text === c.text);
}

/** Rows this ledger's own weak, digit-collapse-only grader leaves
 * unmatched AND that the caption ledger's stronger grader also fails to
 * resolve -- i.e. rows where the OUT_OF_CAMPAIGN_SCOPE excuse's premise is
 * actually false. Exported so the ratchet below is measured, not
 * asserted. */
export const UNMATCHED_BY_BOTH: CountCaption[] = UNMATCHED.filter((c) => !resolvesUnderCaptionLedger(c));

// -- Ratchet --------------------------------------------------------------
// Measured on this branch (v12m-w28-h) by forcing to -1 and reading the
// printed offender list back. See docs/design/audit/frame-count-caption-
// ledger-v12.md for the full per-row breakdown of the 16 population rows
// this task found with no pre-existing caption-ledger exclusion citation.
// DEC-180 wave-42 amendment PROVED (not merely asserted) that none of
// these 113 rows DIVERGES: `COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING` below,
// measured by forcing to -1 and reading the printed offenders back, is 0 --
// the caption ledger's own stronger, merge-placeholder-aware grader
// (imported from test/frame-caption-ledger/match.ts, never re-implemented)
// resolves every row this ledger's own weaker grader misses.
export const FRAME_COUNT_CAPTION_UNMATCHED_CEILING = 113;

// Measured on this branch (v12m-w42-e) by forcing to -1 and reading the
// printed offender list back: 0. See the module header's DEC-180 wave-42
// amendment note above `resolvesUnderCaptionLedger` for what this
// computation is. Two-sided, identical shape to every other ledger in this
// campaign.
export const COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING = 0;

describe('frame count-caption ledger (DEC-180 wave-28, v12 mobile campaign)', () => {
  it('non-vacuity: population is non-trivial and spans multiple files', () => {
    expect(ALL_COUNT_CAPTIONS.length).toBeGreaterThan(50);
    const distinctFiles = new Set(ALL_COUNT_CAPTIONS.map((c) => c.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(8);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('enumerates exactly 145 population-qualifying count captions across 13 files (vacuous-population tripwire)', () => {
    expect(designFiles().length).toBe(13);
    expect(ALL_COUNT_CAPTIONS.length).toBe(145);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population, never a live product count', () => {
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <p style="margin:0; font-size:16px; color:#3F4237">Zzy Synthetic Count Caption 42 present in the corpus below.</p>',
      '  <span style="font-size:13px; color:#565A4B">Zzy Synthetic Count Caption 99 absent from the corpus below.</span>',
      // Excluded: no digit at all.
      '  <span style="font-size:13px; color:#565A4B">Zzy Synthetic Caption with no digit at all in it, long enough.</span>',
      // Excluded by text-transform:uppercase: an eyebrow chip, not prose.
      '  <span style="font-size:13px; color:#565A4B; text-transform:uppercase">Zzy Synthetic Eyebrow 7 Not Counted At All Here</span>',
      // Excluded by the < / > containment rule: wraps further markup.
      '  <div style="color:#3F4237"><span>Zzy Synthetic Nested Markup 3 Not Counted</span></div>',
      '</div>',
    ].join('\n');

    const extracted = countCaptionsInText(fabricatedFrameText);
    const extractedTexts = extracted.map((e) => e.text);
    expect(extractedTexts).toContain('Zzy Synthetic Count Caption 42 present in the corpus below.');
    expect(extractedTexts).toContain('Zzy Synthetic Count Caption 99 absent from the corpus below.');
    expect(extractedTexts.some((t) => t.includes('no digit at all'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Eyebrow'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Nested Markup'))).toBe(false);

    const fabricatedSource = digitCollapse(
      normalizeSource(
        [
          '// this comment mentions "Zzy Synthetic Count Caption 99 absent from the corpus below." and must not satisfy it',
          'const caption = (',
          '  <p>',
          '    Zzy Synthetic Count Caption 42 present in the corpus',
          '    below.',
          '  </p>',
          ');',
        ].join('\n')
      )
    );

    expect(countCaptionIsMatched('Zzy Synthetic Count Caption 42 present in the corpus below.', [fabricatedSource])).toBe(true);
    expect(countCaptionIsMatched('Zzy Synthetic Count Caption 99 absent from the corpus below.', [fabricatedSource])).toBe(false);
  });

  it('digit-collapse join: a frame literal number matches a source composing the same skeleton from a DIFFERENT number', () => {
    const frameCaption = 'Zzy Synthetic Fixture 23 submissions have a decision and nobody has been told.';
    // The source spells a different literal digit run -- the digit-collapse
    // join must still find it (both sides collapse to the same skeleton).
    const composedSourceBlob = digitCollapse(
      normalizeSource('const msg = "Zzy Synthetic Fixture 7 submissions have a decision and nobody has been told.";')
    );
    expect(countCaptionIsMatched(frameCaption, [composedSourceBlob])).toBe(true);

    // Negative control: the WORDS differ, not just the number -- the
    // digit-collapse pass must not paper over an actual copy mismatch.
    const mismatchedBlob = digitCollapse(
      normalizeSource('const msg = "Zzy Synthetic Fixture 7 submissions are still awaiting review.";')
    );
    expect(countCaptionIsMatched(frameCaption, [mismatchedBlob])).toBe(false);
  });

  it('known-pack examples exercised directly against the real, current source corpus (grader sanity, not a population claim)', () => {
    // "23 recipients · reviewer feedback merged" (Chautauqua Comms.dc.html
    // :191) is a documented PARTIAL match: the caption ledger's own
    // COMPOSED_EXCLUSIONS records that app/src/pages/comms/PhoneDraftCard
    // .tsx renders `{draft.recipientCount} recipients` verbatim but
    // deliberately drops the "· reviewer feedback merged" provenance
    // clause (no data source for it -- fail loudly, never fabricate). A
    // digit-collapse-only join over the FULL caption text therefore
    // correctly reports no match here: the technique is honest about its
    // own limit rather than papering over a clause the app never renders.
    expect(countCaptionIsMatched('23 recipients · reviewer feedback merged', DIGIT_COLLAPSED_SOURCE_BLOBS)).toBe(false);
    // Even the reader-facing clause alone does not resolve under THIS
    // grader: PhoneDraftCard.tsx renders `{draft.recipientCount}
    // recipients` -- a JSX expression, not a literal digit -- and this
    // grader deliberately does not collapse `{...}` merge placeholders
    // (module header, clause 3). The caption ledger's own stronger grader
    // (which does collapse merge placeholders) is what resolves this row;
    // recorded here as a known non-match for THIS narrower technique, not
    // asserted to become a match.
    expect(countCaptionIsMatched('23 recipients', DIGIT_COLLAPSED_SOURCE_BLOBS)).toBe(false);

    // "speakers.csv · 214 rows" (Chautauqua Contacts.dc.html:286) is a
    // known non-match for the SAME reason: app/src/pages/contacts/
    // ImportWizard.tsx composes the row count from a live parse result, so
    // the literal "214" never appears in source; the digit-collapse
    // skeleton "speakers.csv · # rows" also fails to appear verbatim
    // because the app's own copy inserts the parsed metadata differently.
    // Recorded here as a known non-match, not asserted to become a match.
    expect(countCaptionIsMatched('speakers.csv · 214 rows', DIGIT_COLLAPSED_SOURCE_BLOBS)).toBe(false);
  });

  it('EXPLAINER exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of EXPLAINER_EXCLUSIONS) {
      const hit = ALL_COUNT_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('FIXTURE exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of FIXTURE_EXCLUSIONS) {
      const hit = ALL_COUNT_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it(
    'containment (NOT disjointness -- see module header STALENESS NOTE): every count-caption row is ALSO a member of the ' +
      "live caption-ledger population, because that ledger's own digit discriminator was retired before this DEC-180 " +
      'wave-28 amendment was authored (measured directly, 0 rows of this population are absent from ALL_CAPTIONS)',
    () => {
      const captionKeys = new Set(ALL_CAPTIONS.map((c) => `${c.fileName}:${c.line}:${c.text}`));
      const notContained = ALL_COUNT_CAPTIONS.filter((c) => !captionKeys.has(`${c.fileName}:${c.line}:${c.text}`));
      expect(notContained, JSON.stringify(notContained)).toEqual([]);
    }
  );

  it(`never exceeds FRAME_COUNT_CAPTION_UNMATCHED_CEILING (${FRAME_COUNT_CAPTION_UNMATCHED_CEILING}) unmatched count captions`, () => {
    if (UNMATCHED.length > FRAME_COUNT_CAPTION_UNMATCHED_CEILING) {
      const offenders = UNMATCHED.map((c) => `${c.fileName}:${c.line} -- "${c.text}"`);
      throw new Error(
        `${UNMATCHED.length} unmatched count captions, above the ceiling of ${FRAME_COUNT_CAPTION_UNMATCHED_CEILING}. ` +
          `FRAME_COUNT_CAPTION_UNMATCHED_CEILING may only be RAISED (a merge-train act, never a worker's edit ` +
          `mid-lane), and only once re-measured against the integrated tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(FRAME_COUNT_CAPTION_UNMATCHED_CEILING);
  });

  it(`never sits BELOW FRAME_COUNT_CAPTION_UNMATCHED_CEILING (${FRAME_COUNT_CAPTION_UNMATCHED_CEILING}) without the ceiling being lowered to match`, () => {
    if (UNMATCHED.length < FRAME_COUNT_CAPTION_UNMATCHED_CEILING) {
      throw new Error(
        `${UNMATCHED.length} unmatched count captions, below the ceiling of ${FRAME_COUNT_CAPTION_UNMATCHED_CEILING}. ` +
          `Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const FRAME_COUNT_CAPTION_UNMATCHED_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(FRAME_COUNT_CAPTION_UNMATCHED_CEILING);
  });

  // DEC-180 wave-42 amendment: run the stronger grader the
  // OUT_OF_CAMPAIGN_SCOPE excuse merely cites, over all
  // FRAME_COUNT_CAPTION_UNMATCHED_CEILING rows, instead of trusting the
  // excuse's own unverified claim.
  it(
    "every row this ledger's own weak grader misses resolves under the caption ledger's own stronger, " +
      'merge-placeholder-aware grader (DEC-180 wave-42: the OUT_OF_CAMPAIGN_SCOPE excuse, checked rather than cited)',
    () => {
      if (UNMATCHED_BY_BOTH.length > 0) {
        const offenders = UNMATCHED_BY_BOTH.map((c) => `${c.fileName}:${c.line} -- "${c.text}"`);
        throw new Error(
          `${UNMATCHED_BY_BOTH.length} count captions unmatched by BOTH this ledger's own weak grader AND the ` +
            `caption ledger's stronger grader -- the OUT_OF_CAMPAIGN_SCOPE excuse's premise is false for these rows. ` +
            `Name each individually in docs/design/audit/frame-count-caption-ledger-v12.md. Offenders:\n${offenders.join('\n')}`
        );
      }
      expect(UNMATCHED_BY_BOTH.length).toBe(0);
    }
  );

  it(`never exceeds COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING (${COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING}) doubly-unmatched count captions`, () => {
    if (UNMATCHED_BY_BOTH.length > COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING) {
      const offenders = UNMATCHED_BY_BOTH.map((c) => `${c.fileName}:${c.line} -- "${c.text}"`);
      throw new Error(
        `${UNMATCHED_BY_BOTH.length} doubly-unmatched count captions, above the ceiling of ` +
          `${COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING}. COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING may only be RAISED ` +
          `(a merge-train act, never a worker's edit mid-lane), and only once re-measured against the integrated ` +
          `tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED_BY_BOTH.length).toBeLessThanOrEqual(COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING);
  });

  it(`never sits BELOW COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING (${COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING}) without the ceiling being lowered to match`, () => {
    if (UNMATCHED_BY_BOTH.length < COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING) {
      throw new Error(
        `${UNMATCHED_BY_BOTH.length} doubly-unmatched count captions, below the ceiling of ` +
          `${COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING}. Lower the ceiling in the same commit by replacing the line:\n` +
          `  export const COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING = ${UNMATCHED_BY_BOTH.length};`
      );
    }
    expect(UNMATCHED_BY_BOTH.length).toBeGreaterThanOrEqual(COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING);
  });

  it('synthetic control: the stronger grader resolves a fabricated caption composed with a merge placeholder, and rejects one neither grader reaches', () => {
    const fabricatedSourceRaw =
      'const msg = `Zzy Synthetic Stronger Grader ${count} present in the corpus below.`;';
    const fabricatedNormalizedBlob = normalizeCaption(fabricatedSourceRaw);
    const resolvedCaption = 'Zzy Synthetic Stronger Grader 7 present in the corpus below.';
    const unresolvedCaption = 'Zzy Synthetic Stronger Grader Absent From Any Corpus At All.';
    // Resolves: the digit-skeleton + merge-placeholder collapse this
    // ledger's own weak grader deliberately omits is exactly what the
    // caption ledger's captionIsMatched supplies.
    expect(captionIsMatched(resolvedCaption, [fabricatedNormalizedBlob])).toBe(true);
    // Rejects: no digit-collapse or placeholder-collapse trick papers over
    // an actual absence.
    expect(captionIsMatched(unresolvedCaption, [fabricatedNormalizedBlob])).toBe(false);
  });

  it('a decision-registry file quoting a count caption does NOT satisfy the ledger (DEC-967 sighting shape, DEC-613)', () => {
    // enumerateSourceFiles (imported from frame-source-corpus.ts) already
    // excludes src/decisions-data/** and src/decisions.ts via its own
    // isDecisionRegistryFile predicate -- this is a regression guard that
    // the exclusion is actually wired through this file's SOURCE_FILES,
    // not merely present in the imported module.
    const decisionsFiles = SOURCE_FILES.filter((f) => f.includes(`${'decisions-data'}`) || f.endsWith(`${'decisions.ts'}`));
    expect(decisionsFiles, JSON.stringify(decisionsFiles)).toEqual([]);
  });

  // stripComments is imported and re-exercised here (not re-implemented)
  // so a change to frame-source-corpus.ts's comment-stripping behaviour is
  // visible from this ledger's own suite too.
  it('imported stripComments never mistakes a "//" inside a string literal for a real comment opener', () => {
    const src = "const url = 'https://example.com/23-things';";
    expect(stripComments(src)).toBe(src);
  });
});
