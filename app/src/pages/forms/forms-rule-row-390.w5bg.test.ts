// DEC-919 (task v12m-w5-bg): .chq-forms-rule-row (forms.css:392,
// `display: grid; grid-template-columns: 1fr 120px 1fr; gap: 10px`) has no
// phone rule anywhere in forms.css. At 390 each flexible track gets ~109px
// against a 120px fixed middle, and it lives inside FieldModal whose
// measure is narrower than the full 358px budget, so the real figure is
// worse.
//
// jsdom performs no layout, so the fix is pinned as a source scan of the
// terminal @media (max-width: 700px) block, mirroring this cluster's own
// forms-phone-390.scan.test.ts idiom (brace-matched phone-layer extraction
// + per-selector rule lookup). New file (not an edit to that one) so a
// sibling lane's edits to it never collide with this task's.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_919 } from '../../../../src/decisions';

void DEC_919; // a re-line that starves its yielding track has not re-lined

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_RAW = readFileSync(join(HERE, 'forms.css'), 'utf-8');
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Concatenated body of the file's max-width media block, brace-matched. */
function phoneLayer(css: string): string {
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const m = opener.exec(css);
  if (!m) throw new Error('no max-width:700px media block found');
  let depth = 1;
  let i = m.index + m[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error('unbalanced @media block');
  return css.slice(start, i - 1);
}

/** A single rule's declaration body, by selector, within `layer`. */
function ruleIn(layer: string, selector: string): string {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no rule for ${selector} in the phone layer`);
}

describe('forms.css phone block is still the single terminal @media (max-width: 700px) block', () => {
  it('the @media(max-width:700px) block appears exactly once', () => {
    const matches = CSS_RAW.match(/@media\s*\(max-width:\s*700px\)/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

const PHONE = phoneLayer(CSS);

describe('DEC-919: .chq-forms-rule-row collapses to a single stacked column at 390', () => {
  it('.chq-forms-rule-row is redefined to a single track inside the phone block', () => {
    const rule = ruleIn(PHONE, '.chq-forms-rule-row');
    expect(rule).toMatch(/grid-template-columns:\s*1fr/);
  });

  it('the desktop .chq-forms-rule-row rule (declared once, before the phone block) still declares its original three tracks', () => {
    const desktopMatch = CSS.match(/\.chq-forms-rule-row\s*\{([^}]*)\}/);
    expect(desktopMatch).not.toBeNull();
    expect(desktopMatch![1]).toMatch(/grid-template-columns:\s*1fr\s+120px\s+1fr\s*;/);
    expect(desktopMatch![1]).toMatch(/align-items:\s*end\s*;/);
  });

  it('.chq-forms-rule-row is declared exactly twice in source: once desktop (outside media), once inside the phone block', () => {
    const matches = CSS.match(/\.chq-forms-rule-row\s*\{/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});
