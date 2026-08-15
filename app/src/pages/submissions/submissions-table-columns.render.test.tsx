// DEC-902 amendment (wave 20, task w20-b): the submissions table gets a real
// column allocation instead of browser auto-layout handing the remainder to
// whichever unwidthed column lands last. This file checks both halves of the
// contract: the CSS declares table-layout:fixed with exactly ONE unwidthed
// column (Title), and the phone (<=700px) card-stack treatment is untouched.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'submissions.css');
const TSX_PATH = join(HERE, 'SubmissionsTable.tsx');

/** Extracts the body text of the (single) 700px media block. */
function phoneBlockBody(css: string): string {
  const match = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

/** Extracts the body text of the (single) 701px-and-up desktop column block. */
function desktopColumnBlockBody(css: string): string {
  const match = css.match(/@media \(min-width: 701px\) \{([\s\S]*?)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 701px desktop column block found');
  return body;
}

describe('submissions.css table column allocation (DEC-902, task w20-b)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const desktop = desktopColumnBlockBody(css);
  const phone = phoneBlockBody(css);

  it('declares table-layout: fixed on .chq-submissions-table', () => {
    expect(desktop).toMatch(/\.chq-submissions-table\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('declares a width for every column class except the Title remainder column', () => {
    const widthed = [
      'chq-submissions-col-select',
      'chq-submissions-col-ref',
      'chq-submissions-col-speakers',
      'chq-submissions-col-track',
      'chq-submissions-col-status',
      'chq-submissions-col-sent',
      'chq-submissions-col-custom',
      'chq-submissions-col-clone',
      'chq-submissions-col-end',
    ];
    for (const cls of widthed) {
      const re = new RegExp(`\\.${cls}\\s*\\{[^}]*width:\\s*\\d+px`);
      expect(desktop).toMatch(re);
    }
    // Title is the SOLE unwidthed column -- no width rule for it anywhere.
    expect(css).not.toMatch(/\.chq-submissions-col-title\s*\{[^}]*width:/);
  });

  it('the trailing frame-less column collapses to width:1px, not the remainder', () => {
    expect(desktop).toMatch(/\.chq-submissions-col-end\s*\{[^}]*width:\s*1px/);
  });

  it('the desktop column-width block is scoped to >700px and does not appear at top level', () => {
    const outsideMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
    expect(outsideMedia).not.toMatch(/table-layout:\s*fixed/);
    expect(outsideMedia).not.toMatch(/\.chq-submissions-col-select\s*\{/);
  });

  it('leaves the phone (<=700px) card-stack block untouched by the new fixed-layout rules', () => {
    expect(phone).not.toMatch(/table-layout/);
    expect(phone).not.toMatch(/chq-submissions-col-/);
    // The phone treatment's own hallmark rules are still present.
    expect(phone).toMatch(/\.chq-submissions-table tbody tr\s*\{[^}]*display:\s*flex/);
    expect(phone).toMatch(/\.chq-submissions-table tbody td\s*\{[^}]*display:\s*block/);
  });
});

describe('SubmissionsTable.tsx column class hooks (DEC-902, task w20-b)', () => {
  const tsx = readFileSync(TSX_PATH, 'utf-8');

  it('every <th> in the header row carries its own column class', () => {
    const classes = [
      'chq-submissions-col-select',
      'chq-submissions-col-ref',
      'chq-submissions-col-title',
      'chq-submissions-col-speakers',
      'chq-submissions-col-track',
      'chq-submissions-col-status',
      'chq-submissions-col-sent',
      'chq-submissions-col-custom',
      'chq-submissions-col-clone',
      'chq-submissions-col-end',
    ];
    for (const cls of classes) {
      expect(tsx).toContain(cls);
    }
  });

  it('no <td> in the body rows was given a new column class (widths hook off <th> only)', () => {
    // The custom-column <td> keeps its pre-existing class name, which is
    // deliberately NOT prefixed `-col-` (that vocabulary is new, th-only).
    expect(tsx).not.toMatch(/<td[^>]*chq-submissions-col-/);
  });
});
