// DEC-744: subscreens hugged the left edge of a 1372px desktop frame
// because each page hand-copied its own px max-width clamp (720px in
// forms.css, 660px in review.css) instead of sharing one measure with
// the token styles.css already defines for .chq-measure. The fix moves
// every page-content clamp onto a single --chq-measure custom property
// so the whole product's reading column moves together. Mirroring the
// source-scan approach in shell-geometry.test.ts (jsdom does not
// evaluate an external stylesheet's layout), this test reads the CSS
// files' own text and asserts on the declarations directly.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_CSS = readFileSync(join(HERE, 'styles.css'), 'utf-8');
const FORMS_CSS = readFileSync(join(HERE, 'pages/forms/forms.css'), 'utf-8');
const REVIEW_CSS = readFileSync(join(HERE, 'pages/review/review.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  // Strip every @media {...} block first so a nested override of the same
  // selector doesn't get picked up as the top-level rule.
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/** Every top-level `selector { body }` rule, with @media blocks stripped. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

describe('page measure (DEC-744)', () => {
  it('styles.css defines --chq-measure in the :root token block', () => {
    const rootBody = topLevelRuleBody(STYLES_CSS, ':root');
    expect(rootBody).toMatch(/--chq-measure:\s*820px/);
  });

  it('.chq-measure consumes the --chq-measure var, not a hard-coded px', () => {
    const body = topLevelRuleBody(STYLES_CSS, '.chq-measure');
    expect(body).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(body).not.toMatch(/max-width:\s*820px/);
  });

  it('no top-level rule in forms.css or review.css declares a px max-width below 820px (modal widths excluded)', () => {
    for (const [name, css] of [
      ['forms.css', FORMS_CSS],
      ['review.css', REVIEW_CSS],
    ] as const) {
      for (const { selector, body } of topLevelRules(css)) {
        if (/modal/i.test(selector)) continue;
        const match = body.match(/max-width:\s*(\d+)px/);
        if (!match) continue;
        const px = Number(match[1]);
        expect(px, `${name} selector "${selector}" hard-codes max-width: ${px}px`).toBeGreaterThanOrEqual(820);
      }
    }
  });

  it('forms.css subscreen clamps reference var(--chq-measure)', () => {
    const contentBody = topLevelRuleBody(FORMS_CSS, '.chq-forms-content');
    expect(contentBody).toMatch(/max-width:\s*var\(--chq-measure\)/);

    const settingsBody = topLevelRuleBody(FORMS_CSS, '.chq-forms-settings');
    expect(settingsBody).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  it('review.css subscreen clamps reference var(--chq-measure)', () => {
    const datesBody = topLevelRuleBody(REVIEW_CSS, '.chq-review-editor-dates');
    expect(datesBody).toMatch(/max-width:\s*var\(--chq-measure\)/);

    const summaryBody = topLevelRuleBody(REVIEW_CSS, '.chq-review-summary-grid');
    expect(summaryBody).toMatch(/max-width:\s*var\(--chq-measure\)/);
  });

  it('leaves the 52ch prose measure and modal widths untouched', () => {
    expect(REVIEW_CSS).toMatch(/max-width:\s*52ch/);
    expect(FORMS_CSS).toMatch(/max-width:\s*520px/);
  });
});
