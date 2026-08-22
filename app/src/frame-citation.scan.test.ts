// Frame-citation contract (DEC-976 amendment, wave 23; DEC-808). DEC-976's
// amendment rules that every `docs/design/*.dc.html:<line>` reference in an
// app/src or src comment must be immediately followed, in the same
// comment, by the cited line's literal declaration in backticks -- the
// quote is the receipt: a reader comparing the rule below to the quote
// beside it needs no second file open, and a frame edit that moves a line
// breaks the quote instead of silently rotting the number.
//
// This scan asserts quote PRESENCE and frame-TRUTH only, per DEC-976's own
// text -- it deliberately does NOT assert the neighbouring CSS/copy equals
// the quote (that comparison is the auditor's judgment; a rule may
// legitimately differ from a frame under a recorded ruling, and forcing
// equality would turn the scan into a rubber stamp):
//
//   1) a backticked literal follows every citation, within the same
//      comment;
//   2) that literal appears verbatim (whitespace-normalised) at the
//      cited line of the named frame file under docs/design/.
//
// Enumeration (DEC-808): readdirSync over app/src and src -- never a
// hand-listed manifest of "the files with citations", which desyncs the
// moment a citation is added or moved. The one non-manifest scoping rule
// this test applies (mirrored from the task that landed it, w23-e) is
// structural, not a list of names: every *.css file under app/src, and
// every *.ts/*.tsx file under src, excluding *.test.ts/*.test.tsx (test
// files are not held to the citation contract, mirroring
// css-contract.scan.test.ts's own *.test.tsx exclusion for invariant C/D).
//
// Matching is done against a WHITESPACE-FLATTENED copy of each file (all
// runs of whitespace, and any jsdoc `* `/line-comment `// ` continuation
// marker at a line start, collapsed to one space) so a citation or its
// quote that a house wrapped across a comment's line width -- e.g. a frame
// name split "Chautauqua Public and\n * Portal.dc.html" -- is still found;
// this is a house convention (long comments wrap), never itself asserted.
//
// CONTENTION DECOMPOSITION (no behaviour change): this file was 1038 lines
// and a recurring merge-conflict hotspot. Its path/enumeration/citation
// matching helpers now live in ./frame-citation-core, its phone/desktop
// frame-extent helpers in ./frame-citation-frames, and its receipt-checking
// logic (quote+expect / helper-credit / header-block exemption) in
// ./frame-citation-receipts -- each re-exported here where a symbol is used
// so every describe/it block below reads exactly as before. The ratchet
// ceiling constants (UNRECEIPTED_CLAIM_CEILING,
// DESKTOP_UNRECEIPTED_CLAIM_CEILING, HEADER_SCOPE_WITHOUT_RECEIPT_CEILING,
// DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING) stay declared in THIS
// *.test.ts file deliberately: scripts/exit-predicate.ts's
// findCampaignCeilingCandidates only scans `*.test.ts(x)` files for
// `const <NAME>_CEILING = <integer>;` declarations, so moving a graded
// ceiling into a non-test module would make it invisible to the campaign
// scoreboard.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APP_SRC,
  enumerateFiles,
  enumerateTestFiles,
  findCitations,
  flatten,
  frameLines,
  lineNumberAt,
  locateSourceIndex,
  normalise,
  quoteAfter,
  relative,
  REPO_ROOT,
  SRC_ROOT,
  TEST_DIR_ROOT,
} from './frame-citation-core';
import {
  ALL_DESKTOP_FRAME_EXTENTS,
  ALL_FRAME_EXTENTS,
  isInsideADesktopFrame,
  isInsideAPhoneFrame,
} from './frame-citation-frames';
import {
  computeHeaderScopeWithoutReceiptOffenders,
  computeUnreceiptedCitations,
  EXPECT_PROXIMITY_LINES,
  helperNamesFor,
  isHeaderBlockCitation,
  type TestPhoneCitation,
} from './frame-citation-receipts';

const TARGET_FILES = [
  ...enumerateFiles(APP_SRC, ['.css']),
  ...enumerateFiles(SRC_ROOT, ['.ts', '.tsx']),
];

interface Scanned {
  file: string;
  frameFile: string;
  firstLine: number;
  matchText: string;
  index: number;
  flat: string;
}

const ALL_CITATIONS: Scanned[] = TARGET_FILES.flatMap((file) => {
  const relPath = relative(REPO_ROOT, file);
  const flat = flatten(readFileSync(file, 'utf-8'));
  return findCitations(relPath, flat).map((c) => ({ ...c, flat }));
});

describe('frame-citation contract (DEC-976 amendment wave 23, DEC-808)', () => {
  it('enumeration finds citations to check (guards against a silently-empty scan)', () => {
    expect(ALL_CITATIONS.length).toBeGreaterThanOrEqual(23);
  });

  it('every citation is immediately followed, in the same comment, by a backtick-quoted literal', () => {
    const missing = ALL_CITATIONS.filter((c) => {
      const quote = quoteAfter(c.flat, c.index);
      return !quote || quote.length === 0;
    }).map((c) => `${c.file}: "${c.matchText}" has no backtick-quoted literal following it`);
    expect(missing).toEqual([]);
  });

  it('every quoted literal appears verbatim (whitespace-normalised) at its cited frame line', () => {
    const mismatches: string[] = [];
    for (const c of ALL_CITATIONS) {
      const quote = quoteAfter(c.flat, c.index);
      if (!quote) continue; // reported by the presence test above
      const lines = frameLines(c.frameFile);
      const frameLine = lines[c.firstLine - 1];
      if (frameLine === undefined) {
        mismatches.push(
          `${c.file}: "${c.matchText}" cites ${c.frameFile}:${c.firstLine}, which does not exist in that frame`
        );
        continue;
      }
      if (!normalise(frameLine).includes(normalise(quote))) {
        mismatches.push(
          `${c.file}: quote \`${quote}\` for "${c.matchText}" does not appear verbatim at ${c.frameFile}:${c.firstLine} (frame line: "${frameLine.trim()}")`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DEC-976 wave-87 amendment (task w5-j): "the claim receipt becomes
// executable over test files". Wave 86's amendment ruled that a claim is
// three things in one place -- a strict citation landing inside a phone
// frame's extent, the cited line's literal quoted verbatim in backticks
// beside it, and a real assertion beneath pinning what that literal
// declares -- and left it enforced by nothing but each worker's care. This
// block makes the full three-part contract executable for *.test.ts /
// *.test.tsx files under test/ and app/src/, reusing this file's own
// STRICT_RE (via findCitations) and flatten rather than re-implementing
// either (a second copy of a citation vocabulary is a trap with a delay
// fuse, field guide DEC-613) -- and never touching
// test/phone-frame-ledger.scan.test.ts, which owns CLAIMED_FLOOR and is
// in flight under other lanes this wave.
// ---------------------------------------------------------------------------

const TEST_TARGET_FILES = [...enumerateTestFiles(TEST_DIR_ROOT), ...enumerateTestFiles(APP_SRC)];

const TEST_PHONE_CITATIONS: TestPhoneCitation[] = [];
for (const file of TEST_TARGET_FILES) {
  const relPath = relative(REPO_ROOT, file);
  const raw = readFileSync(file, 'utf-8');
  const flat = flatten(raw);
  const citations = findCitations(relPath, flat).filter((c) => isInsideAPhoneFrame(c.frameFile, c.firstLine));
  let cursor = 0;
  for (const c of citations) {
    const idx = locateSourceIndex(raw, c.matchText, cursor);
    cursor = idx + c.matchText.length;
    TEST_PHONE_CITATIONS.push({ ...c, flat, raw, sourceLine: lineNumberAt(raw, idx) });
  }
}

/** Ratchet ceiling (DEC-976 wave-87 amendment): the count of test-file
 * phone-frame citations that are NOT fully receipted (missing either the
 * backtick quote or a nearby `expect(`), measured on this branch. This is a
 * CEILING on debt, not a floor on coverage (mirror of CLAIMED_FLOOR in
 * test/phone-frame-ledger.scan.test.ts, which this file never touches): it
 * may only be LOWERED as unreceipted claims get fixed, never raised to
 * paper over a regression, and this task does not fix other lanes' test
 * files to force it down -- honest debt beats a green scan that hides it.
 *
 * Lowered 14 -> 2 by the wave-107 merge train (DEC-385 wave-93 rules this
 * constant merge-train-only), re-measured on the integrated tree per DEC-989
 * clause a rather than copied from any branch's note. Lowered 2 -> 0 by
 * task w5-r (DEC-976 wave-109 amendment): fixed this file's own negative
 * control (was anchored on a real frame path), tightened the proximity of
 * one describe block's citation, and re-measured -- the other two named
 * offenders in the ImportWizard phoneColumns test were already receipted
 * on this main SHA (fixed upstream between the wave-109 report and this
 * task). The two-sided companion at the bottom of this file is what forced
 * the tightening. */
const UNRECEIPTED_CLAIM_CEILING = 0;

/** Ratchet ceiling (task w14-a companion, DEC-808's header-block exemption
 * pay-for-it rule): the count of (file, frameFile) pairs where the file
 * carries a header-block scope citation into that frame but no fully-
 * receipted (non-header) citation into the same frame elsewhere in the
 * file. Seeded at 22, measured on THIS branch (DEC-989 clause a) by running
 * the scan, not invented as 0 -- this task adds the check but does not fix
 * any of these 22 files' bodies (out of this task's stated scope, which is
 * computeUnreceiptedCitations plus new helpers/controls only). May only be
 * LOWERED as offenders get fixed, never raised to paper over a regression.
 *
 * Lowered 22 -> 8 by task w17-f (DEC-998 wave-17, Content cluster, sole
 * owner of this constant this wave): fixed this worktree's two owned
 * offenders (FilesLibrary.frame390.render.test.tsx,
 * FilesLibrary.session-size-fuse.receipt.render.test.tsx), each by adding a
 * genuine in-body citation into Chautauqua Content.dc.html (backtick literal
 * read verbatim from the frame line, receipted by a nearby expect( / a
 * qualifying verbatimLine helper call), then re-ran this scan forced to -1
 * and measured the remaining population directly rather than assuming 22-2.
 * Per DEC-998 wave-17 clause (b), only what this worktree measured and fixed
 * is landed here -- the other 8 measured offenders (PhoneAgenda.clash390,
 * PhoneAgenda.clashMove390, PlanEditor.frame390, ReviewerQueue.hub390-frame,
 * Scorecard.unscored390, SettingsDrill.publicPages390,
 * SettingsDrill.savedEmbeds390, cfp-stored-label-register) belong to sibling
 * lanes v12m-w17-c/d/e; the merge train re-seeds this constant to the
 * batch-measured truth (forced to -1, offender list read fresh) once those
 * lanes land, rather than trusting any branch's own note. */
const HEADER_SCOPE_WITHOUT_RECEIPT_CEILING = 8;

describe('test-file claims are receipted: quote + nearby expect() (DEC-976 wave-87 amendment, task w5-j)', () => {
  it('the test-file phone-frame citation population is non-empty and contains a known-good example', () => {
    expect(TEST_PHONE_CITATIONS.length).toBeGreaterThan(0);
    // app/src/phone-page-scaffold.test.ts:116 cites
    // `docs/design/Chautauqua Speakers.dc.html:261` inside a comment that
    // also carries a backtick-quoted literal, followed within
    // EXPECT_PROXIMITY_LINES by a real `expect(` -- a fully-receipted claim,
    // confirmed against the measured tree before this test was written.
    const known = TEST_PHONE_CITATIONS.some(
      (c) =>
        c.file === 'app/src/phone-page-scaffold.test.ts' &&
        c.sourceLine === 116 &&
        c.frameFile === 'Chautauqua Speakers.dc.html' &&
        c.firstLine === 261
    );
    expect(known).toBe(true);
  });

  it(`every test-file phone-frame citation is receipted: a backtick quote in the same comment, and a real expect( within ${EXPECT_PROXIMITY_LINES} source lines beneath it (ceiling: UNRECEIPTED_CLAIM_CEILING, may only be lowered)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_PHONE_CITATIONS);
    if (unreceipted.length > UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `${unreceipted.length} test-file phone-frame citations are unreceipted, above the ratchet ` +
          `ceiling of ${UNRECEIPTED_CLAIM_CEILING} (UNRECEIPTED_CLAIM_CEILING may only be LOWERED, ` +
          `never raised to paper over a regression):\n${unreceipted.join('\n')}`
      );
    }
    expect(unreceipted.length).toBeLessThanOrEqual(UNRECEIPTED_CLAIM_CEILING);
  });

  it(`every file's header-block scope citation into a phone frame is paid for by at least one fully-receipted citation into the same frame elsewhere in the file (ceiling: HEADER_SCOPE_WITHOUT_RECEIPT_CEILING, may only be lowered)`, () => {
    const offenders = computeHeaderScopeWithoutReceiptOffenders(TEST_PHONE_CITATIONS);
    if (offenders.length > HEADER_SCOPE_WITHOUT_RECEIPT_CEILING) {
      throw new Error(
        `${offenders.length} files declare header-block phone-frame scope with no receipted citation to pay for it, ` +
          `above the ratchet ceiling of ${HEADER_SCOPE_WITHOUT_RECEIPT_CEILING} (may only be LOWERED, ` +
          `never raised to paper over a regression):\n${offenders.join('\n')}`
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(HEADER_SCOPE_WITHOUT_RECEIPT_CEILING);
  });
});

// ---------------------------------------------------------------------------
// DEC-808 wave-107 amendment (task w3-v): a symmetric DESKTOP receipt
// population. The two describe blocks above (wave-23 file-level receipts and
// wave-87's test-file phone-frame receipts) only ever checked PHONE claims;
// the wave-107 planner amendment to DEC-808 measured that 64 desktop frames
// are claimed today (99 once the in-flight w4-k/w5-a..e lanes land) with NO
// receipt population checking them at all -- the desktop ledger
// (test/desktop-frame-ledger.scan.test.ts) only asserts a claiming citation
// RESOLVES to a real line, never that it carries a quote or a nearby
// `expect(`. This block closes that gap for test-file citations, reusing
// this file's own `findCitations`, `flatten`, `quoteAfter`,
// `locateSourceIndex`, `lineNumberAt` and the `computeUnreceiptedCitations`
// helper (now in ./frame-citation-receipts) rather than re-implementing any
// of them (DEC-613).
// ---------------------------------------------------------------------------

const TEST_DESKTOP_CITATIONS: TestPhoneCitation[] = [];
for (const file of TEST_TARGET_FILES) {
  const relPath = relative(REPO_ROOT, file);
  const raw = readFileSync(file, 'utf-8');
  const flat = flatten(raw);
  const citations = findCitations(relPath, flat).filter((c) => isInsideADesktopFrame(c.frameFile, c.firstLine));
  let cursor = 0;
  for (const c of citations) {
    const idx = locateSourceIndex(raw, c.matchText, cursor);
    cursor = idx + c.matchText.length;
    TEST_DESKTOP_CITATIONS.push({ ...c, flat, raw, sourceLine: lineNumberAt(raw, idx) });
  }
}

/** Ratchet ceiling, mirroring UNRECEIPTED_CLAIM_CEILING's own contract
 * exactly, for the desktop half: the count of test-file desktop-frame
 * citations that are NOT fully receipted, measured on THIS branch by
 * running the scan (never copied from an audit doc, DEC-989 clause a). A
 * ceiling on debt, not a floor on coverage -- may only be LOWERED as
 * unreceipted claims get fixed, never raised to paper over a regression.
 * This task does not fix other lanes' test files to force it down.
 *
 * Lowered 15 -> 10 (2026-08-20, task w12-t, DEC-989): fixed this branch's
 * five app/src-half offenders (App.render.test.tsx:281,
 * Speakers.render.test.tsx:119/138, RecentSends.render.test.tsx:133,
 * ContactsTable.render.test.tsx:198/203, select-caret.scan.test.ts:4) by
 * relocating each frame-citation comment to sit within
 * EXPECT_PROXIMITY_LINES of the `expect(` that already receipts its
 * claim (never re-pointing or shortening a citation, DEC-967), and adding
 * a missing backtick quote where the original relied on an incidental
 * template-literal backtick that moved out of range. The remaining 10
 * offenders are all under test/** (companion lane w12-s's half) and are
 * untouched by this task; the merge train re-measures the integrated
 * value per DEC-989 clause a.
 *
 * Lowered 15 -> 5 by task w12-s (2026-08-20, DEC-976 wave-123 amendment):
 * fixed all 10 `test/**` offenders by moving each citation's proof
 * (`expect(`) into EXPECT_PROXIMITY_LINES of its own citation line, never
 * re-pointing or weakening an assertion. The 5 remaining offenders are all
 * under `app/src/**` (App.render.test.tsx, Speakers.render.test.tsx,
 * RecentSends.render.test.tsx, ContactsTable.render.test.tsx,
 * select-caret.scan.test.ts) -- lane w12-t's half, re-measured on this
 * branch per DEC-989 clause a, not copied from any audit doc.
 *
 * Thunderdome megabatch (wave 123): lanes w12-t and w12-s drained exactly
 * complementary halves of this population (5 under app/src/**, 10 under
 * test/**) and landed in one pass, so the integrated tree has none left.
 * Re-measured here on the merged tree, not copied from either branch.
 * This ratchet may only fall. */
const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 0;

/** Ratchet ceiling, desktop half of HEADER_SCOPE_WITHOUT_RECEIPT_CEILING's
 * own contract exactly (task w14-a companion). Seeded at 2, measured on
 * THIS branch, not invented as 0 -- may only be LOWERED, never raised to
 * paper over a regression.
 *
 * Lowered 2 -> 0 (task w17-e, DEC-998 wave-17): the sole desktop offender,
 * app/src/pages/settings/PortalSettingsPanel.welcome-edit.render.test.tsx,
 * now carries a fully-receipted in-body citation into
 * `Chautauqua Settings.dc.html:906` (backtick-quoted literal + a real
 * `expect(` within EXPECT_PROXIMITY_LINES), paying for its header-block
 * scope citation at :2. Re-measured on this branch by forcing the
 * constant to -1 and reading the offender list, not copied from any
 * audit doc (DEC-989 clause a). */
const DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING = 0;

describe('test-file DESKTOP-frame claims are receipted: quote + nearby expect() (DEC-808 wave-107, task w3-v)', () => {
  it('the test-file desktop-frame citation population is non-empty (guards against a silently-empty scan)', () => {
    expect(TEST_DESKTOP_CITATIONS.length).toBeGreaterThan(0);
  });

  it(`every test-file desktop-frame citation is receipted: a backtick quote in the same comment, and a real expect( within ${EXPECT_PROXIMITY_LINES} source lines beneath it (ceiling: DESKTOP_UNRECEIPTED_CLAIM_CEILING, may only be lowered)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_DESKTOP_CITATIONS);
    if (unreceipted.length > DESKTOP_UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `${unreceipted.length} test-file desktop-frame citations are unreceipted, above the ratchet ` +
          `ceiling of ${DESKTOP_UNRECEIPTED_CLAIM_CEILING} (DESKTOP_UNRECEIPTED_CLAIM_CEILING may only ` +
          `be LOWERED, never raised to paper over a regression):\n${unreceipted.join('\n')}`
      );
    }
    expect(unreceipted.length).toBeLessThanOrEqual(DESKTOP_UNRECEIPTED_CLAIM_CEILING);
  });

  // Two-sided companion (DEC-808 wave-106's requirement that every campaign
  // ratchet gets one): FAILS when the measured count falls BELOW the
  // constant, so a stale ceiling that's higher than reality cannot survive a
  // wave that fixes desktop-receipt debt. DESKTOP_UNRECEIPTED_CLAIM_CEILING
  // was lowered 28 -> 23 by task w5-s (DEC-976 wave-109 amendment), which
  // added the missing backtick receipt to the 17 citations that had none --
  // 5 of those 17 became fully receipted (a nearby expect( was already
  // present), the other 12 remain unreceipted for the separate "no expect(
  // within 6 lines" reason, out of this task's scope. Re-measured on THIS
  // branch (DEC-989 clause a), so this companion is expected GREEN today
  // (measured 23, ceiling 23) -- unlike UNRECEIPTED_CLAIM_CEILING's own
  // companion below, which is deliberately red because that constant is
  // DEC-385 wave-93 merge-train-only and this task does not edit it.
  it(`never measures FEWER unreceipted desktop-frame citations than DESKTOP_UNRECEIPTED_CLAIM_CEILING (${DESKTOP_UNRECEIPTED_CLAIM_CEILING}) without the ceiling being lowered to match (a stale ceiling hides fixed debt)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_DESKTOP_CITATIONS);
    if (unreceipted.length < DESKTOP_UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `measured ${unreceipted.length} unreceipted test-file desktop-frame citations, below the ` +
          `ratchet ceiling of ${DESKTOP_UNRECEIPTED_CLAIM_CEILING}. This is the ratchet working -- debt ` +
          `got fixed. Lower the ceiling by replacing the line:\n` +
          `  const DESKTOP_UNRECEIPTED_CLAIM_CEILING = ${unreceipted.length};`
      );
    }
    expect(unreceipted.length).toBeGreaterThanOrEqual(DESKTOP_UNRECEIPTED_CLAIM_CEILING);
  });

  it(`every file's header-block scope citation into a desktop frame is paid for by at least one fully-receipted citation into the same frame elsewhere in the file (ceiling: DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING, may only be lowered)`, () => {
    const offenders = computeHeaderScopeWithoutReceiptOffenders(TEST_DESKTOP_CITATIONS);
    if (offenders.length > DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING) {
      throw new Error(
        `${offenders.length} files declare header-block desktop-frame scope with no receipted citation to pay for it, ` +
          `above the ratchet ceiling of ${DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING} (may only be LOWERED, ` +
          `never raised to paper over a regression):\n${offenders.join('\n')}`
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING);
  });
});

// Two-sided companion for UNRECEIPTED_CLAIM_CEILING (the PHONE ceiling
// above), which DEC-808 wave-106 requires of every campaign ratchet but
// which the wave-87 amendment never added. FAILS when the measured count
// falls BELOW the constant, printing the exact replacement line -- mirroring
// desktop-frame-ledger.scan.test.ts's own CLAIMED_FLOOR "never claims MORE"
// companion in shape (a two-sided ratchet, not a one-way floor).
//
// This companion was born RED on task w3-v's branch: it measured 2
// unreceipted phone-frame citations against a constant of 14 that wave-87
// had seeded and that other branches' fixes had since made stale. Because
// DEC-385 wave-93 rules UNRECEIPTED_CLAIM_CEILING a merge-train-only edit,
// w3-v added the companion but left the constant alone, and the wave-107
// merge train re-measured on the integrated tree (still 2, per DEC-989
// clause a -- re-derived, not copied) and lowered 14 -> 2. Both sides now
// sit at the measured value, so this is GREEN and the phone ceiling is
// honest again, matching the desktop pair above.
describe('UNRECEIPTED_CLAIM_CEILING companion (two-sided ratchet, DEC-808 wave-106 requirement)', () => {
  it(`never measures FEWER unreceipted phone-frame citations than UNRECEIPTED_CLAIM_CEILING (${UNRECEIPTED_CLAIM_CEILING}) without the ceiling being lowered to match by the merge train (a stale ceiling hides fixed debt)`, () => {
    const unreceipted = computeUnreceiptedCitations(TEST_PHONE_CITATIONS);
    if (unreceipted.length < UNRECEIPTED_CLAIM_CEILING) {
      throw new Error(
        `measured ${unreceipted.length} unreceipted test-file phone-frame citations, below the ` +
          `ratchet ceiling of ${UNRECEIPTED_CLAIM_CEILING}. This is the ratchet working -- debt got ` +
          `fixed. The merge train (not a worker mid-lane, DEC-385 wave-93) should lower the ceiling ` +
          `by replacing the line:\n  const UNRECEIPTED_CLAIM_CEILING = ${unreceipted.length};`
      );
    }
    expect(unreceipted.length).toBeGreaterThanOrEqual(UNRECEIPTED_CLAIM_CEILING);
  });
});

// Synthetic controls (DEC-808 wave-107, task w3-v item 3): run the receipt
// logic itself through this file's own `flatten`/`findCitations`/
// `quoteAfter` helpers (never a re-implementation) against small fixture
// strings, so the receipt rule's two failure modes -- missing quote, and
// quote-present-but-no-nearby-expect -- are each independently confirmed to
// fire (negative control) and independently confirmed NOT to fire when the
// citation is fully receipted (positive control).
/** Builds a synthetic citation-plus-sourceLine object from a fixture's raw
 * source, reusing this file's own findCitations/flatten/locateSourceIndex/
 * lineNumberAt (DEC-613: never a second copy of this file's own citation
 * vocabulary, even for its own fixtures). Assumes exactly one citation in
 * the fixture; multi-citation fixtures build their own list inline (see
 * below) the same way ALL_CITATIONS/TEST_PHONE_CITATIONS do. */
function syntheticCitation(file: string, raw: string): TestPhoneCitation {
  const flat = flatten(raw);
  const [citation] = findCitations(file, flat);
  if (!citation) throw new Error(`fixture for ${file} carries no findable citation`);
  const idx = locateSourceIndex(raw, citation.matchText, 0);
  return { ...citation, flat, raw, sourceLine: lineNumberAt(raw, idx) };
}

describe('receipt-checking synthetic controls (positive/negative, DEC-808 wave-107, task w3-v)', () => {
  it('flags a citation with no following backtick quote at all (negative control)', () => {
    // DEC-976 wave-109 amendment (task w5-r): this fixture must NOT use a real
    // frame path -- a synthetic sentinel anchored on a real artefact joins the
    // population the scan exists to police (field guide, wave-107/108). The
    // fixture filename below deliberately names a frame that does not exist
    // in docs/design/, so this control still exercises the missing-quote
    // branch without resolving to any real citation.
    const src = 'see docs/design/Chautauqua Fixture.dc.html:261 for the rule, no quote follows this at all';
    const flat = flatten(src);
    const [citation] = findCitations('fixture.ts', flat);
    expect(citation).toBeDefined();
    const quote = quoteAfter(flat, citation!.index);
    expect(quote === null || quote.length === 0).toBe(true);
  });

  it('does not flag a citation with a quote AND a nearby expect( (positive control)', () => {
    const src = [
      '// docs/design/Chautauqua Speakers.dc.html:261 `.chq-speaker-name{font-weight:600}`',
      'expect(el).toHaveStyle("font-weight:600");',
    ].join('\n');
    const flat = flatten(src);
    const [citation] = findCitations('fixture.ts', flat);
    expect(citation).toBeDefined();
    const quote = quoteAfter(flat, citation!.index);
    expect(quote).toBe('.chq-speaker-name{font-weight:600}');
    expect(quote === null || quote.length === 0).toBe(false);
    const rawLines = src.split('\n');
    const window = rawLines.slice(0, EXPECT_PROXIMITY_LINES);
    expect(window.some((l) => l.includes('expect('))).toBe(true);
  });

  // Task w14-a controls: the frame-verbatim helper credit and the
  // header-block exemption plus its companion. Each fixture reuses this
  // file's own findCitations/flatten/locateSourceIndex/lineNumberAt (DEC-613)
  // via `syntheticCitation` below, and -- per the negative control above --
  // never anchors on a real frame path.

  it('credits a qualifying frame-verbatim helper call with the correct cited line as fully receipted, even with no backtick quote at all (positive control)', () => {
    const raw = [
      'function verbatimLine(lineNo, literal) {',
      '  const lines = readFileSync(join("docs", "design", "Chautauqua Fixture.dc.html"), "utf-8").split("\\n");',
      '  const line = lines[lineNo - 1];',
      '  expect(line).toBe(literal);',
      '}',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:261 no quote follows this comment at all',
      '    verbatimLine(261, "whatever the frame says");',
      '  });',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-helper-credit.ts', raw);
    expect(helperNamesFor(citation.raw).has('verbatimLine')).toBe(true);
    expect(computeUnreceiptedCitations([citation])).toEqual([]);
  });

  it('does NOT credit a qualifying helper called with the WRONG line number (negative control)', () => {
    const raw = [
      'function verbatimLine(lineNo, literal) {',
      '  const lines = readFileSync(join("docs", "design", "Chautauqua Fixture.dc.html"), "utf-8").split("\\n");',
      '  const line = lines[lineNo - 1];',
      '  expect(line).toBe(literal);',
      '}',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:261 no quote follows this comment at all',
      '    verbatimLine(999, "whatever the frame says");',
      '  });',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-wrong-line.ts', raw);
    expect(computeUnreceiptedCitations([citation])).toEqual([
      `${citation.file}:${citation.sourceLine} — ${citation.matchText} (no backtick-quoted literal)`,
    ]);
  });

  it('does NOT credit a same-named helper whose body never reads the design file (negative control -- DEC-180: shape, not name)', () => {
    const raw = [
      'function verbatimLine(lineNo, literal) {',
      '  const line = SOME_OTHER_ARRAY[lineNo - 1];',
      '  expect(line).toBe(literal);',
      '}',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:261 no quote follows this comment at all',
      '    verbatimLine(261, "whatever the frame says");',
      '  });',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-non-reading-helper.ts', raw);
    expect(helperNamesFor(citation.raw).size).toBe(0);
    expect(computeUnreceiptedCitations([citation])).toEqual([
      `${citation.file}:${citation.sourceLine} — ${citation.matchText} (no backtick-quoted literal)`,
    ]);
  });

  it("exempts a header-block citation (above the file's first describe()) from the receipt check", () => {
    const raw = [
      '// docs/design/Chautauqua Fixture.dc.html:261 scope header, no quote, no expect(',
      '',
      'describe("x", () => {',
      '  it("y", () => {});',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-header-only.ts', raw);
    expect(isHeaderBlockCitation(citation)).toBe(true);
    expect(computeUnreceiptedCitations([citation])).toEqual([]);
  });

  it("flags a header-block citation whose file carries no OTHER receipted citation into the same frame (the exemption's companion)", () => {
    const raw = [
      '// docs/design/Chautauqua Fixture.dc.html:261 scope header, no quote, no expect(',
      '',
      'describe("x", () => {',
      '  it("y", () => {});',
      '});',
    ].join('\n');
    const citation = syntheticCitation('fixture-header-unpaid.ts', raw);
    expect(computeHeaderScopeWithoutReceiptOffenders([citation])).toEqual([
      `${citation.file} declares header-block scope into ${citation.frameFile} but carries no fully-receipted (non-header) citation into it`,
    ]);
  });

  it('does NOT flag a header-block citation whose file also carries a fully-receipted citation into the same frame elsewhere', () => {
    const raw = [
      '// docs/design/Chautauqua Fixture.dc.html:261 scope header, no quote, no expect(',
      '',
      'describe("x", () => {',
      '  it("y", () => {',
      '    // docs/design/Chautauqua Fixture.dc.html:300 `.chq-fixture{color:#000}`',
      '    expect(el).toHaveStyle("color:#000");',
      '  });',
      '});',
    ].join('\n');
    const flat = flatten(raw);
    const citations = findCitations('fixture-header-paid.ts', flat);
    expect(citations.length).toBe(2);
    let cursor = 0;
    const withSource = citations.map((c) => {
      const idx = locateSourceIndex(raw, c.matchText, cursor);
      cursor = idx + c.matchText.length;
      return { ...c, flat, raw, sourceLine: lineNumberAt(raw, idx) };
    });
    expect(withSource.some(isHeaderBlockCitation)).toBe(true);
    expect(computeHeaderScopeWithoutReceiptOffenders(withSource)).toEqual([]);
  });
});

// Guard: the phone/desktop frame-extent populations imported from
// ./frame-citation-frames are non-empty, so a future refactor that breaks
// the DESIGN_ROOT path math in that sibling module fails loudly here rather
// than silently emptying both TEST_PHONE_CITATIONS and TEST_DESKTOP_CITATIONS
// (which would make every ceiling above vacuously pass at 0).
describe('frame-extent populations imported from ./frame-citation-frames are non-empty', () => {
  it('phone frame extents are non-empty', () => {
    expect(ALL_FRAME_EXTENTS.length).toBeGreaterThan(0);
  });
  it('desktop frame extents are non-empty', () => {
    expect(ALL_DESKTOP_FRAME_EXTENTS.length).toBeGreaterThan(0);
  });
});
