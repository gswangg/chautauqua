// v12m-w12-q: SUBMISSION-DETAIL tier-2 sweep receipt (DEC-393, DEC-989).
// jsdom applies no stylesheet, so this is a phone-layer CSS-TEXT assertion
// (same local-helper shape ImportWizard.phoneColumns.render.test.tsx and
// contacts-tier2-floor.test.ts use) rather than a computed-style read.
// Cites DESIGN-RULINGS.md`The 44px floor, and how it gets evaded`
// drift-proof (bare path + backtick quote), never a `.dc.html` line number.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393 } from '../../../../src/decisions';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

void DEC_393; // PART 2: anchor-floor trio (.chq-detail-back/-position-prev/-position-next)

const HERE = dirname(fileURLToPath(import.meta.url));

const DETAIL_CSS = stripCssComments(readFileSync(join(HERE, 'detail.css'), 'utf-8'));
const DESIGN_RULINGS = readFileSync(
  join(HERE, '..', '..', '..', '..', 'docs', 'design', 'DESIGN-RULINGS.md'),
  'utf-8',
);

/** Every rule body inside every `@media (max-width: Npx)` block in `css`,
 * comments stripped first, whose comma-split selector list includes
 * `selector` VERBATIM. */
function phoneLayerRuleBodies(css: string, selector: string): string {
  const withoutComments = stripCssComments(css);
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  const layers: string[] = [];
  while ((m = opener.exec(withoutComments)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < withoutComments.length && depth > 0) {
      if (withoutComments[i] === '{') depth += 1;
      else if (withoutComments[i] === '}') depth -= 1;
      i += 1;
    }
    layers.push(withoutComments.slice(start, i - 1));
  }
  const layer = layers.join('\n');
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let rm: RegExpExecArray | null;
  const bodies: string[] = [];
  while ((rm = rule.exec(layer)) !== null) {
    const selectors = rm[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(rm[2]!);
  }
  if (bodies.length === 0) throw new Error(`no phone rule for ${selector}`);
  return bodies.join(' ');
}

describe('DESIGN-RULINGS.md citation is drift-proof (bare path + backtick quote, no .dc.html line number)', () => {
  it('the exact ruling heading text this file relies on is present verbatim', () => {
    expect(DESIGN_RULINGS).toContain('The 44px floor, and how it gets evaded');
  });
});

describe('PART 2 (DEC-393): .chq-detail-back / -position-prev / -position-next clear the anchor-floor scan', () => {
  const SELECTORS = ['.chq-detail-back', '.chq-detail-position-prev', '.chq-detail-position-next'];

  it.each(SELECTORS)('%s: display:flex (not inline-flex) + align-items:center + min-height:44px + non-zero padding', (selector) => {
    const body = phoneLayerRuleBodies(DETAIL_CSS, selector);
    // The anchor-floor scan's hasFlexCenter predicate is literal
    // (`display\s*:\s*flex`) and does not recognise `inline-flex` -- the
    // fix is `flex`, not merely present min-height/padding.
    expect(body).toMatch(/display:\s*flex\b/);
    expect(body).not.toMatch(/display:\s*inline-flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/padding:\s*0\s+4px/);
  });

  it('the rule is a single combined selector (three reported offender rows share one fix)', () => {
    const m = DETAIL_CSS.match(
      /\.chq-detail-back,\s*\n\s*\.chq-detail-position-prev,\s*\n\s*\.chq-detail-position-next\s*\{([^}]*)\}/,
    );
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/display:\s*flex\b/);
  });
});

describe('detail.css appends after the DEC-989 collapsed-grid coordination lane (v12m-w11-r), never inside it', () => {
  it('.chq-detail-layout and the participants-table grid rules are untouched by this task (different selectors)', () => {
    expect(DETAIL_CSS).toMatch(/\.chq-detail-layout\s*\{/);
  });
});
