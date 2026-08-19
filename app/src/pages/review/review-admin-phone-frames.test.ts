// v12 design pack — v12m-w5-b (wave 87, DEC-018/DEC-393):
//
//   "Plan editor · 390" (Chautauqua Review.dc.html:594) — the
//   criteria list, the reviewers list, and the docked Save/Cancel footer.
//   Receipted per-line in the "v12 phone frame" describe block below.
//
// Plus the confirmed-failing interaction fix (DEC-393 w87): PlanList.tsx's
// per-plan row actions (Progress/Results/Edit), measured at 21px on a
// phone.
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts — these are
// source-scan pins on review.css's TEXT, not computed style.
//
// Two standing rules pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY. A min-width query anywhere in review.css is a hard failure
//     here.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px, and an interactive
//     element needs min-height PLUS centred flex PLUS non-zero horizontal
//     padding — padding alone does not reach the floor, and without
//     padding a bare text link's hit box is only as wide as its text.
//
// Desktop is frozen: every assertion below reads only inside a max-width
// block, and PlanEditor.render.test.tsx / PlanList.render.test.tsx (this
// task's own targeted run) pin the unchanged desktop markup/behaviour.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments are stripped before any brace scanning: review.css carries long
 * explanatory comments, and a literal `{`/`}` inside one (a class-name
 * example, a `var(--x, #hex)` reference) would desynchronise the depth
 * counter and silently truncate a block. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const REVIEW_CSS = read('review.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`.
 * Brace-matched rather than regex-bounded, so a nested rule can never end
 * the block early. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** A single rule's declaration body, by selector, inside the phone layer.
 * Selectors are compared as WHOLE members of the rule's selector list, not
 * by substring. When the same selector is declared more than once in the
 * phone layer (this task's own block intentionally restates a few
 * selectors review.css already collapses at 700px, e.g.
 * .chq-review-criterion-row), the LAST declaration wins -- matching the
 * cascade, and matching how v12m-w5-b's block (appended at the very end of
 * the file) actually overrides the earlier ones. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  let found: string | null = null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) found = m[2]!;
  }
  if (found === null) throw new Error(`no phone rule for ${selector}`);
  return found;
}

describe('DEC-385: review.css phone layer is single-direction', () => {
  it('declares no min-width media query', () => {
    expect(REVIEW_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('has at least one max-width phone block', () => {
    expect(phoneLayer(REVIEW_CSS).length).toBeGreaterThan(0);
  });
});

describe('DESIGN-RULINGS: the v12m-w5-b block never authors a min-height below 44px', () => {
  it('floors every authored min-height in the appended block at 44px', () => {
    // The block's own explanatory comment is stripped by `read()` along
    // with every other comment, so the marker is the block's first
    // selector instead of its header prose.
    const marker = REVIEW_CSS.indexOf('.chq-review-plan-action-link');
    expect(marker).toBeGreaterThan(0);
    const own = REVIEW_CSS.slice(marker);
    const heights = [...own.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('DEC-393 w87: the plan-row actions floor (PlanList.tsx, review.css)', () => {
  it('gives each Progress/Results/Edit link min-height, centred flex AND non-zero horizontal padding', () => {
    // review.css:117 `.chq-review-plan-actions { display: flex; gap: 14px; ... }`
    // declares the shared row -- untouched by this task. The floor is on
    // each Link individually: min-height alone (or padding alone) is not
    // the rule DESIGN-RULINGS.md:189 names.
    const rule = phoneRule(REVIEW_CSS, '.chq-review-plan-action-link');
    expect(rule).toMatch(/display:\s*inline-flex/);
    expect(rule).toMatch(/align-items:\s*center/);
    expect(rule).toMatch(/justify-content:\s*center/);
    expect(rule).toMatch(/min-height:\s*44px/);
    expect(rule).toMatch(/padding:\s*0 14px/);
  });

  it('PlanList.tsx actually applies the class the phone rule targets', () => {
    const tsx = readFileSync(join(HERE, 'PlanList.tsx'), 'utf-8');
    const linkBlocks = [...tsx.matchAll(/<Link\b[^>]*>/g)].map((m) => m[0]);
    const planActionLinks = linkBlocks.filter((b) => /to=\{`\/review\/plans\/\$\{plan\.id\}/.test(b));
    expect(planActionLinks.length).toBe(3);
    for (const link of planActionLinks) {
      expect(link).toMatch(/className="chq-review-plan-action-link"/);
    }
  });
});

// docs/design/Chautauqua Review.dc.html:594
// `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
describe('v12 phone frame "Plan editor · 390" (Chautauqua Review.dc.html:594)', () => {
  it('Criteria head (:601 `Criteria`, :602 count) reads a bare count, not the desktop eyebrow sentence', () => {
    expect(phoneRule(REVIEW_CSS, '.chq-review-criteria-eyebrow')).toMatch(/display:\s*none/);
    const count = phoneRule(REVIEW_CSS, '.chq-review-criteria-count-phone');
    expect(count).toMatch(/font-size:\s*12px/);
    expect(count).toMatch(/font-weight:\s*700/);
  });

  it('stacks each criterion into a card: :606 label min-height:48px, guidance stays editable at 46px', () => {
    const row = phoneRule(REVIEW_CSS, '.chq-review-criterion-row');
    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/flex-wrap:\s*wrap/);

    // No drag handle at 390 (the frame draws none on the criterion card
    // itself -- only the Options sub-rows carry one, :616).
    expect(phoneRule(REVIEW_CSS, '.chq-review-criterion-row > .chq-forms-field-drag')).toMatch(/display:\s*none/);

    const anyInput = phoneRule(REVIEW_CSS, '.chq-review-criterion-row > input.chq-input');
    expect(anyInput).toMatch(/flex:\s*1 1 100%/);
    expect(anyInput).toMatch(/min-height:\s*46px/);

    // :606 `min-height:48px` on the label field specifically.
    const labelField = phoneRule(REVIEW_CSS, '.chq-review-criterion-row > input.chq-input:nth-of-type(1)');
    expect(labelField).toMatch(/min-height:\s*48px/);
  });

  it('Options sub-block (:612-622): handle + 46px option field + Remove, "Add an option" at 44px', () => {
    expect(phoneRule(REVIEW_CSS, '.chq-review-criterion-options')).toMatch(/flex:\s*1 1 100%/);

    // :616 the option row's own drag handle stays -- only the OUTER
    // criterion row's handle (:601-658 has none) is hidden.
    const optionRow = phoneRule(REVIEW_CSS, '.chq-review-criterion-option-row');
    expect(optionRow).toMatch(/min-height:\s*44px/);
    expect(phoneRule(REVIEW_CSS, '.chq-review-criterion-option-row .chq-input')).toMatch(/min-height:\s*46px/);

    const optionRemove = phoneRule(REVIEW_CSS, '.chq-review-criterion-option-row .chq-btn-tertiary');
    expect(optionRemove).toMatch(/min-height:\s*44px/);
    expect(optionRemove).toMatch(/padding:\s*0 14px/);

    // :622 `Add an option` min-height:44px.
    const addOption = phoneRule(REVIEW_CSS, '.chq-review-criterion-options-footer .chq-review-add-link');
    expect(addOption).toMatch(/min-height:\s*44px/);
  });

  it('Weight row (:628 58px/44px numeric field, :632 the Choice no-weight note, :634 right-pushed Remove)', () => {
    const weight = phoneRule(REVIEW_CSS, '.chq-review-criterion-weight .chq-input');
    expect(weight).toMatch(/width:\s*58px/);
    expect(weight).toMatch(/min-height:\s*44px/);

    // :632 `Recorded as a spread · no weight` -- rendered phone-only from
    // PlanEditor.tsx for a Choice (dropdown) criterion.
    expect(REVIEW_CSS).toMatch(/chq-review-criterion-no-weight-phone/);
    const tsx = readFileSync(join(HERE, 'PlanEditor.tsx'), 'utf-8');
    expect(tsx).toMatch(/chq-review-criterion-no-weight-phone/);
    expect(tsx).toMatch(/Recorded as a spread · no weight/);

    // :634 `margin-left:auto` on Remove, min-height:44px.
    const remove = phoneRule(REVIEW_CSS, '.chq-review-criterion-row > .chq-btn-tertiary');
    expect(remove).toMatch(/margin-left:\s*auto/);
    expect(remove).toMatch(/min-height:\s*44px/);
    expect(remove).toMatch(/padding:\s*0 14px/);
  });

  it('"Add criterion" (:639) sits at 44px above the cap note (:640)', () => {
    const addCriterion = phoneRule(REVIEW_CSS, '.chq-review-add-criteria .chq-review-add-link');
    expect(addCriterion).toMatch(/min-height:\s*44px/);
    expect(phoneRule(REVIEW_CSS, '.chq-review-criteria-cap-notice')).toMatch(/font-size:\s*12px/);
  });

  it('Reviewers head (:643 `Reviewers`, :644 count) reads a bare count alongside the toggle', () => {
    const toggle = phoneRule(REVIEW_CSS, '.chq-review-section-head-actions .chq-link-button');
    expect(toggle).toMatch(/min-height:\s*44px/);
    expect(toggle).toMatch(/padding:\s*0 14px/);
    const count = phoneRule(REVIEW_CSS, '.chq-review-reviewers-count-phone');
    expect(count).toMatch(/font-weight:\s*700/);
  });

  it('each reviewer row (:649 name 16px/600, :650 track · load 12px muted, :652 the action at 44px with padding 0 14px)', () => {
    const name = phoneRule(REVIEW_CSS, '.chq-review-reviewer-name');
    expect(name).toMatch(/font-size:\s*16px/);
    expect(name).toMatch(/font-weight:\s*600/);
    expect(name).toMatch(/letter-spacing:\s*-0\.015em/);

    const track = phoneRule(REVIEW_CSS, '.chq-review-reviewer-track');
    expect(track).toMatch(/font-size:\s*12px/);

    const action = phoneRule(REVIEW_CSS, '.chq-review-reviewer-row > .chq-btn-tertiary');
    expect(action).toMatch(/min-height:\s*44px/);
    expect(action).toMatch(/padding:\s*0 14px/);
    expect(action).toMatch(/margin-left:\s*auto/);
  });

  it('the Cap each / Distribute run moves BELOW the roster via order (frame :657-661), never in the DOM', () => {
    const capRow = phoneRule(REVIEW_CSS, '.chq-review-cap-row');
    expect(capRow).toMatch(/order:\s*1/);
    // :657 `Cap each` -> a 62px/44px field.
    expect(phoneRule(REVIEW_CSS, '.chq-review-cap-input input')).toMatch(/width:\s*62px/);
    expect(phoneRule(REVIEW_CSS, '.chq-review-cap-input input')).toMatch(/min-height:\s*44px/);
    // :661 `Distribute the unassigned` -> 46px.
    const distribute = phoneRule(REVIEW_CSS, '.chq-review-cap-row > .chq-btn-secondary');
    expect(distribute).toMatch(/min-height:\s*46px/);

    // Confirms the cap row is genuinely still inside .chq-section (a flex
    // column, styles.css) so `order` actually reorders it against the
    // roster rows -- not a re-parented, unrelated container.
    const tsx = readFileSync(join(HERE, 'PlanEditor.tsx'), 'utf-8');
    const sectionOpen = tsx.indexOf('Who reviews what');
    const capRowIndex = tsx.indexOf('chq-review-cap-row', sectionOpen);
    const firstReviewerRow = tsx.indexOf('chq-review-reviewer-row', sectionOpen);
    expect(sectionOpen).toBeGreaterThan(0);
    expect(capRowIndex).toBeGreaterThan(sectionOpen);
    expect(firstReviewerRow).toBeGreaterThan(capRowIndex);
  });

  it('docks Save/Cancel to the device bottom (:665-667 border-top, 48px targets, flex:1 primary)', () => {
    const actions = phoneRule(REVIEW_CSS, '.chq-review-editor-title-actions');
    expect(actions).toMatch(/position:\s*fixed/);
    expect(actions).toMatch(/bottom:\s*0/);
    expect(actions).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);

    const btn = phoneRule(REVIEW_CSS, '.chq-review-editor-title-actions .chq-btn');
    expect(btn).toMatch(/min-height:\s*48px/);

    const primary = phoneRule(REVIEW_CSS, '.chq-review-editor-title-actions .chq-btn-primary');
    expect(primary).toMatch(/flex:\s*1/);

    // The fixed dock escapes .chq-review-editor's normal flow -- the last
    // criterion/reviewer content must not render underneath it.
    expect(phoneRule(REVIEW_CSS, '.chq-review-editor')).toMatch(/padding-bottom:\s*84px/);
  });
});
