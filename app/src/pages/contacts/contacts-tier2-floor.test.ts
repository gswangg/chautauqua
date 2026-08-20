// v12m-w12-q: CONTACTS + MODAL tier-2 sweep receipts (DEC-393, DEC-937,
// DEC-989). jsdom applies no stylesheet, so every claim here is a
// phone-layer CSS-TEXT assertion (mirrors ImportWizard.phoneColumns.render
// .test.tsx's local phoneLayerRuleBody helper) rather than a computed-style
// read. Cites DESIGN-RULINGS.md`The 44px floor, and how it gets evaded`
// drift-proof (bare path + backtick quote), never a `.dc.html` line number.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_937, DEC_989 } from '../../../../src/decisions';

void DEC_937; // PART 1: painted-face cancelled-padding removal on .chq-contacts-title-actions a
void DEC_393; // PART 2: anchor-floor trio + companion-gap re-measurement
void DEC_989; // PART 3: overflow -- .chq-contacts-pipeline-columns drops its stale min-width at phone width

const HERE = dirname(fileURLToPath(import.meta.url));

const CONTACTS_CSS = readFileSync(join(HERE, 'contacts.css'), 'utf-8');
const PANELS_CSS = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');
const MODAL_FRAME_CSS = readFileSync(join(HERE, '..', '..', 'components', 'modal-frame.css'), 'utf-8');
const DESIGN_RULINGS = readFileSync(
  join(HERE, '..', '..', '..', '..', 'docs', 'design', 'DESIGN-RULINGS.md'),
  'utf-8',
);

/** Every rule body inside every `@media (max-width: Npx)` block in `css`,
 * comments stripped first, whose comma-split selector list includes
 * `selector` VERBATIM (same trick ImportWizard.phoneColumns.render.test.tsx
 * uses locally -- not imported from there since that file is a different
 * task's and stays untouched here). Concatenates every matching body (a
 * selector can recur across the file's terminal block sections) rather
 * than returning only the first, so a property split across two rules for
 * the same selector is still visible to a single `toMatch`. */
function phoneLayerRuleBodies(css: string, selector: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
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

describe('PART 1 (DEC-937): .chq-contacts-title-actions a is no longer a painted-face cancelled-padding offender', () => {
  it('the phone rule floors the anchor without padding-inline/margin-inline cancellation', () => {
    const body = phoneLayerRuleBodies(CONTACTS_CSS, '.chq-contacts-title-actions a');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    // DEC-937: painted-face rule -- no cancelled-padding pair (that idiom
    // narrows a painted control's own inline padding and bleeds the drawn
    // box past its layout edge, DESIGN-RULINGS.md's "44px floor" ruling).
    expect(body).not.toMatch(/margin-inline:\s*-/);
  });

  it('the borderless Merge link (.chq-contacts-rail-duplicate-actions a) keeps its cancelled-padding grow', () => {
    const body = phoneLayerRuleBodies(CONTACTS_CSS, '.chq-contacts-rail-duplicate-actions a');
    expect(body).toMatch(/padding-inline:\s*10px/);
    expect(body).toMatch(/margin-inline:\s*-10px/);
  });

  it('the two selectors are no longer combined in one cancelled-padding rule', () => {
    expect(CONTACTS_CSS).not.toMatch(
      /\.chq-contacts-title-actions a,\s*\n?\s*\.chq-contacts-rail-duplicate-actions a\s*\{[^}]*padding-inline:\s*10px/,
    );
  });

  it("PART 1's companion gap: .chq-contacts-title-actions's desktop gap is left unwidened at 9px", () => {
    const m = CONTACTS_CSS.match(/\.chq-contacts-title-actions\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/gap:\s*9px/);
  });
});

describe('PART 2 (DEC-393): anchor floors reach the tap-target trio inside the terminal phone block', () => {
  it('contacts-panels.css: .chq-modal-actions carries a tap-floor-exempt receipt naming button-only children', () => {
    expect(PANELS_CSS).toMatch(
      /tap-floor-exempt:[^*]*\*\/\s*\.chq-contacts-pipeline-enroll-modal \.chq-modal-actions\s*\{/,
    );
  });

  it('modal-frame.css: .chq-modal-head .chq-phone-back is floored inside its own phone rule', () => {
    const body = phoneLayerRuleBodies(MODAL_FRAME_CSS, '.chq-modal-head .chq-phone-back');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/padding(-inline)?:\s*(?!0(?:px)?\b)\S/);
  });
});

describe('PART 3 (DEC-989): .chq-contacts-pipeline-columns drops its desktop min-width at phone width', () => {
  it('the phone rule zeroes min-width alongside the existing display:none, no overflow-x added', () => {
    const body = phoneLayerRuleBodies(PANELS_CSS, '.chq-contacts-pipeline-columns');
    expect(body).toMatch(/display:\s*none/);
    expect(body).toMatch(/min-width:\s*0/);
    expect(body).not.toMatch(/overflow-x/);
  });

});

describe('PART 3 desktop preservation (DEC-385 single-direction)', () => {
  it('.chq-contacts-pipeline-columns keeps its unconditional 1000px min-width above the terminal phone block', () => {
    const beforeMedia = PANELS_CSS.slice(0, PANELS_CSS.indexOf('@media (max-width: 700px)'));
    const m = beforeMedia.match(/\.chq-contacts-pipeline-columns\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/min-width:\s*1000px/);
  });
});
