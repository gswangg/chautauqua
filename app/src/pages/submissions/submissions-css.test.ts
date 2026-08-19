// DEC-919 (v12 mobile campaign w2 ruling, task w2-a). Closes audit finding 2
// (docs/design/audit/submissions-v12.md): at 390 .chq-submissions-filterbar
// keeps only the pending/accepted status pills plus the search box -- the
// Status caption, the other four pills, the divider, the track <select>,
// and the ColumnPicker <details> are hidden. jsdom applies no external
// stylesheet's @media rule (mirrors detail-css.test.ts's own note), so this
// reads submissions.css's own text.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'submissions.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

/** Brace-matches every `@media (max-width: 700px) { ... }` block (the file
 * carries two, an earlier one and this task's own appended at the true
 * end) and concatenates their bodies -- mirrors phone-page-scaffold.test.ts's
 * own phoneLayer helper rather than assuming there is only one block. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
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
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

const PHONE = phoneLayer(CSS);

describe('submissions.css phone filterbar reduction (DEC-919)', () => {
  it('hides the Status caption, the filterbar divider, the track select and the column picker', () => {
    expect(PHONE).toMatch(/\.chq-submissions-status-label,[\s\S]{0,400}display:\s*none/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-divider,[\s\S]{0,400}display:\s*none/);
    expect(PHONE).toMatch(
      /\.chq-submissions-filterbar \.chq-submissions-filterbar-select,[\s\S]{0,400}display:\s*none/,
    );
    expect(PHONE).toMatch(/\.chq-submissions-columnpicker,[\s\S]{0,400}display:\s*none/);
  });

  it('hides the Sort select (FilterBarSearchSort row) via its own distinguishing class', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-sort-select[\s\S]{0,400}display:\s*none/);
  });

  it('hides every status pill except pending and accepted', () => {
    const rule = PHONE.match(/\.chq-status-pills \[data-status\][^{]*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toMatch(/:not\(\[data-status='pending'\]\)/);
    expect(rule![0]).toMatch(/:not\(\[data-status='accepted'\]\)/);
    expect(rule![1]).toMatch(/display:\s*none/);
  });

  it('desktop keeps every control (no display:none for these selectors outside a media block)', () => {
    const withoutMedia = CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
    expect(withoutMedia).not.toMatch(/\.chq-submissions-status-label\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-columnpicker\s*\{[^}]*display:\s*none/);
  });
});
