// DEC-877/DEC-744 (task-w40-b), superseded by the frame-04 anatomy
// (task-w5-h): forms.css originally clamped .chq-forms-content to
// var(--chq-measure) while .chq-forms-header (the Preview/Save row) stayed
// unclamped, so at a wide desktop frame the header spanned the full content
// width while the field list/settings column stopped ~550px short of it --
// two different right edges on the same page. w40-b's fix made BOTH blocks
// share the page root's single measure by declaring no clamp of their own.
//
// Frame 04 (Chautauqua Submissions.dc.html:358-414, citation lands on the
// first `it` below beside its own assertion) instead
// draws the header bar full bleed at 1440 (title at the shell's own gutter,
// Preview/Save at the far right) with the field-list CONTENT staying at the
// narrower 820 builder measure -- the same "chrome full bleed, content
// clamped" split DEC-989's review-plan-editor title row and the public CFP
// page already use. FormsPage.tsx's page root now carries .chq-measure-table
// (1440) instead of .chq-measure (820), so .chq-forms-header can keep
// declaring no clamp of its own (stretches to the wider root) while
// .chq-forms-content re-clamps itself back to var(--chq-measure) -- the two
// blocks now deliberately DISAGREE, on purpose.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'forms.css'), 'utf-8');

/** Strips every top-level `@media { ... }` block via linear brace-depth
 * counting (mirroring forms-phone-frames.test.ts's phoneLayer helper)
 * rather than the `(?:[^{}]*\{[^{}]*\}[^{}]*)*` backtracking regex this
 * used to use -- that pattern is catastrophically slow once the @media
 * block's content grows past a few rules (ambiguous empty-match
 * boundaries between iterations), which the v12 phone pass's larger block
 * hit in practice. */
function stripMedia(css: string): string {
  let out = '';
  let i = 0;
  const opener = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    out += css.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    i = j;
    opener.lastIndex = j;
  }
  return out + css.slice(i);
}

/** Every top-level (non-@media) `selector { body }` rule. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = stripMedia(css);
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
  const withoutMedia = stripMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

describe('forms.css header measure (frame-04 anatomy, task-w5-h)', () => {
  it('.chq-forms-header declares no max-width of its own, stretching to the page root\'s full 1440 measure', () => {
    // docs/design/Chautauqua Submissions.dc.html:358 `width:390px; height:844px; background:#F4F1E8`
    expect(topLevelRuleBody(CSS, '.chq-forms-header')).not.toMatch(/max-width/);
  });

  it('.chq-forms-content re-clamps itself to the 820 builder measure via the shared token, never a hard-coded px', () => {
    const body = topLevelRuleBody(CSS, '.chq-forms-content');
    expect(body).toMatch(/max-width:\s*var\(--chq-measure\)/);
    expect(body).not.toMatch(/max-width:\s*\d+px/);
  });

  it('never hard-codes a px max-width on the header clamp', () => {
    expect(topLevelRuleBody(CSS, '.chq-forms-header')).not.toMatch(/max-width:\s*\d+px/);
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
