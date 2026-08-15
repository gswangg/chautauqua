// DEC-902 wave-23 amendment (task w23-a): the saved-templates list
// (Name / Last used) gets the frame's real column allocation instead of
// falling through to plain .chq-table auto-layout, which handed the whole
// remainder to wherever the longest 'Last used <date>' string landed. This
// file checks: comms.css declares table-layout:fixed with the Last-used
// column pinned and Name as the single unwidthed remainder, the <=700px
// card-reflow block declares no table-layout for this table, and
// TemplatesTab.tsx carries the column class hook on both the <th> and its
// matching <td> (DEC-937: phone labels stay real, not dead markup).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'comms.css');
const TSX_PATH = join(HERE, 'TemplatesTab.tsx');

/** Extracts the body text of the (single) 700px media block. */
function phoneBlockBody(css: string): string {
  const match = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

describe('comms.css templates table column allocation (DEC-902, task w23-a)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const phone = phoneBlockBody(css);

  it('declares table-layout: fixed on .chq-comms-templates-table at the top level (above the phone breakpoint)', () => {
    const outsidePhone = css.replace(/@media \(max-width: 700px\) \{[\s\S]*\n\}\n/, '');
    expect(outsidePhone).toMatch(/\.chq-comms-templates-table\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('pins the Last-used column width', () => {
    expect(css).toMatch(
      /\.chq-comms-templates-table \.chq-comms-templates-col-last-used\s*\{[^}]*width:\s*1px/,
    );
  });

  it('leaves the Name column as the sole unwidthed remainder -- no class hook, no width rule', () => {
    expect(css).not.toMatch(/chq-comms-templates-col-name/);
  });

  it('declares no table-layout for this table inside the <=700px card-reflow block', () => {
    const templatesTablePhoneRules = phone.match(/\.chq-comms-templates-table[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of templatesTablePhoneRules) {
      expect(rule).not.toMatch(/table-layout/);
    }
  });
});

describe('comms.css templates table phone data-label rule (DEC-937, task w23-a)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const phone = phoneBlockBody(css);

  it('declares a td[data-label]::before rule for the templates table matching the compose table pattern', () => {
    expect(phone).toMatch(
      /\.chq-comms-templates-table td\[data-label\]::before\s*\{\s*content:\s*attr\(data-label\) ': ';/,
    );
  });
});

describe('TemplatesTab.tsx column class hooks (DEC-902/DEC-937, task w23-a)', () => {
  const tsx = readFileSync(TSX_PATH, 'utf-8');

  it('the Last-used <th> and its matching <td> both carry the column class hook', () => {
    expect(tsx).toMatch(/<th className="chq-comms-templates-col-last-used">Last used<\/th>/);
    expect(tsx).toMatch(/<td data-label="Last used" className="chq-comms-templates-col-last-used">/);
  });

  it('the Name column carries no new class hook (sole unwidthed remainder)', () => {
    expect(tsx).not.toMatch(/chq-comms-templates-col-name/);
  });

  it('every td carries a real data-label the phone rule can surface (DEC-937)', () => {
    expect(tsx).toMatch(/<td data-label="Name">/);
    expect(tsx).toMatch(/<td data-label="Last used"/);
  });
});
