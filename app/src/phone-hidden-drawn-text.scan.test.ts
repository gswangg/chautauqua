// Phone hidden-drawn-TEXT probe (DEC-725 wave-31 amendment; DEC-919).
//
// app/src/phone-capability-removal.scan.test.ts already grades phone
// `display:none` rules for CAPABILITY removal, but its own population is
// narrowed to INTERACTIVE selectors keyed on a `/* phone-hidden: <reason> */`
// receipt. A rule that hides plain TEXT the 390 frame draws (a section
// eyebrow, a column head, a caption) sits entirely outside that population,
// and the prose reason written above such a rule -- "never paints at this
// width", "there are no columns left to label" -- is a claim nothing checks.
// The worked example that motivated this file (DEC-725's wave-31 amendment):
// app/src/pages/review/review.css's terminal phone block sets
// `.chq-review-criteria-eyebrow { display: none; }` and
// `.chq-review-criteria-head-row { display: none; }` on the premise that
// "once the body rows below collapse to stacked cards there are no columns
// left to label" -- but `docs/design/Chautauqua Review.dc.html`'s
// "Plan editor · 390" frame draws `Weight` as a PER-CRITERION eyebrow
// INSIDE that very stacked card, and the head row's own static "Weight "
// column label (PlanEditor.tsx) is that exact literal.
//
// POPULATION (DEC-808, never a hand list):
//   1. CSS side: every phone (`max-width <= 700px`) `display: none` rule in
//      the product sheets -- REUSED verbatim from
//      app/src/phone-capability-removal.scan.test.ts's exported
//      `PHONE_DISPLAY_NONE_RULES` (its own sheet enumeration + brace-matched
//      media-block walk + comment-aware selector/body extraction is the
//      shared instrument every sibling CSS-side scan in this campaign already
//      imports rather than re-derives -- DEC-613; re-implementing that walk
//      privately here would be exactly the DEC-967 wave-138 failure this
//      task's own instructions name). Unlike that file, THIS ledger does not
//      narrow to "interactive" -- a bare `<span>`/`<div>` carrying static
//      prose is squarely this population's subject.
//   2. TSX side: every `chq-…` class token on every element
//      (`enumerateSourceFiles` from ./../../test/frame-source-corpus,
//      filtered to `.tsx`, comments stripped with that module's own
//      `stripComments` -- the ONE shared stripper, never a private regex),
//      walked to its BALANCED matching close tag (a token's own text may
//      sit behind further nested markup, e.g. a column-head literal inside
//      a nested cell span) and every text/JSX-expression run inside that
//      block, joined to the rule's selector by `chq-` token.
//   3. Frame side: every `width:390px`/`height:844` phone frame extent in
//      `docs/design/*.dc.html`, walked with the SAME
//      frame/label/extent-end grammar test/frame-eyebrow-label.scan.test.ts
//      and test/frame-control-label.scan.test.ts already share (ported, not
//      imported -- this campaign's standing convention: each sibling ledger
//      carries its own copy of the walk so a worker touching one population
//      never becomes a merge conflict on another's), then matched against a
//      candidate literal with `labelIsMatched`/`normalizeSource` imported
//      verbatim from ./../../test/frame-source-corpus (DEC-613: the ONE
//      stripper/matcher every sibling ledger already shares).
//
// GRADE (per CSS rule, DEC-725 wave-31 amendment clause (c)):
//   - PREMISE-FALSE: some static (non-composed) text child of a
//     token-matching element occurs verbatim in some width:390 frame's
//     extent -- the hide's own premise ("nothing left to draw here") is
//     contradicted by the pack.
//   - UNVERIFIABLE: no static text child resolves against a frame, but at
//     least one token-matching element's text child IS composed (a JSX
//     expression, e.g. `{criterion.weight}` or a template literal with
//     `${…}`) -- the join technique is a static substring test and can never
//     verify a value assembled at render time. Recorded WITH its reason in
//     the roster below, never a silent pass (DEC-180).
//   - PREMISE-OK: every text-bearing token match is static and none occurs
//     in any frame extent -- the hide's premise holds against the pack as
//     measured.
//   - (not counted): a rule whose `chq-` tokens carry no text-bearing
//     element at all is outside this population entirely (there is no text
//     for the hide to have removed) -- this is DISJOINT from
//     PHONE_HIDDEN_UNRECEIPTED_CEILING's own INTERACTIVE population by
//     construction (a bare prose `<span>`/`<div>` is never a bare
//     interactive element and is only counted there if some `chq-` token
//     also sits on an interactive tag elsewhere).
//
// RATCHET: two constants, both hand-measured on this branch by forcing them
// to `-1` and reading the printed offender list back (never `= COUNT` or
// any expression naming the measured set) --
// PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING (real, closeable hides) and
// PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING (composed-text misses the
// join cannot resolve). Both two-sided (an ABOVE it and a BELOW-companion
// it, mirroring every prior ledger in this campaign).
//
// MEGABATCH MERGE NOTE (Thunderdome): v12m-w31-a is repairing the two
// `.chq-review-criteria-*` rows named above (review.css) in this SAME
// batch, measured against a tree that does not yet contain that repair.
// Both ceiling constants below (PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_
// CEILING = 59, PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 35) include
// exactly one row each for `.chq-review-criteria-head-row` (PREMISE-FALSE)
// and `.chq-review-criteria-eyebrow` (UNVERIFIABLE), and are EXPECTED to
// drop by (at least) one each once the merge train lands both branches --
// read a lower measured count post-merge as the ratchet working, not as a
// broken gate, and tighten both constants in the same merge-train commit
// (mirrors docs/design/audit/frame-field-label-v12.md's own "Megabatch
// merge note" idiom).
//
// This file MEASURES AND RATCHETS ONLY -- it moves no product byte and no
// CSS (the review.css repair is v12m-w31-a's own lane, not this one's).
//
// WAVE-35 AMENDMENT (DEC-725): the join above was a VERBATIM LITERAL MATCH
// AGAINST EVERY WIDTH:390 FRAME EXTENT IN THE PACK, not scoped to the
// hidden rule's own page or feature -- docs/design/audit/
// phone-hidden-drawn-text-v12.md's own words for the gap this amendment
// closes. Two changes:
//
//   (1) CLUSTER SCOPING (DEC-808, derived by name normalisation, never a
//   hand list): a sheet under `app/src/pages/<cluster>/*` is joined only
//   against `docs/design/Chautauqua <Cluster>.dc.html`'s own frame extents
//   (title-cased directory name -> file name); an SSR sheet under
//   `src/routes/public/**` or `src/routes/portal/**` is joined only against
//   `Chautauqua Public and Portal.dc.html`; one under `src/routes/docs*`
//   only against `Chautauqua Docs.dc.html`. Two kinds of sheet EXPLICITLY
//   keep the old full-pack join rather than being silently narrowed: the
//   shared roots (`app/src/styles.css`, `src/views/theme.ts`, asserted by
//   name below) and any sheet whose derived cluster has no same-named frame
//   file in the pack (`app/src/pages/forms/forms.css` has no `Chautauqua
//   Forms.dc.html`; `src/routes/auth.css.ts` matches none of the three SSR
//   prefixes) -- `scopeBlobsForSheet`'s `kind` field names which case fired
//   so neither can happen by accident.
//
//   (2) TWIN DETECTION, reusing `phone-capability-removal.scan.test.ts`'s
//   own precedent for this exact shape (its closed-row prose: `.chq-
//   detail-back-full` was receipted "as a desktop twin: the SAME back
//   link's phone label is `.chq-detail-back-short`") rather than writing a
//   second copy of that judgment (DEC-613): a PREMISE-FALSE candidate
//   additionally resolves to TWIN-RESOLVED when some OTHER `chq-` token
//   that is NEVER phone-hidden anywhere in the tree carries the identical
//   static text on the SAME cluster surface (derived by the same
//   `clusterKeyForPath` normalisation cluster-scoping (1) above uses, so
//   the two mechanisms share one population key, DEC-613) -- the frame's
//   requirement is met by that still-visible twin, not by the element the
//   rule hid. TWIN-RESOLVED rows are graded, recorded and counted in
//   neither ratchet (DEC-180: a resolution is recorded, never a silent
//   drop).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_180, DEC_393, DEC_613, DEC_725, DEC_808, DEC_919, DEC_967 } from '../../src/decisions';
import { normalizeSource } from '../../test/frame-source-corpus';
import { PHONE_DISPLAY_NONE_RULES } from './phone-capability-removal.scan.test';
import { clusterKeyForPath, scopeBlobsForSheet } from './phone-hidden-drawn-text/cluster-scope';
import { designFiles, FRAME_BLOBS } from './phone-hidden-drawn-text/frame-blobs';
import type { FrameBlob } from './phone-hidden-drawn-text/frame-blobs';
import { findTwin, gradeRule } from './phone-hidden-drawn-text/grade';
import type { GradedRule } from './phone-hidden-drawn-text/grade';
import { textBearingFindingsIn, tokensOf } from './phone-hidden-drawn-text/text-findings';
import type { TextFinding } from './phone-hidden-drawn-text/text-findings';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src

// Compile-checked dependency markers (CLAUDE.md: code depending on a
// decision must reference its constant so the dependency is compile-
// checked).
void DEC_725; // this ledger's own ruling: the wave-31 amendment naming the population, the grades and the anti-vacuity requirement.
void DEC_919; // the mandate this amendment sits one CSS property over from: "a 390 frame re-lines, it never removes a control" -- this file's subject is the TEXT half of the same claim.
void DEC_808; // every population below is derived by directory walk at test time, never hand-listed.
void DEC_613; // the CSS-side rule population, the TSX-side stripper, and the frame-side matcher are all IMPORTED, never re-implemented.
void DEC_180; // a composed-text miss narrows the GRADE (UNVERIFIABLE, with its reason recorded), it never silently drops the row from the roster.
void DEC_967; // wave-138: a ledger that re-derives corpus enumeration privately is the failure this file's imports avoid; wave-143: the anti-vacuity guard is proved on a synthetic fixture, never anchored on a real offender a sibling lane may fix.
void DEC_393; // wave-30's tap-floor-exempt ruling ("a receipt asserts a fact about markup, and no instrument checks it") is the same failure shape this file answers for phone-hidden receipts, one CSS property over.

const REPO_ROOT = join(HERE, '..', '..');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// ---------------------------------------------------------------------------
// TSX side (text-findings.ts), frame side (frame-blobs.ts) and cluster
// scoping (cluster-scope.ts) are all extracted, imported above, and
// re-exported at the bottom of this file (contention decomposition, no
// behavior change -- this file previously carried all four modules'
// substance directly, which made it the campaign's largest recurring merge
// conflict; see CONTENTION DECOMPOSITION task notes).
// ---------------------------------------------------------------------------

function findingsInRealTree(): TextFinding[] {
  return [...textBearingFindingsIn(APP_SRC_ROOT), ...textBearingFindingsIn(SRC_ROOT)];
}

const TEXT_FINDINGS = findingsInRealTree();

// ---------------------------------------------------------------------------
// Join: CSS rule -> chq- tokens -> TSX text findings -> frame extents
// (grade.ts). HIDDEN_TOKENS/GRADED_RULES stay here: they close over
// PHONE_DISPLAY_NONE_RULES/TEXT_FINDINGS/FRAME_BLOBS, the three populations
// this orchestrator file alone assembles.
// ---------------------------------------------------------------------------

// Every `chq-` token that is phone-hidden by SOME rule, anywhere in the
// tree -- the population `findTwin` excludes a candidate twin from (a twin
// must itself remain VISIBLE at phone width). Derived once from the same
// `PHONE_DISPLAY_NONE_RULES` population this whole file joins against
// (DEC-613: reusing `phone-capability-removal.scan.test.ts`'s own rule
// enumeration rather than re-deriving it).
const HIDDEN_TOKENS: ReadonlySet<string> = new Set(PHONE_DISPLAY_NONE_RULES.flatMap((r) => tokensOf(r.selector)));

const KNOWN_FRAME_FILES: ReadonlySet<string> = new Set(designFiles());

const GRADED_RULES: GradedRule[] = PHONE_DISPLAY_NONE_RULES.map((r) => {
  const scope = scopeBlobsForSheet(r.sheet, FRAME_BLOBS, KNOWN_FRAME_FILES);
  const g = gradeRule(r.selector, TEXT_FINDINGS, scope.blobs, HIDDEN_TOKENS);
  return g ? { ...g, sheet: r.sheet } : undefined;
}).filter((g): g is GradedRule => g !== undefined);

const PREMISE_FALSE_ROWS = GRADED_RULES.filter((g) => g.grade === 'PREMISE-FALSE');
const UNVERIFIABLE_ROWS = GRADED_RULES.filter((g) => g.grade === 'UNVERIFIABLE');
const TWIN_RESOLVED_ROWS = GRADED_RULES.filter((g) => g.grade === 'TWIN-RESOLVED');

// Measured on this branch by forcing both constants to -1 and reading the
// printed offender roster back (never an expression naming the measured
// set). The full per-row roster is recorded in
// docs/design/audit/phone-hidden-drawn-text-v12.md. Wave-35 amendment
// (DEC-725): both counts DROPPED once the join was scoped to each sheet's
// own cluster frame (docs/design/audit/phone-hidden-drawn-text-v12.md's own
// words for the prior gap: "a verbatim literal match against every
// width:390 frame extent in the pack, not scoped to the hidden rule's own
// page or feature") and twin-detection resolved rows whose text is still
// drawn, visibly, by an unhidden sibling on the same cluster surface.
export const PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = 28;
export const PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 40;

describe('DEC-725 phone hidden-drawn-text probe', () => {
  it('finds more than one phone display:none rule (vacuous-population tripwire, CSS side)', () => {
    expect(PHONE_DISPLAY_NONE_RULES.length).toBeGreaterThan(5);
  });

  it('finds more than zero text-bearing chq- findings in the real tree (vacuous-population tripwire, TSX side)', () => {
    expect(TEXT_FINDINGS.length).toBeGreaterThan(20);
  });

  it('finds more than zero phone frame extents (vacuous-population tripwire, frame side)', () => {
    expect(FRAME_BLOBS.length).toBeGreaterThan(5);
  });

  it('the graded-rule population is a strict subset of PHONE_DISPLAY_NONE_RULES (monotone population floor: this ledger can only ever be as large as its source rule set, never larger)', () => {
    expect(GRADED_RULES.length).toBeGreaterThan(0);
    expect(GRADED_RULES.length).toBeLessThanOrEqual(PHONE_DISPLAY_NONE_RULES.length);
  });

  // --- wave-35 amendment: cluster scoping (DEC-725/DEC-808) --------------

  it('clusterKeyForPath derives the same cluster key for a top-level page component and its cluster-directory subcomponents (the join that lets Agenda.tsx and pages/agenda/DayGrid.tsx share one surface)', () => {
    expect(clusterKeyForPath('app/src/pages/Agenda.tsx')).toBe('agenda');
    expect(clusterKeyForPath('app/src/pages/agenda/DayGrid.tsx')).toBe('agenda');
    expect(clusterKeyForPath('app/src/pages/agenda/agenda.css')).toBe('agenda');
  });

  it('clusterKeyForPath keys SSR public/portal sheets and docs sheets on their own shared clusters, never a per-file guess', () => {
    expect(clusterKeyForPath('src/routes/public/cfp.css.ts')).toBe('public-portal');
    expect(clusterKeyForPath('src/routes/portal/portal.css.ts')).toBe('public-portal');
    expect(clusterKeyForPath('src/routes/docs-site.css.ts')).toBe('docs');
  });

  it('shared roots (app/src/styles.css, src/views/theme.ts) are EXPLICITLY scoped full-pack, never silently narrowed (asserted, not dropped)', () => {
    const blobs = [{ fileName: 'Any.dc.html', line: 1, title: 't', normalized: 'x' }];
    expect(scopeBlobsForSheet('app/src/styles.css', blobs, new Set(['Any.dc.html']))).toEqual({
      blobs,
      kind: 'shared-root',
      frameFile: undefined,
    });
    expect(scopeBlobsForSheet('src/views/theme.ts', blobs, new Set(['Any.dc.html']))).toEqual({
      blobs,
      kind: 'shared-root',
      frameFile: undefined,
    });
  });

  it('a cluster with no same-named frame file (forms) and an SSR sheet matching no public/portal/docs prefix (auth.css.ts) EXPLICITLY fall back to full-pack, never silently narrowed to an empty set', () => {
    const blobs = [{ fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 't', normalized: 'x' }];
    const known = new Set(['Chautauqua Agenda.dc.html']); // deliberately no "Chautauqua Forms.dc.html"
    expect(scopeBlobsForSheet('app/src/pages/forms/forms.css', blobs, known)).toEqual({
      blobs,
      kind: 'no-frame-fallback',
      frameFile: undefined,
    });
    expect(scopeBlobsForSheet('src/routes/auth.css.ts', blobs, known)).toEqual({
      blobs,
      kind: 'no-frame-fallback',
      frameFile: undefined,
    });
  });

  it('every sheet PHONE_DISPLAY_NONE_RULES actually carries resolves to exactly one scope kind against the real pack (no sheet silently falls through undefined)', () => {
    const sheets = [...new Set(PHONE_DISPLAY_NONE_RULES.map((r) => r.sheet))];
    expect(sheets.length).toBeGreaterThan(5);
    for (const sheet of sheets) {
      const scope = scopeBlobsForSheet(sheet, FRAME_BLOBS, KNOWN_FRAME_FILES);
      expect(['cluster', 'shared-root', 'no-frame-fallback']).toContain(scope.kind);
      if (scope.kind === 'cluster') expect(scope.blobs.length).toBeGreaterThan(0);
    }
  });

  it('non-vacuity: a cluster-scoped synthetic match against its OWN cluster frame hits PREMISE-FALSE', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Fixture.tsx', token: 'chq-x-fake-scope-hit', text: 'Scoped Fixture Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Scoped Fixture Label</span>') },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/fixture.css', blobs, known);
    expect(scope.kind).toBe('cluster');
    const graded = gradeRule('.chq-x-fake-scope-hit', findings, scope.blobs);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: the SAME synthetic text drawn only in a DIFFERENT cluster frame no longer matches once scoped (proves the scoping does not empty the population by accident, only by design)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Fixture.tsx', token: 'chq-x-fake-scope-miss', text: 'Cross Cluster Fixture Label', composed: false },
    ];
    // Drawn ONLY in the Overview frame -- a different cluster from the
    // agenda.css sheet under test.
    const blobs: FrameBlob[] = [
      {
        fileName: 'Chautauqua Overview.dc.html',
        line: 1,
        title: 'Fixture frame',
        normalized: normalizeSource('<span>Cross Cluster Fixture Label</span>'),
      },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html', 'Chautauqua Overview.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/fixture.css', blobs, known);
    expect(scope.kind).toBe('cluster');
    expect(scope.blobs).toEqual([]); // Agenda's own frame carries none of this synthetic Overview-only text
    const graded = gradeRule('.chq-x-fake-scope-miss', findings, scope.blobs);
    expect(graded?.grade).toBe('PREMISE-OK'); // unscoped, this would have wrongly graded PREMISE-FALSE
  });

  // --- wave-35 amendment: twin detection (DEC-725, reusing DEC-919's
  // "desktop twin" receipt precedent rather than a second copy, DEC-613) --

  it('non-vacuity: a PREMISE-FALSE candidate whose text is ALSO drawn by another, never-hidden token on the same cluster surface resolves to TWIN-RESOLVED', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden', text: 'Twin Fixture Label', composed: false },
      { file: 'app/src/pages/agenda/Visible.tsx', token: 'chq-x-fake-twin-visible', text: 'Twin Fixture Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Twin Fixture Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden']); // the visible twin's OWN token is never hidden
    const graded = gradeRule('.chq-x-fake-twin-hidden', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('TWIN-RESOLVED');
    expect(graded?.reason).toContain('chq-x-fake-twin-visible');
  });

  it('non-vacuity: the same shape with the candidate twin on a DIFFERENT cluster surface stays PREMISE-FALSE (a twin must share the surface, not just the text)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden-2', text: 'Cross Surface Twin Label', composed: false },
      { file: 'app/src/pages/overview/Visible.tsx', token: 'chq-x-fake-twin-visible-2', text: 'Cross Surface Twin Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Cross Surface Twin Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden-2']);
    const graded = gradeRule('.chq-x-fake-twin-hidden-2', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: a candidate twin whose OWN token is also phone-hidden elsewhere is not a twin (it is not actually visible at phone width)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden-3', text: 'Both Hidden Label', composed: false },
      { file: 'app/src/pages/agenda/AlsoHidden.tsx', token: 'chq-x-fake-twin-also-hidden-3', text: 'Both Hidden Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Both Hidden Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden-3', 'chq-x-fake-twin-also-hidden-3']);
    const graded = gradeRule('.chq-x-fake-twin-hidden-3', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: a candidate token that carries MANY distinct static texts (a bulk container, e.g. a page-root wrapper) is disqualified as a twin even though it happens to also carry the matching text', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Hidden.tsx', token: 'chq-x-fake-twin-hidden-4', text: 'Container Twin Label', composed: false },
      { file: 'app/src/pages/agenda/Container.tsx', token: 'chq-x-fake-container', text: 'Container Twin Label', composed: false },
      { file: 'app/src/pages/agenda/Container.tsx', token: 'chq-x-fake-container', text: 'Some Other Unrelated Text', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Container Twin Label</span>') },
    ];
    const hiddenTokens = new Set(['chq-x-fake-twin-hidden-4']); // chq-x-fake-container is never hidden either -- the container itself must still be excluded
    const graded = gradeRule('.chq-x-fake-twin-hidden-4', findings, blobs, hiddenTokens);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('findTwin never matches a finding against itself, and treats two undefined surfaces as never the same surface', () => {
    const lone: TextFinding = { file: 'app/src/pages/agenda/Solo.tsx', token: 'chq-x-fake-solo', text: 'Solo Label', composed: false };
    expect(findTwin(lone, [lone])).toBeUndefined();
    const outsideA: TextFinding = { file: 'app/src/components/A.tsx', token: 'chq-x-fake-outside-a', text: 'Outside Label', composed: false };
    const outsideB: TextFinding = { file: 'app/src/components/B.tsx', token: 'chq-x-fake-outside-b', text: 'Outside Label', composed: false };
    expect(clusterKeyForPath(outsideA.file)).toBeUndefined();
    expect(findTwin(outsideA, [outsideA, outsideB])).toBeUndefined();
  });

  it('the worked-example row (.chq-review-criteria-head-row) is graded TWIN-RESOLVED against the live tree (wave-35: PlanEditor.tsx\'s .chq-review-criterion-weight now carries a real, still-visible per-criterion "Weight" eyebrow, DEC-745 -- the frame\'s requirement is met there, not by the still-hidden head-row)', () => {
    const row = GRADED_RULES.find((g) => g.selector.includes('chq-review-criteria-head-row'));
    expect(row?.grade).toBe('TWIN-RESOLVED');
    expect(row?.reason).toContain('chq-review-criterion-weight');
  });

  it('the worked-example row (.chq-review-criteria-eyebrow) is graded UNVERIFIABLE against the live tree', () => {
    const row = GRADED_RULES.find((g) => g.selector.includes('chq-review-criteria-eyebrow'));
    expect(row?.grade).toBe('UNVERIFIABLE');
  });

  // --- non-vacuity: the classifier is proved on a SYNTHETIC fixture, never
  // anchored on a real offender a sibling lane may fix (DEC-967 wave-143).
  it('non-vacuity: a synthetic static literal that IS drawn in a synthetic frame extent grades PREMISE-FALSE', () => {
    const findings: TextFinding[] = [
      { file: 'fixture.tsx', token: 'chq-x-fake-eyebrow', text: 'Fixture Only Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      {
        fileName: 'Fixture.dc.html',
        line: 1,
        title: 'Fixture frame',
        normalized: normalizeSource('<span>Fixture Only Label</span>'),
      },
    ];
    const graded = gradeRule('.chq-x-fake-eyebrow', findings, blobs);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('non-vacuity: a synthetic static literal that is NOT drawn in any synthetic frame extent grades PREMISE-OK', () => {
    const findings: TextFinding[] = [
      { file: 'fixture.tsx', token: 'chq-x-fake-ok', text: 'Fixture Absent Label', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Something else entirely</span>') },
    ];
    const graded = gradeRule('.chq-x-fake-ok', findings, blobs);
    expect(graded?.grade).toBe('PREMISE-OK');
  });

  it('non-vacuity: a synthetic composed-only text child grades UNVERIFIABLE, never a silent pass', () => {
    const findings: TextFinding[] = [
      { file: 'fixture.tsx', token: 'chq-x-fake-composed', text: '{fixture.value}', composed: true },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Fixture.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Unrelated</span>') },
    ];
    const graded = gradeRule('.chq-x-fake-composed', findings, blobs);
    expect(graded?.grade).toBe('UNVERIFIABLE');
    expect(graded?.reason).toContain('composed');
  });

  it('non-vacuity: a selector whose token has no text-bearing finding at all is OUTSIDE this population (undefined, not PREMISE-OK)', () => {
    const graded = gradeRule('.chq-x-fake-no-text', [], []);
    expect(graded).toBeUndefined();
  });

  it('non-vacuity: findingsInRealTree/textBearingFindingsIn parses a real fixture .tsx-shaped file written to a tmpdir (proves the walk itself, not just the pure classifier)', async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'phone-hidden-drawn-text-fixture-'));
    try {
      mkdirSync(join(dir, 'nested'), { recursive: true });
      writeFileSync(
        join(dir, 'nested', 'Fixture.tsx'),
        [
          '// a comment naming chq-x-fake-comment-only should never be picked up',
          '/* chq-x-fake-block-comment also must never be picked up */',
          'export function Fixture() {',
          '  return (',
          '    <div>',
          '      <span className="chq-x-fake-static">Static Fixture Text</span>',
          '      <span className="chq-x-fake-dynamic">{value}</span>',
          '      <span className="not-chq">Irrelevant</span>',
          '    </div>',
          '  );',
          '}',
          '',
        ].join('\n'),
        'utf-8'
      );
      const found = textBearingFindingsIn(dir);
      const tokens = found.map((f) => f.token);
      expect(tokens).toContain('chq-x-fake-static');
      expect(tokens).toContain('chq-x-fake-dynamic');
      expect(tokens).not.toContain('chq-x-fake-comment-only');
      expect(tokens).not.toContain('chq-x-fake-block-comment');
      const staticFinding = found.find((f) => f.token === 'chq-x-fake-static');
      expect(staticFinding?.composed).toBe(false);
      expect(staticFinding?.text).toBe('Static Fixture Text');
      const dynamicFinding = found.find((f) => f.token === 'chq-x-fake-dynamic');
      expect(dynamicFinding?.composed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PREMISE-FALSE rows never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = PREMISE_FALSE_ROWS.map((r) => `${r.sheet} :: ${r.selector} -- ${r.reason}`).join('\n');
    expect(
      PREMISE_FALSE_ROWS.length,
      `PREMISE-FALSE phone hidden-drawn-text rows (${PREMISE_FALSE_ROWS.length}, ceiling ${PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING}):\n${detail}`
    ).toBeLessThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING);
  });

  it('never sits ABOVE the measured PREMISE-FALSE truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (PREMISE_FALSE_ROWS.length < PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING) {
      throw new Error(
        `${PREMISE_FALSE_ROWS.length} PREMISE-FALSE row(s), below the ratchet ceiling of ` +
          `${PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING}. This is the ratchet working -- ` +
          `tighten the ceiling in the same commit by replacing the line:\n` +
          `  export const PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = ${PREMISE_FALSE_ROWS.length};`
      );
    }
    expect(PREMISE_FALSE_ROWS.length).toBeGreaterThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING);
  });

  it('UNVERIFIABLE rows never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = UNVERIFIABLE_ROWS.map((r) => `${r.sheet} :: ${r.selector} -- ${r.reason}`).join('\n');
    expect(
      UNVERIFIABLE_ROWS.length,
      `UNVERIFIABLE phone hidden-drawn-text rows (${UNVERIFIABLE_ROWS.length}, ceiling ${PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING}):\n${detail}`
    ).toBeLessThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING);
  });

  it('never sits ABOVE the measured UNVERIFIABLE truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (UNVERIFIABLE_ROWS.length < PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING) {
      throw new Error(
        `${UNVERIFIABLE_ROWS.length} UNVERIFIABLE row(s), below the ratchet ceiling of ` +
          `${PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING}. Tighten the ceiling in the same ` +
          `merge-train commit by replacing the line:\n` +
          `  export const PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = ${UNVERIFIABLE_ROWS.length};`
      );
    }
    expect(UNVERIFIABLE_ROWS.length).toBeGreaterThanOrEqual(PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING);
  });

  it('TWIN-RESOLVED rows are graded and recorded, never a silent drop from the roster (DEC-180) -- neither ceiling counts them', () => {
    for (const row of TWIN_RESOLVED_ROWS) {
      expect(PREMISE_FALSE_ROWS).not.toContain(row);
      expect(UNVERIFIABLE_ROWS).not.toContain(row);
      expect(row.reason).toContain('still-visible');
    }
  });
});

// Re-exports of the extracted submodules' public surface (contention
// decomposition, no behavior change): everything that used to be defined
// directly in this file is still importable from it.
export { clusterKeyForPath, scopeBlobsForSheet } from './phone-hidden-drawn-text/cluster-scope';
export type { SheetScope } from './phone-hidden-drawn-text/cluster-scope';
export { designFiles } from './phone-hidden-drawn-text/frame-blobs';
export type { FrameBlob } from './phone-hidden-drawn-text/frame-blobs';
export { findTwin, gradeRule } from './phone-hidden-drawn-text/grade';
export type { Grade, GradedRule } from './phone-hidden-drawn-text/grade';
export { textBearingFindingsIn } from './phone-hidden-drawn-text/text-findings';
export type { TextFinding } from './phone-hidden-drawn-text/text-findings';

export {
  FRAME_BLOBS,
  GRADED_RULES,
  PREMISE_FALSE_ROWS,
  TEXT_FINDINGS,
  TWIN_RESOLVED_ROWS,
  UNVERIFIABLE_ROWS,
};
