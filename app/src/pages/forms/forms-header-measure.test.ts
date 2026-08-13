// DEC-877/DEC-744 (task-w40-b): forms.css clamped .chq-forms-content to
// var(--chq-measure) while .chq-forms-header (the Preview/Save row) stayed
// unclamped, so at a wide desktop frame the header spanned the full content
// width while the field list/settings column stopped ~550px short of it --
// two different right edges on the same page. The fix was NOT to give the
// header its own matching clamp: FormsPage.tsx already puts the ONE
// .chq-measure clamp on the page root, and a max-width + auto margins on a
// flex-column CHILD cancels align-items:stretch (the box shrinks to its own
// content, 275px observed, instead of sharing the root's edges). So the
// header/content blocks now declare NO max-width of their own and stretch
// to fill the root instead. This test reads the stylesheet's own text
// (mirroring app/src/page-measure.test.ts and
// app/src/pages/agenda/agenda-card-geometry.test.ts -- jsdom does not apply
// an external stylesheet's layout) and asserts the header and content
// column share ONE right edge by both declaring no clamp of their own.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'forms.css'), 'utf-8');

/** Every top-level (non-@media) `selector { body }` rule. */
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

/** Extracts a top-level (not inside an @media block) rule's declaration body
 * by selector -- a direct literal search of the raw text (mirroring
 * app/src/page-measure.test.ts) rather than a full selector parse, so a
 * comment sitting between the previous rule's `}` and this selector's `{`
 * can't shift the captured selector text. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

describe('forms.css header measure (DEC-877/DEC-744)', () => {
  it('.chq-forms-header and .chq-forms-content declare no max-width of their own, stretching to the page root measure', () => {
    expect(topLevelRuleBody(CSS, '.chq-forms-header')).not.toMatch(/max-width/);
    expect(topLevelRuleBody(CSS, '.chq-forms-content')).not.toMatch(/max-width/);
  });

  it('never hard-codes a px max-width on the header or content clamp', () => {
    expect(topLevelRuleBody(CSS, '.chq-forms-header')).not.toMatch(/max-width:\s*\d+px/);
    expect(topLevelRuleBody(CSS, '.chq-forms-content')).not.toMatch(/max-width:\s*\d+px/);
  });

  it('every top-level rule touching the field-row drag handle or actions declares a disabled treatment', () => {
    const rules = topLevelRules(CSS);
    const disabledRule = rules.find(
      (r) => r.selector.includes('.chq-forms-field-drag:disabled') && r.selector.includes('.chq-forms-field-actions .chq-btn:disabled'),
    );
    expect(disabledRule, 'expected one shared disabled rule for the drag handle and Edit/Delete buttons').toBeDefined();
    expect(disabledRule!.body).toMatch(/cursor:\s*not-allowed/);
    expect(disabledRule!.body).toMatch(/opacity:/);
  });
});
