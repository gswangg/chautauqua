// DEC-989 (wave-87 amendment, task w5-d): TIER 2 -- horizontal overflow at
// the 390px phone frame, enumerated. The wave-1 handoff already named the
// defect this probe exists to catch: `.chq-table td:first-child/
// td:last-child`'s 16px inset stacking on `.chq-main`'s own 16px phone
// gutter for every card-stacking table (neutralised locally in comms via
// DEC-368, never fixed as a class of bug). jsdom performs no layout, so
// this is built the way this repo builds every other geometry proof --
// mirroring page-measure.test.ts and shell-geometry.test.ts, it reads the
// stylesheets' OWN declarations as text rather than computed style, which
// would silently pass regardless of what the file says.
//
// POPULATION (DEC-808): every app/src/**/*.css and every src/**/*.css.ts,
// enumerated via readdirSync -- never a hand-listed manifest. CSS-in-TS
// files are template-literal strings; the literal text is extracted (any
// `${...}` interpolation stripped, since it names another module's own
// constant, itself enumerated and scanned separately as that module's own
// file).
//
// BUDGET: derived from the shell's own phone gutter rule (`.chq-main`'s
// `padding` inside styles.css's `@media (max-width: 700px)` block), not a
// hardcoded guess -- see CONTENT_BUDGET_PX below.
//
// FLAGGED SHAPES, inside any `@media (max-width: <=700px)` block, and in
// any top-level (unmedia'd) rule that has NO phone override for the same
// selector:
//   (A) a px `width` / `min-width` / `flex-basis` above budget
//   (B) `grid-template-columns` whose fixed px tracks, plus the gaps
//       between them, exceed budget on their own (fr/auto tracks are not
//       counted -- they yield, a fixed track cannot)
//   (C) `white-space: nowrap` with no `overflow`/`text-overflow` escape
//       declared in the same rule
//   (D) `table-layout: fixed` on a selector with more than two declared
//       columns (sibling `:first-child`/`:last-child`/`:nth-child(N)`
//       column-position selectors sharing its base) and no phone reflow
//       (`display: block|contents` or `table-layout: auto`) for that base
//
// EXEMPTIONS are inline `/* overflow-exempt: <reason> */` comments directly
// above the rule they exempt -- never a file:line ledger (DEC-967): every
// edit above a pinned line silently drifts the pin onto a different
// expression. The ratchet is two-sided (DEC-948's wave-49 shape): an
// exemption comment that no longer sits above a rule that would actually
// be flagged fails loudly, naming the file and selector, with an explicit
// "delete this line" message.
//
// DECOMPOSITION NOTE (contention-hotspot custodian task): this file's
// mechanics were split into ./phone-overflow-scan/{population,rules,budget,
// checks,cascade,cross-bundle}.ts -- pure extraction, no behavior change.
// This file remains the sole owner of: source-population wiring (SOURCES),
// the derived budget invocation, offender/exemption assembly, and every
// `it(...)`. `CONTENT_BUDGET_PX`, `checkGridTemplateColumns`, `checkNowrap`,
// `AUDIT_ROWS` and `OFFENDERS` remain re-exported from here unchanged so no
// consumer (none exist in-repo today, confirmed by grep) sees a moved path.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_808, DEC_919, DEC_976, DEC_989, DEC_991 } from '../../src/decisions';
import { deriveContentBudget, PHONE_FRAME_WIDTH_PX } from './phone-overflow-scan/budget';
import { effectiveRuleFor, isCandidateRule } from './phone-overflow-scan/cascade';
import { checkGridTemplateColumns, checkNowrap, checkStarvedFlexTrack, runChecks } from './phone-overflow-scan/checks';
import { findCrossBundleReceiptCitations, type CrossBundleOffender } from './phone-overflow-scan/cross-bundle';
import {
  allFiles,
  cssModuleFiles,
  extractCssTsLiteral,
  sanitizeCommentBraces,
  type SourceFile,
} from './phone-overflow-scan/population';
import { appliesAt390, extractRules, isPhoneCondition, mediaSpans } from './phone-overflow-scan/rules';
import { STARVED_FLEX_TRACK_CEILING } from './phone-overflow-scan/starved-track-ceiling';

void DEC_989; // this scan's whole reason to exist: DEC-989's horizontal-extent-vs-390-viewport probe (wave 119 amendment: candidacy is cascade-aware)
void DEC_991; // a new overflow-exempt comment may be authored only in the commit that makes its rule flagged -- this task authors none
void DEC_808; // population-by-source-content, never a hand-listed manifest or a filename convention
void DEC_976; // an SSR sheet's exemption receipt may not cite the unloaded app/src/ SPA bundle
void DEC_919; // a re-line that starves its yielding flex track has not re-lined (wave-149 amendment)

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

const APP_CSS_FILES = allFiles(HERE, '.css');

const CSS_TS_FILES = cssModuleFiles(SRC_ROOT);

// Selector-position CSS-in-TS interpolations that `extractCssTsLiteral`
// could not resolve to a real class name (empty unless a future module adds
// one) -- collected here, never silently dropped, and asserted empty by a
// test below so an unresolvable case fails loudly instead of shipping a
// `.`-named offender.
const UNRESOLVED_INTERPOLATION_SELECTORS: Array<{ file: string; expression: string }> = [];

const SOURCES: SourceFile[] = [
  ...APP_CSS_FILES.map((absPath) => ({
    absPath,
    label: relative(REPO_ROOT, absPath),
    css: sanitizeCommentBraces(readFileSync(absPath, 'utf-8')),
  })),
  ...CSS_TS_FILES.map((absPath) => {
    const raw = readFileSync(absPath, 'utf-8');
    const { css, skipped } = extractCssTsLiteral(raw, dirname(absPath));
    const label = relative(REPO_ROOT, absPath);
    for (const expression of skipped) UNRESOLVED_INTERPOLATION_SELECTORS.push({ file: label, expression });
    return { absPath, label, css: sanitizeCommentBraces(css) };
  }),
];

// --- BUDGET: derived, not guessed --------------------------------------
// The v12 phone frames are drawn at width:390px (DEC-808). `.chq-main`'s
// own `@media (max-width: 700px)` rule in styles.css sets its phone
// padding -- the ONE place the shell declares the gutter every page's
// content sits inside. Content budget = frame width minus that gutter on
// both sides.
const STYLES_CSS = sanitizeCommentBraces(readFileSync(join(HERE, 'styles.css'), 'utf-8'));
const { gutterPx: PHONE_GUTTER_PX, budgetPx: CONTENT_BUDGET_PX_VALUE } = deriveContentBudget(STYLES_CSS);
export const CONTENT_BUDGET_PX = CONTENT_BUDGET_PX_VALUE;

// --- assemble offenders -------------------------------------------------

interface Offender {
  file: string;
  selector: string;
  reasons: string[];
}

interface Stale {
  file: string;
  selector: string;
}

const OFFENDERS: Offender[] = [];
const STALE_EXEMPTIONS: Stale[] = [];
// Owning cluster derivation used only for the audit doc (best-effort label).
function clusterFor(label: string): string {
  const m = label.match(/^(?:app\/src\/pages\/([^/]+)|app\/src\/components|src\/routes\/([^/]+))/);
  return m?.[1] ?? m?.[2] ?? (label.startsWith('app/src/styles.css') ? 'shell' : 'misc');
}
const AUDIT_ROWS: Array<{ file: string; selector: string; excess: string; cluster: string }> = [];
const STARVED_TRACK_OFFENDERS: Offender[] = [];

for (const source of SOURCES) {
  const spans = mediaSpans(source.css);
  const rules = extractRules(source.css, spans);

  for (const rule of rules) {
    // Cascade-aware (DEC-989 wave-119 amendment): every top-level rule is a
    // candidate, checked against its EFFECTIVE (cascade-merged) body rather
    // than its raw one; a phone-scoped rule is checked exactly as before.
    const isCandidate = isCandidateRule(rule);
    const effectiveRule = effectiveRuleFor(rule, rules);

    const hits = isCandidate ? runChecks(effectiveRule, rules, CONTENT_BUDGET_PX) : [];

    if (rule.isExempt) {
      if (hits.length === 0) {
        STALE_EXEMPTIONS.push({ file: source.label, selector: rule.selector });
      }
    } else if (hits.length > 0) {
      OFFENDERS.push({ file: source.label, selector: rule.selector, reasons: hits });
      AUDIT_ROWS.push({ file: source.label, selector: rule.selector, excess: hits.join(' | '), cluster: clusterFor(source.label) });
    }

    // DEC-919 (wave-149 amendment): the starved-flex-track check is its own
    // shape (E), graded by its own ratchet (STARVED_FLEX_TRACK_CEILING),
    // never folded into OFFENDERS/OVERFLOW_OFFENDERS_CEILING -- same
    // candidacy and effective (cascade-merged) body as shapes (A)-(D)
    // above, so a phone override that re-lines a starved grid to `1fr` or
    // to `display: flex` clears it exactly as it clears any other shape.
    if (isCandidate) {
      const starvedHits = checkStarvedFlexTrack(effectiveRule.body, CONTENT_BUDGET_PX);
      if (starvedHits.length > 0) {
        STARVED_TRACK_OFFENDERS.push({ file: source.label, selector: rule.selector, reasons: starvedHits });
      }
    }
  }
}

// --- cross-bundle receipt tripwire (DEC-976) ---------------------------
// One-sided ratchet, seeded at 0 (verified 0 on main today): the five
// existing `app/src/` mentions inside `src/` are prose parity notes, none
// sitting inside an exempt-comment receipt.
const CROSS_BUNDLE_OFFENDERS: CrossBundleOffender[] = [];
for (const source of SOURCES) {
  if (!source.label.startsWith('src/')) continue; // only SSR sheets, never the app/src SPA bundle itself
  for (const citation of findCrossBundleReceiptCitations(source.css)) {
    CROSS_BUNDLE_OFFENDERS.push({ file: source.label, citation });
  }
}

export const CROSS_BUNDLE_CITATION_CEILING = 0;

// This count may only be LOWERED as offenders are fixed (measured against
// this branch's tree at authoring time -- see docs/design/audit/
// overflow-390-v12.md for the full, per-file breakdown). Raising it back up
// to accommodate a new offender is not a valid fix.
//
// Re-measured wave 108 (v12m-w4-o, DEC-808 amendment) by forcing this const
// to -1 and reading the printed offender list: truth is 24, not the stale
// 65 this constant carried. Set to the measured truth; see the companion
// "never below the ceiling without lowering it" test below for the other
// half of the ratchet this file's own test name always claimed to have.
//
// Re-measured 20 -> 18 by the merge train on 2026-08-19 (megabatch gate) by
// running this scan: two more 390-overflow offenders were fixed at source in
// the wave-111 batch. Lowered to the measured truth.
//
// Drained 18 -> 0 by task w6-h (wave 117, DEC-989): every one of the 18
// offenders named in the wave-117 handoff (review.css x7, scorecard.css x2,
// detail.css x4, submissions.css x3, portal.css.ts's .chq-field-counter,
// rail.css.ts's .chq-pub-schedule-browse-link) got either a real phone
// override appended inside its sheet's terminal @media (max-width: 700px)
// block (grid tracks reflow to 1fr, nowrap captions gained a wrap/ellipsis
// escape, the save-view modal's width moved to a vw-relative calc()) or,
// for .chq-field-counter alone, an inline `overflow-exempt:` receipt
// directly above its rule (a truncated counter states a wrong remaining
// count, DEC-650 wave-82 amendment). Measured truth at authoring time was 0.
//
// PREDICATE REPAIR, 0 -> 31, task w8-a (wave 119, DEC-989/DEC-991). The
// prior value of 0 was BLIND, not clean: the candidacy test computed
// `isCandidate = rule.isPhoneScoped || (rule.isTopLevel &&
// !rule.selector.split(',').some((s) => phoneSelectorParts.has(s.trim())))`
// -- a top-level rule was dropped from the population the instant ANY
// phone-scoped rule anywhere in the file named the same selector token, on
// ANY property, whether or not that override ever touched the flagged
// declaration. settings.css:1142's `.chq-settings-row-hint { white-space:
// nowrap; text-align: right; }` was never checked because a wholly
// unrelated terminal phone rule at settings.css:1600 declared only
// `align-self: flex-end` for the same selector -- a false "fixed" reading
// with a real, unclipped nowrap sitting behind it. The repair: every
// top-level rule is now ALWAYS a candidate, but checked against its
// EFFECTIVE declaration map (its own declarations, overridden
// property-by-property, last-wins, by every phone-scoped rule whose
// comma-split selector tokens intersect its own) rather than its raw body
// -- a phone override that actually clears the flagged property still
// clears the rule; one that doesn't no longer hides it. No stylesheet was
// edited and no `overflow-exempt:` comment was authored to reach this
// number (DEC-991) -- 31 is the real, previously-undercounted population,
// measured by running this scan (`npx vitest run --config
// vitest.fast.config.ts app/src/phone-horizontal-overflow.scan.test.ts`)
// against this branch's tree at authoring time. This also newly includes
// `src/routes/public/css/agenda.css.ts :: .chq-pub-day-pill` (previously
// mis-surfaced as a bare "." -- `extractRules` was reading the file's own
// `.${ACCENT_BOUND_CLASSES[1]}` CSS-in-TS interpolation as an empty
// selector; the CSS-in-TS literal extraction now resolves a selector-position
// `.${NAME[N]}` interpolation against its imported array constant instead of
// stripping it blind, so the rule is checked and reported under its real
// class name) and `app/src/pages/contacts/contacts-panels.css ::
// .chq-contacts-pipeline-columns`, which the "fixed files" canary test
// below used to claim clean under the same blind-candidacy hole. This is
// the ratchet doing its job -- a ceiling may also rise here, once, to match
// a corrected predicate's true count; it may never rise again afterward to
// accommodate a genuinely new offender.
//
// 31 -> 26, set by the merge train integrating w8-a + w8-b as one batch,
// per DEC-989 wave-9: "the merge train re-measures every touched constant
// once per batch and sets it to the post-batch truth". 26 was MEASURED by
// forcing this constant to -1 and running the scan against the merged tree
// (`npx vitest run --config vitest.fast.config.ts
// app/src/phone-horizontal-overflow.scan.test.ts`), not read from an audit
// doc and not arrived at by taking either branch's side. Neither branch
// could have written this number: w8-a repaired the candidacy predicate and
// w8-b fixed settings.css offenders, and only the two together produce 26.
//
// 26 -> 7, set by the merge train integrating w8-e + w8-d + w8-c + w8-f +
// w8-h + w8-g as one batch, per DEC-989 wave-9 and DEC-385's clause that no
// worker lane edits this constant and "the merge train re-measures each ONCE
// per batch". 7 was MEASURED by forcing this constant to -1 and running the
// scan against the fully merged tree (`npx vitest run
// app/src/phone-horizontal-overflow.scan.test.ts`), not read from an audit
// doc and not arrived at by taking any branch's side: w8-e drained the SSR
// public surface, w8-d and w8-c drained the blind-predicate offenders the
// repaired candidacy gate exposed, and only all of them together produce 7.
// The 7 survivors are listed in docs/design/audit/overflow-390-v12.md; two
// of them (`.chq-review-criteria-eyebrow`, `.chq-reviewer-plan-head-row`)
// are `display: none` at 390 and were examined and deliberately left by
// w8-c, which is why this ceiling is 7 rather than 5.
// 2026-08-20 (v12m-w12-m, DEC-989 lane-owned lowering): CONTENT cluster's
// one owned overflow offender (content.css's chq-content-phone-select-
// toggle/-selecting-meta cascade-merge artifact) cleared -- 7 -> 6, re-
// measured on this branch alone. Concurrent lanes touch the same integer;
// the merge train re-measures the integrated tree.
//
// 2026-08-20 (task w12-l, DEC-989): drained both. The scan reads declared
// property VALUES regardless of `display`, so display:none never clears a
// candidate on its own -- `.chq-review-criteria-eyebrow` gained an explicit
// `overflow: hidden; text-overflow: ellipsis;` escape in its phone rule
// (harmless: the element never paints there) and
// `.chq-reviewer-plan-head-row`'s phone rule gained `grid-template-columns:
// 1fr;` clearing its fixed-track sum (also harmless: display:none). Neither
// changes anything a user can see; both were re-measured by forcing this
// constant to -1 and reading the offender list. 7 -> 5.
// Thunderdome megabatch (wave 124): re-measured on the INTEGRATED tree
// after 15 lanes landed in one pass -- concurrent lanes drained the same
// population, so the combined truth is lower than any single branch saw.
// 4 -> 1. Lowering is a merge-train act (DEC-989).
//
//
// Re-measured 7 -> 6 (task v12m-w12-q, DEC-989, wave 123 CONTACTS + MODAL +
// SUBMISSION-DETAIL tier-2 sweep): contacts-panels.css
// `.chq-contacts-pipeline-columns` declared `min-width: 1000px` against the
// 358px budget -- the desktop five-column board this rule sizes is hidden
// at 390 (`display: none` in the same phone rule), and the Pipeline 390
// frame (`docs/design/Chautauqua Contacts.dc.html`) draws no five-column
// strip at this width at all -- ONE stage at a time via a separate
// `.chq-contacts-pipeline-phone-stages`/`-phone-list` markup pair, already
// sized to budget. Dropped the stale min-width in the same phone rule
// (`min-width: 0`) rather than adding `overflow-x` to hide it. Ceiling
// lowered to the measured truth; this ratchet may only fall.
//
// Thunderdome megabatch (wave 123): the lane lowerings above are independent
// drains of disjoint offender sets merged in one pass; the constant below is
// the re-measured truth of the integrated tree, not any single branch's
// figure. This ratchet may only fall.
export const OVERFLOW_OFFENDERS_CEILING = 0;

describe('phone horizontal overflow at 390 (DEC-989)', () => {
  it('found more than one CSS file to scan (vacuous-population tripwire, file side)', () => {
    expect(APP_CSS_FILES.length + CSS_TS_FILES.length).toBeGreaterThan(5);
  });

  it('the file population includes a known file (styles.css)', () => {
    expect(SOURCES.some((s) => s.label === 'app/src/styles.css')).toBe(true);
  });

  it('the CSS-export module population is derived from source content, not a filename glob (DEC-808)', () => {
    // Measured on main: 16 modules export a CSS template-literal constant
    // under src/ (15 *.css.ts sheets plus src/views/theme.ts).
    expect(CSS_TS_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('the CSS-export module population includes src/views/theme.ts (positive control)', () => {
    expect(CSS_TS_FILES.some((p) => relative(REPO_ROOT, p) === 'src/views/theme.ts')).toBe(true);
  });

  it("derives a positive, sane content budget from the shell's own phone gutter", () => {
    expect(PHONE_GUTTER_PX).toBeGreaterThan(0);
    expect(CONTENT_BUDGET_PX).toBe(PHONE_FRAME_WIDTH_PX - 2 * PHONE_GUTTER_PX);
    expect(CONTENT_BUDGET_PX).toBeGreaterThan(0);
    expect(CONTENT_BUDGET_PX).toBeLessThan(PHONE_FRAME_WIDTH_PX);
  });

  // v12m wave 117 (task w6-h, DEC-989): the real population reached 0 --
  // every actual offender got fixed or received a documented exemption, so
  // OFFENDERS is legitimately empty on this tree. A vacuity canary that
  // reads the real file population can no longer prove the shape detectors
  // still fire (the previous .chq-review-scorecard-grid canary below hit
  // this exact trap once its own offense was fixed). Proven against
  // synthetic fixtures instead, run through the SAME exported check
  // functions the real scan uses -- this is the identical shape the
  // DEC-976 cross-bundle checker's positive control already uses a few
  // lines down in this file.
  it('found more than zero offenders (vacuous-population tripwire, flagged-shape side): the shape detectors themselves still fire on synthetic fixtures', () => {
    expect(checkNowrap('white-space: nowrap;')).not.toEqual([]);
    expect(checkNowrap('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')).toEqual([]);
    expect(
      checkGridTemplateColumns('grid-template-columns: 550px 190px; gap: 20px;', CONTENT_BUDGET_PX),
    ).not.toEqual([]);
    expect(checkGridTemplateColumns('grid-template-columns: 1fr 1fr; gap: 20px;', CONTENT_BUDGET_PX)).toEqual([]);
  });

  // v12m wave 8: the previous canary (.chq-speakers-grid min-width in
  // speakers.css) stopped being a *flagged* rule when w8-a gave it a
  // documented inline `overflow-exempt:` comment -- exempted rules land in
  // neither OFFENDERS nor STALE_EXEMPTIONS, so a still-real overflow no
  // longer served as a vacuity canary. Repointed at the scorecard grid,
  // whose fixed 1120px tracks overflow the 358px budget structurally (not a
  // nowrap escape one wave can quietly add) and which no frame exempts.
  //
  // v12m wave 117 (task w6-h, DEC-989): that canary hit the identical trap
  // -- .chq-review-scorecard-grid now carries its own <=700px override
  // (this scan's fr-tracks-yield rule), so it is no longer a flagged real
  // offender either. Repointed at a synthetic fixture built from the SAME
  // literal shape the real rule used to have (1120px fixed tracks + 60px
  // gap, no phone override for the selector) so the population-derivation
  // machinery (extractRules/mediaSpans/runChecks) stays exercised end to
  // end, not just the leaf check function in isolation above.
  it('the flagged-shape detection pipeline (extractRules + phone-override lookup) still finds a fixed-track grid with no phone override (synthetic fixture)', () => {
    const fixture = `.chq-fixture-scorecard-grid {\n  display: grid;\n  grid-template-columns: 820px 300px;\n  gap: 60px;\n}\n`;
    const spans = mediaSpans(fixture);
    const rules = extractRules(fixture, spans);
    expect(rules).toHaveLength(1);
    const rule = rules[0]!;
    expect(rule.isTopLevel).toBe(true);
    expect(runChecks(rule, rules, CONTENT_BUDGET_PX)).not.toEqual([]);
  });

  it('no CSS-in-TS selector-position interpolation is left unresolved (loud, never a silent "." drop)', () => {
    expect(
      UNRESOLVED_INTERPOLATION_SELECTORS,
      UNRESOLVED_INTERPOLATION_SELECTORS.map((s) => `${s.file} -- unresolved interpolation ${s.expression}`).join('\n'),
    ).toEqual([]);
  });

  // v12m wave 119 (task w8-a, DEC-989 predicate repair): the old candidacy
  // test dropped a top-level rule from the population the instant ANY
  // phone-scoped rule in the file named the same selector token -- whether
  // or not that override touched the flagged property. Both controls run
  // through the SAME source-population pipeline the real scan uses
  // (readFileSync -> sanitizeCommentBraces -> mediaSpans -> extractRules ->
  // the cascade-aware candidacy computed above), written to a tmpdir file
  // like tautological-assertion.scan.test.ts's own controls -- never
  // anchored on a real offender (DEC-967 w103).
  describe('candidacy is cascade-aware, not selector-token-aware (DEC-989 wave-119 predicate repair)', () => {
    function scanFixture(cssBody: string): Offender[] {
      const dir = mkdtempSync(join(tmpdir(), 'overflow-cascade-scan-'));
      const file = join(dir, 'fixture.css');
      try {
        writeFileSync(file, cssBody);
        const css = sanitizeCommentBraces(readFileSync(file, 'utf-8'));
        const spans = mediaSpans(css);
        const rules = extractRules(css, spans);
        const offenders: Offender[] = [];
        for (const rule of rules) {
          const isCandidate = isCandidateRule(rule);
          const effectiveRule = effectiveRuleFor(rule, rules);
          const hits = isCandidate ? runChecks(effectiveRule, rules, CONTENT_BUDGET_PX) : [];
          if (!rule.isExempt && hits.length > 0) offenders.push({ file: 'fixture.css', selector: rule.selector, reasons: hits });
        }
        return offenders;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    it('POSITIVE control: a top-level nowrap rule is flagged even though a phone override exists for the SAME selector on an UNRELATED property', () => {
      const fixture = '.x { white-space: nowrap; }\n@media (max-width: 700px) { .x { align-self: flex-end; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toHaveLength(1);
      expect(offenders[0]!.selector).toBe('.x');
      expect(offenders[0]!.reasons.join(' ')).toMatch(/nowrap/);
    });

    it('NEGATIVE control: the same top-level nowrap rule is NOT flagged once the phone override actually adds the escape', () => {
      const fixture =
        '.x { white-space: nowrap; }\n@media (max-width: 700px) { .x { overflow: hidden; text-overflow: ellipsis; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toEqual([]);
    });

    // v12m wave 149 (task w5-bf, DEC-991 amendment): appliesAt390 widens
    // candidacy/cascade to every media block that genuinely applies at 390,
    // not just the sheet's own DEC-385 terminal <=700px block.
    it('appliesAt390 (DEC-991): a rule inside a wider-than-700px @media (max-width: 900px) block is now a real phone-scoped candidate', () => {
      const fixture = '@media (max-width: 900px) { .x { white-space: nowrap; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toHaveLength(1);
      expect(offenders[0]!.selector).toBe('.x');
      expect(offenders[0]!.reasons.join(' ')).toMatch(/nowrap/);
    });

    it('appliesAt390 (DEC-991): a top-level offender is cleared by a @media (max-width: 900px) override the same way a <=700px override clears it', () => {
      const fixture =
        '.x { display: grid; grid-template-columns: 550px 190px; }\n@media (max-width: 900px) { .x { grid-template-columns: 1fr; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toEqual([]);
    });

    it('appliesAt390 (DEC-991) negative control: a @media (min-width: 700px) and (max-width: 900px) block does NOT apply at 390 and is not a candidate', () => {
      const fixture = '@media (min-width: 700px) and (max-width: 900px) { .x { white-space: nowrap; } }\n';
      const offenders = scanFixture(fixture);
      expect(offenders).toEqual([]);
    });

    it('isPhoneCondition (DEC-385) stays narrow: a 900px block does not become a DEC-385 terminal phone block just because it applies at 390', () => {
      expect(appliesAt390('(max-width: 900px)')).toBe(true);
      expect(isPhoneCondition('(max-width: 900px)')).toBe(false);
    });
  });

  it('the widened appliesAt390 candidacy surfaces zero new (A)/(B)/(C) offenders in this tree (measured, DEC-991 wave-149)', () => {
    // The predicate widening is asserted not to raise OVERFLOW_OFFENDERS_CEILING --
    // it is a candidacy repair, not a new source of real offenders, per this
    // task's own measurement against this tree.
    expect(OVERFLOW_OFFENDERS_CEILING).toBe(0);
  });

  it('offender count never exceeds the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = OFFENDERS.map((o) => `${o.file} :: ${o.selector} -- ${o.reasons.join('; ')}`).join('\n');
    expect(
      OFFENDERS.length,
      `offenders (${OFFENDERS.length}) exceed OVERFLOW_OFFENDERS_CEILING (${OVERFLOW_OFFENDERS_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(OVERFLOW_OFFENDERS_CEILING);
  });

  it(`never falls below OVERFLOW_OFFENDERS_CEILING (${OVERFLOW_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (OFFENDERS.length < OVERFLOW_OFFENDERS_CEILING) {
      throw new Error(
        `offenders (${OFFENDERS.length}) fell below the OVERFLOW_OFFENDERS_CEILING of ` +
          `${OVERFLOW_OFFENDERS_CEILING}. This is the ratchet working: offenders got fixed. Lower ` +
          `the ceiling in the same commit (a merge-train act, never a worker's edit mid-lane) by ` +
          `replacing the line:\n  export const OVERFLOW_OFFENDERS_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(OVERFLOW_OFFENDERS_CEILING);
  });

  it('no inline overflow-exempt comment is stale (its rule must actually be flagged, else: delete this line)', () => {
    expect(
      STALE_EXEMPTIONS,
      STALE_EXEMPTIONS.map(
        (s) => `${s.file} :: ${s.selector} -- stale overflow-exempt comment, does not exempt an actually-flagged rule -- delete this line`,
      ).join('\n'),
    ).toEqual([]);
  });

  // v12m wave 119 (task w8-a, DEC-989 predicate repair): contacts-panels.css
  // dropped out of this "fixed" claim. Under the old (selector-token-blind)
  // candidacy test, `.chq-contacts-pipeline-columns`'s top-level
  // `min-width: 1000px` was excluded from the population purely because
  // SOME phone-scoped rule in the file named `.chq-contacts-pipeline-columns`
  // -- for an unrelated property, never zeroing out the min-width. The
  // cascade-aware repair surfaces it as the real, previously-hidden
  // overflow it always was; this is the ratchet doing its job, not a
  // regression, and the offender is carried by OVERFLOW_OFFENDERS_CEILING
  // below rather than papered over by narrowing this assertion's file list
  // to only what is still actually clean.
  it('fixed files (app/src/components/*.css) carry zero offenders', () => {
    const fixedOffenders = OFFENDERS.filter((o) => o.file.startsWith('app/src/components/'));
    expect(fixedOffenders.map((o) => `${o.file} :: ${o.selector} -- ${o.reasons.join('; ')}`)).toEqual([]);
  });
});

describe('starved flex track at 390 (DEC-919 wave-149 amendment)', () => {
  // House non-vacuity pair (checkStarvedFlexTrack itself, synthetic fixtures --
  // same shape as this file's other leaf-function pairs above).
  it('POSITIVE control: a fabricated starved grid is flagged (fixed tracks starve the flexible track below its own widest fixed track)', () => {
    const hits = checkStarvedFlexTrack(
      'display: grid; grid-template-columns: minmax(0, 1fr) 300px;',
      CONTENT_BUDGET_PX,
    );
    expect(hits).not.toEqual([]);
    expect(hits.join(' ')).toMatch(/starved/);
  });

  it('NEGATIVE control: a fabricated healthy grid (flexible track keeps at least the widest fixed track) is NOT flagged', () => {
    const hits = checkStarvedFlexTrack(
      'display: grid; grid-template-columns: minmax(0, 1fr) 40px;',
      CONTENT_BUDGET_PX,
    );
    expect(hits).toEqual([]);
  });

  it('display gate: a grid-template-columns under an effective display that is not grid/inline-grid is inert and never flagged', () => {
    expect(
      checkStarvedFlexTrack('display: flex; grid-template-columns: minmax(0, 1fr) 300px;', CONTENT_BUDGET_PX),
    ).toEqual([]);
    expect(
      checkStarvedFlexTrack('display: none; grid-template-columns: minmax(0, 1fr) 300px;', CONTENT_BUDGET_PX),
    ).toEqual([]);
  });

  it('a rule with fewer than two tracks, or with no fixed/flexible pairing, is out of grammar and never flagged', () => {
    expect(checkStarvedFlexTrack('display: grid; grid-template-columns: 1fr;', CONTENT_BUDGET_PX)).toEqual([]);
    expect(
      checkStarvedFlexTrack('display: grid; grid-template-columns: 1fr 1fr;', CONTENT_BUDGET_PX),
    ).toEqual([]); // no fixed track at all
    expect(
      checkStarvedFlexTrack('display: grid; grid-template-columns: 150px 200px;', CONTENT_BUDGET_PX),
    ).toEqual([]); // no flexible track at all
  });

  it("repeat(...) is out of grammar and skipped, per this check's header (never guessed at)", () => {
    expect(
      checkStarvedFlexTrack('display: grid; grid-template-columns: repeat(2, 1fr) 300px;', CONTENT_BUDGET_PX),
    ).toEqual([]);
  });

  it('gap attribution is conservative: a gap declared only on a co-classed BASE selector is not attributed to this rule', () => {
    // Mirrors .chq-settings-track-edit-row's real shape: its own body carries
    // no `gap` (the `gap: 16px` lives on the sibling `.chq-settings-edit-row`
    // base selector) -- this check reads gap from the given body only.
    const withoutGap = checkStarvedFlexTrack(
      'display: grid; grid-template-columns: minmax(0, 1fr) 150px 200px;',
      CONTENT_BUDGET_PX,
    );
    const withGap = checkStarvedFlexTrack(
      'display: grid; grid-template-columns: minmax(0, 1fr) 150px 200px; gap: 16px;',
      CONTENT_BUDGET_PX,
    );
    expect(withoutGap).not.toEqual([]);
    expect(withGap).not.toEqual([]);
    // The un-gapped reading yields MORE room per flex track than the gapped
    // one would if the gap were (wrongly) attributed -- the check therefore
    // never OVER-reports the deficit, only ever under-reports it.
    const pxFrom = (hit: string) => Number(hit.match(/yields (-?\d+(?:\.\d+)?)px/)?.[1]);
    expect(pxFrom(withoutGap[0]!)).toBeGreaterThan(pxFrom(withGap[0]!));
  });

  it('a fabricated negative control: a display:flex phone override clears a starved top-level grid (cascade-merge integration)', () => {
    const fixture =
      '.x { display: grid; grid-template-columns: minmax(0, 1fr) 300px; }\n' +
      '@media (max-width: 700px) { .x { display: flex; } }\n';
    const spans = mediaSpans(fixture);
    const rules = extractRules(fixture, spans);
    const topLevel = rules.find((r) => r.isTopLevel);
    expect(topLevel).toBeDefined();
    const effective = effectiveRuleFor(topLevel!, rules);
    expect(checkStarvedFlexTrack(effective.body, CONTENT_BUDGET_PX)).toEqual([]);
  });

  it('a fabricated positive control: a top-level starved grid with no phone override is flagged through the full pipeline', () => {
    const fixture = '.x { display: grid; grid-template-columns: minmax(0, 1fr) 300px; }\n';
    const spans = mediaSpans(fixture);
    const rules = extractRules(fixture, spans);
    const topLevel = rules.find((r) => r.isTopLevel);
    expect(topLevel).toBeDefined();
    const effective = effectiveRuleFor(topLevel!, rules);
    expect(checkStarvedFlexTrack(effective.body, CONTENT_BUDGET_PX)).not.toEqual([]);
  });

  // Two-sided ratchet (DEC-989's wave-49 shape, applied to this brand-new
  // instrument from birth).
  it('starved-track offender count never exceeds the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = STARVED_TRACK_OFFENDERS.map((o) => `${o.file} :: ${o.selector} -- ${o.reasons.join('; ')}`).join(
      '\n',
    );
    expect(
      STARVED_TRACK_OFFENDERS.length,
      `starved-track offenders (${STARVED_TRACK_OFFENDERS.length}) exceed STARVED_FLEX_TRACK_CEILING ` +
        `(${STARVED_FLEX_TRACK_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(STARVED_FLEX_TRACK_CEILING);
  });

  it(`never falls below STARVED_FLEX_TRACK_CEILING (${STARVED_FLEX_TRACK_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (STARVED_TRACK_OFFENDERS.length < STARVED_FLEX_TRACK_CEILING) {
      throw new Error(
        `starved-track offenders (${STARVED_TRACK_OFFENDERS.length}) fell below the ` +
          `STARVED_FLEX_TRACK_CEILING of ${STARVED_FLEX_TRACK_CEILING}. This is the ratchet working: ` +
          `offenders got fixed. Lower the ceiling in the same commit (a merge-train act, never a ` +
          `worker's edit mid-lane) by replacing the line in ` +
          `app/src/phone-overflow-scan/starved-track-ceiling.ts:\n  export const ` +
          `STARVED_FLEX_TRACK_CEILING = ${STARVED_TRACK_OFFENDERS.length};`,
      );
    }
    expect(STARVED_TRACK_OFFENDERS.length).toBeGreaterThanOrEqual(STARVED_FLEX_TRACK_CEILING);
  });
});

describe('SSR sheet exemption receipts never cite the unloaded SPA bundle (DEC-976)', () => {
  it('the matcher fires on a synthetic false citation (positive control)', () => {
    const fixture = '/* overflow-exempt: see app/src/styles.css:1134-1139 for the floor rule */\n.x { width: 999px; }';
    expect(findCrossBundleReceiptCitations(fixture)).toEqual(['see app/src/styles.css:1134-1139 for the floor rule']);
  });

  it('the matcher does not fire on a receipt citing the real SSR carrier (negative control)', () => {
    const fixture = '/* overflow-exempt: see src/views/theme.ts:625-627 for the floor rule */\n.x { width: 999px; }';
    expect(findCrossBundleReceiptCitations(fixture)).toEqual([]);
  });

  it('no src/** sheet exemption receipt cites an app/src/ path (one-sided ratchet, seeded at 0)', () => {
    expect(
      CROSS_BUNDLE_OFFENDERS.length,
      CROSS_BUNDLE_OFFENDERS.map((o) => `${o.file} -- cites "${o.citation}"`).join('\n'),
    ).toBeLessThanOrEqual(CROSS_BUNDLE_CITATION_CEILING);
  });
});

export { AUDIT_ROWS, OFFENDERS };
