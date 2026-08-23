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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_180, DEC_393, DEC_613, DEC_725, DEC_808, DEC_919, DEC_967 } from '../../src/decisions';
import { normalizeSource } from '../../test/frame-source-corpus';
import { PHONE_DISPLAY_NONE_RULES } from './phone-capability-removal.scan.test';
import { clusterKeyForPath, findingsScopedForSheet, scopeBlobsForSheet } from './phone-hidden-drawn-text/cluster-scope';
import { designFiles, FRAME_BLOBS, templateCloseLine } from './phone-hidden-drawn-text/frame-blobs';
import type { FrameBlob } from './phone-hidden-drawn-text/frame-blobs';
import { findTwin, genericVerbsIn, gradeRule } from './phone-hidden-drawn-text/grade';
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

// Wave-39 amendment (DEC-725): the corpus-derived generic control verbs
// (genericVerbsIn, grade.ts) -- computed once over the whole real finding
// population, since a word's genericity is a fact about the tree, not about
// any one rule.
const GENERIC_VERBS: ReadonlySet<string> = genericVerbsIn(TEXT_FINDINGS);

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
  const scopedFindings = findingsScopedForSheet(r.sheet, scope, TEXT_FINDINGS);
  const g = gradeRule(r.selector, scopedFindings, scope.blobs, HIDDEN_TOKENS, clusterKeyForPath, GENERIC_VERBS);
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
// Wave-39 amendment (DEC-725): both re-measured against the TSX-side
// cluster-scoped + generic-verb-corroborated instrument. PREMISE-FALSE fell
// from 28 as (a) a cross-cluster component (EventSwitcher.tsx, no cluster of
// its own) could no longer supply a stranger's literal, (b) a CSS-selector
// token-extraction bug that pulled `chq-cfp-step` out of the ATTRIBUTE NAME
// `data-chq-cfp-step` (never a class selector) stopped contaminating
// `.chq-cfp-step-back`/`.chq-cfp-step-next`/`.chq-cfp-step-talk`'s own
// matches with the unrelated "You" section label, and (c) a handful of
// single, uncorroborated generic verbs ("Cancel", "Edit") no longer alone
// condemn a rule. UNVERIFIABLE rose as those same rows fell through to their
// own composed finding, exactly as wave-35 recorded for cluster scoping.
export const PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = 20;
export const PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 49;

// ---------------------------------------------------------------------------
// DEC-967 wave-42 amendment: a two-sided completeness ratchet over every
// `.ts`/`.tsx` file in the tree that derives an `extentEnd` from a
// `.dc.html` label scan (the shape this file's own `framesInFile` and its
// eleven siblings across app/src/test/src/scripts all share) WITHOUT
// clipping that extent at its file's own template close. This is what
// makes DEC-967's ruling self-enforcing instead of a twelve-file reading
// exercise: every sibling ledger that ports the clip in makes this count
// go down; a future ledger that copies the OLD unclipped shape makes it go
// back up, and this scan catches it.
// ---------------------------------------------------------------------------

const EXTENT_SCAN_ROOTS = [APP_SRC_ROOT, SRC_ROOT, join(REPO_ROOT, 'test'), join(REPO_ROOT, 'scripts')];

/** Every `.ts`/`.tsx` file under `root`, enumerated via readdirSync rather
 * than named (DEC-808) -- unlike test/frame-source-corpus.ts's own
 * `enumerateSourceFiles`, this walk deliberately does NOT exclude
 * `.test.`/`.test.tsx` files: the population this ratchet grades is
 * exactly the scan/ledger files DEC-967 names, which are almost entirely
 * `*.scan.test.ts` files. */
function enumerateTsFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// A file is IN this population if it both (a) derives an `extentEnd` value
// and (b) scans for the SAME `font-size:19px` frame-label marker every
// `.dc.html` frame walk in this campaign keys on -- the combination that
// distinguishes an actual frame-extent derivation from an unrelated use of
// either token alone (e.g. a CSS `font-size:19px` declaration in product
// code, or an unrelated `extentEnd`-named field in a different shape).
const EXTENT_DERIVATION_RE = /extentEnd/;
const FRAME_LABEL_MARKER_RE = /font-size:19px/;

/** True if `absFile` derives a frame `extentEnd` from a `.dc.html` label
 * scan without clipping it at that file's own template close. */
function isUnclippedExtentDerivation(absFile: string): boolean {
  const src = readFileSync(absFile, 'utf-8');
  if (!EXTENT_DERIVATION_RE.test(src)) return false;
  if (!FRAME_LABEL_MARKER_RE.test(src)) return false;
  return !src.includes('templateCloseLine');
}

const UNCLIPPED_EXTENT_DERIVATION_FILES: string[] = EXTENT_SCAN_ROOTS.flatMap((root) =>
  enumerateTsFiles(root).filter(isUnclippedExtentDerivation)
).sort();

// Measured over the MERGED tree (wave-40/41/42 thunderdome megabatch) by
// re-running this file's own predicate and reading the offender list back
// (never an expression naming the measured set). v12m-w42-d measured 10 on
// its own branch; the sibling clip lanes it names (w41-b/c/d, w42-f) landed
// in the same batch, so the merged population is far smaller. This file's
// own derivation moved to ./phone-hidden-drawn-text/frame-blobs.ts (wave-40
// contention decomposition) and is clipped there, so neither appears. May only be RAISED if the ratchet is proved stale by
// a re-measurement; a merge-train commit that lands one of the in-flight
// w41 clip lanes must TIGHTEN it in the same commit (mirrors every other
// ratchet in this campaign).
export const UNCLIPPED_EXTENT_DERIVATION_CEILING = 1;

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

  // --- wave-39 amendment: TSX-side cluster scoping + generic-verb
  // corroboration (DEC-725) -- a shared control verb from an UNRELATED
  // component can no longer condemn a sheet. ------------------------------

  it('findingsScopedForSheet narrows a cluster-scoped sheet\'s findings to its OWN cluster, excluding a same-token match from an unrelated component (the worked EventSwitcher.tsx/agenda.css shape)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/components/EventSwitcher.tsx', token: 'chq-btn-secondary', text: 'Cancel', composed: false },
      { file: 'app/src/pages/agenda/DayGrid.tsx', token: 'chq-agenda-cancel', text: 'Cancel', composed: false },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/agenda.css', [], known);
    expect(scope.kind).toBe('cluster');
    const scoped = findingsScopedForSheet('app/src/pages/agenda/agenda.css', scope, findings);
    expect(scoped.map((f) => f.file)).toEqual(['app/src/pages/agenda/DayGrid.tsx']);
    expect(clusterKeyForPath('app/src/components/EventSwitcher.tsx')).toBeUndefined();
  });

  it('findingsScopedForSheet keeps the FULL, unscoped finding population for shared-root and no-frame-fallback sheets (their own components are not owned by one cluster either)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/components/EventSwitcher.tsx', token: 'chq-x', text: 'Anything', composed: false },
      { file: 'app/src/pages/agenda/DayGrid.tsx', token: 'chq-y', text: 'Other', composed: false },
    ];
    const sharedRootScope = scopeBlobsForSheet('app/src/styles.css', [], new Set());
    expect(findingsScopedForSheet('app/src/styles.css', sharedRootScope, findings)).toEqual(findings);
    const fallbackScope = scopeBlobsForSheet('app/src/pages/forms/forms.css', [], new Set());
    expect(findingsScopedForSheet('app/src/pages/forms/forms.css', fallbackScope, findings)).toEqual(findings);
  });

  it('NEGATIVE CONTROL: a synthetic IN-CLUSTER multi-word match still grades PREMISE-FALSE (tightening does not over-tighten a genuine, specific-phrase match)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Fixture.tsx', token: 'chq-x-fake-multiword', text: 'A Genuinely Specific Phrase', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>A Genuinely Specific Phrase</span>') },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/fixture.css', blobs, known);
    const scoped = findingsScopedForSheet('app/src/pages/agenda/fixture.css', scope, findings);
    const graded = gradeRule('.chq-x-fake-multiword', scoped, scope.blobs);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('NEGATIVE CONTROL: a synthetic CROSS-CLUSTER single-verb match grades PREMISE-OK once TSX-side cluster scoping excludes the stranger component (the exact EventSwitcher.tsx/agenda.css shape, end to end)', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/components/StrangerModal.tsx', token: 'chq-btn-secondary', text: 'Cancel', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Cancel</span>') },
    ];
    const known = new Set(['Chautauqua Agenda.dc.html']);
    const scope = scopeBlobsForSheet('app/src/pages/agenda/fixture.css', blobs, known);
    expect(clusterKeyForPath('app/src/components/StrangerModal.tsx')).toBeUndefined();
    const scoped = findingsScopedForSheet('app/src/pages/agenda/fixture.css', scope, findings);
    expect(scoped).toEqual([]); // the stranger component carries no cluster to match agenda's own
    const graded = gradeRule('.chq-btn-secondary', scoped, scope.blobs);
    expect(graded).toBeUndefined(); // outside the population entirely: no text-bearing finding left for this token
  });

  it('genericVerbsIn promotes a word only once it recurs as the complete own-text of a control in enough DISTINCT files, never on a single coincidental sighting', () => {
    const findings: TextFinding[] = [
      { file: 'app/src/pages/a/A.tsx', token: 'chq-a', text: 'Edit', composed: false },
      { file: 'app/src/pages/b/B.tsx', token: 'chq-b', text: 'Edit', composed: false },
    ];
    expect(genericVerbsIn(findings, 3).has('Edit')).toBe(false); // only 2 distinct files, below the threshold
    expect(genericVerbsIn(findings, 2).has('Edit')).toBe(true);
    // a multi-word run is never a "generic verb" candidate, however often it recurs
    const multiWord: TextFinding[] = [
      { file: 'app/src/pages/a/A.tsx', token: 'chq-a', text: 'Two Words', composed: false },
      { file: 'app/src/pages/b/B.tsx', token: 'chq-b', text: 'Two Words', composed: false },
      { file: 'app/src/pages/c/C.tsx', token: 'chq-c', text: 'Two Words', composed: false },
    ];
    expect(genericVerbsIn(multiWord, 2).has('Two Words')).toBe(false);
  });

  it('an UNCORROBORATED generic-verb candidate (its rule\'s only match, no multi-word or same-token sibling) does not, alone, grade PREMISE-FALSE', () => {
    const genericVerbs = new Set(['Cancel']);
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Lone.tsx', token: 'chq-x-fake-lone-verb', text: 'Cancel', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Chautauqua Agenda.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Cancel</span>') },
    ];
    const graded = gradeRule('.chq-x-fake-lone-verb', findings, blobs, HIDDEN_TOKENS, clusterKeyForPath, genericVerbs);
    expect(graded?.grade).toBe('PREMISE-OK'); // no other match to corroborate it, so the bare verb alone cannot condemn the rule
  });

  it('a generic-verb candidate CORROBORATED by a multi-word sibling match on the same rule still grades PREMISE-FALSE', () => {
    const genericVerbs = new Set(['Cancel']);
    const findings: TextFinding[] = [
      { file: 'app/src/pages/agenda/Corroborated.tsx', token: 'chq-x-fake-corrob', text: 'Cancel', composed: false },
      { file: 'app/src/pages/agenda/Corroborated.tsx', token: 'chq-x-fake-corrob', text: 'A Genuinely Specific Phrase', composed: false },
    ];
    const blobs: FrameBlob[] = [
      {
        fileName: 'Chautauqua Agenda.dc.html',
        line: 1,
        title: 'Fixture frame',
        normalized: normalizeSource('<span>Cancel</span><span>A Genuinely Specific Phrase</span>'),
      },
    ];
    const graded = gradeRule('.chq-x-fake-corrob', findings, blobs, HIDDEN_TOKENS, clusterKeyForPath, genericVerbs);
    expect(graded?.grade).toBe('PREMISE-FALSE');
  });

  it('a CSS selector token is a genuine CLASS selector (`.chq-x`) only -- a `chq-` substring inside an ATTRIBUTE NAME (`[data-chq-x="1"]`) is never extracted as a token (the .chq-cfp-step-back/.chq-cfp-step-you shape)', () => {
    const findings: TextFinding[] = [
      { file: 'src/routes/public/Fixture.tsx', token: 'chq-x', text: 'Elsewhere', composed: false },
    ];
    const blobs: FrameBlob[] = [
      { fileName: 'Chautauqua Public and Portal.dc.html', line: 1, title: 'Fixture frame', normalized: normalizeSource('<span>Elsewhere</span>') },
    ];
    // `[data-chq-x="1"] .chq-y` -- the attribute name embeds `chq-x` as a
    // pure substring; only `.chq-y` is a genuine class selector.
    const graded = gradeRule('[data-chq-x="1"] .chq-y', findings, blobs);
    expect(graded).toBeUndefined(); // `chq-x` was never a class token on this selector, so `.chq-y` (no findings at all) is outside the population
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

  // --- DEC-967 wave-42 amendment: the frame-extent derivation is clipped at
  // the template's own close, not just at the next label / EOF -----------

  it('control (DEC-967 wave-42 amendment): a fabricated label-shaped string after the template close is excluded from a frame\'s extent, and the same shape before the close is included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'phone-hidden-drawn-text-template-close-'));
    try {
      const fixturePath = join(dir, 'Zzy Fixture.dc.html');
      const lines = [
        '<div style="font-size:19px">Zzy Frame</span>', // line 1: label
        '<div style="width:390px; height:844px">', // line 2: frame line
        '  <span>Zzy Before Close Label</span>', // line 3: inside the frame, before close
        '</div>', // line 4
        '</x-dc>', // line 5: template close
        '<span>Zzy After Close Label</span>', // line 6: after close -- must not enter
      ];
      writeFileSync(fixturePath, lines.join('\n'));

      const closeLine = templateCloseLine(fixturePath);
      expect(closeLine).toBe(5);

      // Mirrors framesInFile's own extentEnd computation above: no next
      // label after the frame line (2), so the raw extent would run to
      // Infinity -- clipped here to the template close, exactly as the
      // production `extentEnd: Math.min(nextLabel ? nextLabel.line :
      // Infinity, templateCloseLine(full))` does.
      const frameLine = 2;
      const extentEnd = Math.min(Infinity, templateCloseLine(fixturePath));
      expect(extentEnd).toBe(5);

      const beforeLine = 3;
      const afterLine = 6;
      // POSITIVE: the before-close label sits inside the clipped extent.
      expect(beforeLine >= frameLine && beforeLine < extentEnd).toBe(true);
      // NEGATIVE: the after-close label, despite being label-shaped and in
      // the same file, sits outside the clipped extent -- exactly the
      // swallow this ruling closes (a frame's extent can never reach past
      // its own template's `</x-dc>`).
      expect(afterLine >= frameLine && afterLine < extentEnd).toBe(false);
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

  // --- DEC-967 wave-42 amendment: the completeness ratchet over every
  // still-unclipped frame-extent derivation in the tree --------------------

  it('non-vacuity: this scan actually finds at least one file (itself, before the fix, or a sibling) that would trip a naive positive-only check', () => {
    // Sanity: the marker combination alone (extentEnd + font-size:19px) is
    // not vacuous -- it currently matches this very file (which passes
    // ONLY because it also contains templateCloseLine) plus its siblings.
    const rootsHaveAnyMarkerFile = EXTENT_SCAN_ROOTS.some((root) =>
      enumerateTsFiles(root).some((f) => {
        const src = readFileSync(f, 'utf-8');
        return EXTENT_DERIVATION_RE.test(src) && FRAME_LABEL_MARKER_RE.test(src);
      })
    );
    expect(rootsHaveAnyMarkerFile).toBe(true);
  });

  it('this file itself is no longer in the unclipped population (it derives extentEnd from a .dc.html label scan but clips it with templateCloseLine)', () => {
    const here = fileURLToPath(import.meta.url);
    expect(UNCLIPPED_EXTENT_DERIVATION_FILES).not.toContain(here);
  });

  it('unclipped extent-derivation files never exceed the ceiling (one-sided ratchet: may only fall as sibling clip lanes land)', () => {
    const detail = UNCLIPPED_EXTENT_DERIVATION_FILES.join('\n');
    expect(
      UNCLIPPED_EXTENT_DERIVATION_FILES.length,
      `unclipped extent-derivation files (${UNCLIPPED_EXTENT_DERIVATION_FILES.length}, ceiling ${UNCLIPPED_EXTENT_DERIVATION_CEILING}):\n${detail}`
    ).toBeLessThanOrEqual(UNCLIPPED_EXTENT_DERIVATION_CEILING);
  });

  it('never sits ABOVE the measured unclipped-file truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (UNCLIPPED_EXTENT_DERIVATION_FILES.length < UNCLIPPED_EXTENT_DERIVATION_CEILING) {
      throw new Error(
        `${UNCLIPPED_EXTENT_DERIVATION_FILES.length} unclipped extent-derivation file(s), below the ` +
          `ratchet ceiling of ${UNCLIPPED_EXTENT_DERIVATION_CEILING}. This is the ratchet working -- ` +
          `tighten the ceiling in the same merge-train commit by replacing the line:\n` +
          `  export const UNCLIPPED_EXTENT_DERIVATION_CEILING = ${UNCLIPPED_EXTENT_DERIVATION_FILES.length};`
      );
    }
    expect(UNCLIPPED_EXTENT_DERIVATION_FILES.length).toBeGreaterThanOrEqual(UNCLIPPED_EXTENT_DERIVATION_CEILING);
  });
});

// Re-exports of the extracted submodules' public surface (contention
// decomposition, no behavior change): everything that used to be defined
// directly in this file is still importable from it.
export { clusterKeyForPath, findingsScopedForSheet, scopeBlobsForSheet } from './phone-hidden-drawn-text/cluster-scope';
export type { SheetScope } from './phone-hidden-drawn-text/cluster-scope';
export { designFiles, templateCloseLine } from './phone-hidden-drawn-text/frame-blobs';
export type { FrameBlob } from './phone-hidden-drawn-text/frame-blobs';
export { findTwin, GENERIC_VERB_MIN_COMPONENTS, genericVerbsIn, gradeRule, hasCorroboration } from './phone-hidden-drawn-text/grade';
export type { Grade, GradedRule } from './phone-hidden-drawn-text/grade';
export { textBearingFindingsIn, tokensOf } from './phone-hidden-drawn-text/text-findings';
export type { TextFinding } from './phone-hidden-drawn-text/text-findings';

export {
  FRAME_BLOBS,
  GRADED_RULES,
  PREMISE_FALSE_ROWS,
  TEXT_FINDINGS,
  TWIN_RESOLVED_ROWS,
  UNVERIFIABLE_ROWS,
};
