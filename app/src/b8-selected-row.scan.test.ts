// B8 selected-row edge (DEC-745 amendment, w4-a). DESIGN-RULINGS.md B8 +
// item 28: a selected/current row that paints `var(--chq-surface-sunk)` as
// its background must also carry a 3px `var(--chq-brand)` left edge -- a
// fill with no edge is "half a standard" (w4 field-guide shape). This scan
// enumerates EVERY *.css file under app/src (never a hand-list), parses its
// top-level rule blocks, and for every rule whose selector carries
// `.is-active` or `.is-current` AND whose declarations include
// `background: var(--chq-surface-sunk)`:
//   - the SAME rule must also declare a 3px `var(--chq-brand)` left border
//     (`border-left` or the `border` shorthand), and
//   - the SAME rule must NOT declare a negative `margin-inline` (the old
//     bleed-out-of-the-page-measure hack B8 retires).
//
// The regex-based CSS "parser" here is intentionally narrow: it only needs
// to split a stylesheet into top-level `selector { declarations }` blocks
// (nothing nested inside @media is walked into further, but @media's own
// block IS still visited as one rule whose selector text is the whole
// `@media (...) { ... }` header -- immaterial here since B8 offenders are
// always top-level list rows, never phone-only overrides).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = HERE;

/** Every *.css file under app/src, keyed by its path relative to app/src
 * (posix separators). */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}

const CSS_FILES = allCssFiles(SRC_ROOT);

interface CssRule {
  selector: string;
  body: string;
}

/** Splits a stylesheet's text into top-level `selector { body }` blocks,
 * stripping comments first. Does not recurse into nested @-rule bodies --
 * each @-rule is returned as a single block whose "selector" is its own
 * prelude and whose "body" is everything inside its outer braces (including
 * any nested rules verbatim, unparsed further). That is sufficient here:
 * this scan only needs to find rules carrying `.is-active`/`.is-current` in
 * their OWN selector text, and an @media prelude never does. */
function parseTopLevelRules(source: string): CssRule[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  let i = 0;
  while (i < stripped.length) {
    const openBrace = stripped.indexOf('{', i);
    if (openBrace === -1) break;
    const selector = stripped.slice(i, openBrace).trim();
    let depth = 1;
    let j = openBrace + 1;
    while (j < stripped.length && depth > 0) {
      if (stripped[j] === '{') depth++;
      else if (stripped[j] === '}') depth--;
      j++;
    }
    const body = stripped.slice(openBrace + 1, j - 1);
    if (selector) rules.push({ selector, body });
    i = j;
  }
  return rules;
}

const SUNK_BG_RE = /background\s*:\s*var\(\s*--chq-surface-sunk\s*\)/;
const BRAND_LEFT_EDGE_RE =
  /border(?:-left)?\s*:\s*3px\s+solid\s+var\(\s*--chq-brand\s*\)/;
const NEGATIVE_MARGIN_INLINE_RE = /margin-inline\s*:\s*-/;

interface Offense {
  file: string;
  selector: string;
  reason: string;
}

function findOffenses(file: string, source: string): Offense[] {
  const offenses: Offense[] = [];
  for (const { selector, body } of parseTopLevelRules(source)) {
    if (!selector.includes('.is-active') && !selector.includes('.is-current')) continue;
    if (!SUNK_BG_RE.test(body)) continue;
    if (!BRAND_LEFT_EDGE_RE.test(body)) {
      offenses.push({
        file,
        selector,
        reason: 'paints var(--chq-surface-sunk) with no 3px var(--chq-brand) left edge',
      });
    }
    if (NEGATIVE_MARGIN_INLINE_RE.test(body)) {
      offenses.push({
        file,
        selector,
        reason: 'declares a negative margin-inline bleed (retired by DEC-745)',
      });
    }
  }
  return offenses;
}

describe('DEC-745 (w4-a): every selected/current row painting surface-sunk carries its 3px brand edge', () => {
  it('visits at least 5 CSS files (vacuous-scan tripwire)', () => {
    expect(CSS_FILES.length).toBeGreaterThanOrEqual(5);
  });

  it('review.css and speakers.css are among the files this scan visits (dead-config tripwire)', () => {
    expect(CSS_FILES).toContain('pages/review/review.css');
    expect(CSS_FILES).toContain('pages/speakers/speakers.css');
  });

  it('no .is-active/.is-current surface-sunk rule anywhere in app/src is missing its edge or bleeding its margin', () => {
    const offenses: Offense[] = [];
    for (const file of CSS_FILES) {
      const source = readFileSync(join(SRC_ROOT, file), 'utf8');
      offenses.push(...findOffenses(file, source));
    }
    const report = offenses.map((o) => `${o.file} :: ${o.selector} -- ${o.reason}`).join('\n');
    expect(offenses, report).toEqual([]);
  });

  describe('negative control on synthetic stylesheets (fingerprint precision)', () => {
    it('flags a selected row with the fill but no edge', () => {
      const css = `.row.is-active { background: var(--chq-surface-sunk); }`;
      expect(findOffenses('synthetic.css', css)).toHaveLength(1);
    });

    it('flags a selected row that bleeds out of the page measure', () => {
      const css = `.row.is-active { background: var(--chq-surface-sunk); border-left: 3px solid var(--chq-brand); margin-inline: -16px; }`;
      expect(findOffenses('synthetic.css', css)).toHaveLength(1);
    });

    it('does NOT flag a compliant selected row', () => {
      const css = `.row.is-active { background: var(--chq-surface-sunk); border-left: 3px solid var(--chq-brand); padding-left: 13px; }`;
      expect(findOffenses('synthetic.css', css)).toEqual([]);
    });

    it('does NOT flag an unrelated .is-active rule with no surface-sunk background', () => {
      const css = `.tab.is-active { font-weight: 700; }`;
      expect(findOffenses('synthetic.css', css)).toEqual([]);
    });
  });
});
