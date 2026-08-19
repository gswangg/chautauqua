// DEC-902 (task w23-b): the import review step-3 table (Line / Email /
// Action / Skip this row) gets a real column allocation instead of browser
// auto-layout. docs/design/Chautauqua Contacts.dc.html:690's update row is
// `190px 1fr auto` -- Email is the frame's identity track (190px). Line has
// no frame counterpart (the mock showed name-over-email; Line is real data
// the mock lacked) so it hugs its content, as does the single-checkbox Skip
// column. Action is the sole unwidthed remainder, matching
// .chq-comms-compose-col-title's precedent (no class hook on that column).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts-panels.css');
const TSX_PATH = join(HERE, 'ImportWizard.tsx');

/**
 * Everything OUTSIDE any media query. DEC-385 makes this codebase
 * single-direction (narrow overrides wide via max-width only, never
 * min-width), so the desktop column allocation is the unconditional base
 * layer and any phone block overrides it -- not the other way round.
 */
function topLevelCss(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

describe('contacts-panels.css import review table column allocation (DEC-902, task w23-b)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const desktop = topLevelCss(css);

  it('declares table-layout: fixed on .chq-contacts-import-review-table', () => {
    expect(desktop).toMatch(/\.chq-contacts-import-review-table\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('declares the three widthed columns', () => {
    expect(desktop).toMatch(/\.chq-contacts-import-review-col-line\s*\{[^}]*width:\s*1px/);
    expect(desktop).toMatch(/\.chq-contacts-import-review-col-email\s*\{[^}]*width:\s*190px/);
    expect(desktop).toMatch(/\.chq-contacts-import-review-col-skip\s*\{[^}]*width:\s*1px/);
  });

  it('leaves Action as the sole unwidthed column (no class hook, no width rule)', () => {
    expect(css).not.toMatch(/\.chq-contacts-import-review-col-action/);
  });
});

describe('ImportWizard.tsx review table column class hooks (DEC-902, task w23-b)', () => {
  const tsx = readFileSync(TSX_PATH, 'utf-8');

  it('the header row carries the three column classes and no Action hook', () => {
    expect(tsx).toMatch(/<th className="chq-contacts-import-review-col-line">Line<\/th>/);
    expect(tsx).toMatch(/<th className="chq-contacts-import-review-col-email">Email<\/th>/);
    expect(tsx).toMatch(/<th>Action<\/th>/);
    expect(tsx).toMatch(/<th className="chq-contacts-import-review-col-skip">Skip this row<\/th>/);
  });

  it('the matching body <td> pairs carry the same column classes', () => {
    expect(tsx).toMatch(/<td className="chq-contacts-import-review-col-line">\{row\.line\}<\/td>/);
    expect(tsx).toMatch(/<td className="chq-contacts-import-review-col-email">\{row\.email\}<\/td>/);
    expect(tsx).toMatch(/<td className="chq-contacts-import-review-col-skip">/);
  });
});
