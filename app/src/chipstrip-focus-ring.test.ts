// task v12m-w21-b (DEC-383 wave-21 amendment): the shared `.chq-chipstrip`
// token declared in app/src/styles.css (`display:flex; gap:8px;
// overflow-x:auto; -webkit-overflow-scrolling:touch`) is an overflow-x:auto
// scroll container whose computed overflow-y is forced to `auto`, clipping
// the house ring (`:focus-visible { outline: 2px solid var(--chq-brand);
// outline-offset: 2px; }`) on every focusable child. This mirrors the
// app/src/pages/contacts/contacts.css `.chq-contacts-filter-chipstrip
// :focus-visible, .chq-contacts-segment-pills :focus-visible { outline-offset:
// -2px; }` fix (wave v12m-w16-ui-r5-a) for the shared token instead of a
// per-page one.
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts — this is a
// source-scan pin on the CSS TEXT of app/src/styles.css, not computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments are stripped before any brace scanning, mirroring
 * contacts-phone-frames.test.ts's `read`: a `{`/`}` inside a long
 * explanatory comment (e.g. `var(--x, #hex)`) would desynchronise the
 * depth counter and silently truncate a block. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const STYLES_CSS = read('styles.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched (not regex-bounded) so a nested rule never ends the block
 * early. Mirrors contacts-phone-frames.test.ts's `phoneLayer`. */
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

describe('.chq-chipstrip focus ring (DEC-383 wave-21)', () => {
  it('positive control: the base .chq-chipstrip rule still declares overflow-x: auto (the reason the fix is needed)', () => {
    const rule = /\.chq-chipstrip\s*\{([^}]*)\}/.exec(STYLES_CSS);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/overflow-x:\s*auto/);
  });

  it('the phone-scoped .chq-chipstrip :focus-visible outline-offset: -2px rule exists inside the terminal max-width:700px block', () => {
    const layer = phoneLayer(STYLES_CSS);
    const rule = /\.chq-chipstrip\s*:focus-visible\s*\{([^}]*)\}/.exec(layer);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/outline-offset:\s*-2px/);
    // DEC-409: never remove the outline itself.
    expect(rule![1]).not.toMatch(/outline\s*:\s*none/);
  });
});
