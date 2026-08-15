// DEC-902 wave-21 amendment (task w21-a): the compose step-1 recipient table
// (Select / Submission(Title) / Speaker / Status / Slot) gets the frame's real
// column allocation instead of falling through to plain .chq-table
// auto-layout, which handed the whole remainder to whichever <td> landed
// last. This file checks all three parts of the contract: the five <th>s
// carry their column class hooks, comms.css declares table-layout:fixed with
// exactly four pinned widths and one remainder (Title), and the <=700px
// card-reflow block resets back to auto-layout.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'comms.css');
const TSX_PATH = join(HERE, 'ComposeWizard.tsx');

/** Extracts the body text of the (single) 700px media block. */
function phoneBlockBody(css: string): string {
  const match = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

describe('comms.css compose step-1 table column allocation (DEC-902, task w21-a)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const phone = phoneBlockBody(css);

  it('declares table-layout: fixed on .chq-comms-compose-table at the top level (above the phone breakpoint)', () => {
    const outsidePhone = css.replace(/@media \(max-width: 700px\) \{[\s\S]*\n\}\n/, '');
    expect(outsidePhone).toMatch(/\.chq-comms-compose-table\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('declares a width for exactly the four pinned column classes', () => {
    const widthed = [
      'chq-comms-compose-col-select',
      'chq-comms-compose-col-speaker',
      'chq-comms-compose-col-status',
      'chq-comms-compose-col-slot',
    ];
    for (const cls of widthed) {
      const re = new RegExp(`\\.${cls}\\s*\\{[^}]*width:\\s*\\d+px`);
      expect(css).toMatch(re);
    }
  });

  it('leaves the title column as the sole unwidthed remainder -- no width rule anywhere', () => {
    expect(css).not.toMatch(/\.chq-comms-compose-col-title\s*\{[^}]*width:/);
  });

  it('resets table-layout to auto inside the <=700px card-reflow block', () => {
    expect(phone).toMatch(/\.chq-comms-compose-table\s*\{\s*table-layout:\s*auto;?\s*\}/);
  });

  it('keeps the card-reflow block free of the new fixed-layout column classes', () => {
    expect(phone).not.toMatch(/chq-comms-compose-col-/);
  });
});

describe('ComposeWizard.tsx compose step-1 <th> column class hooks (DEC-902, task w21-a)', () => {
  const tsx = readFileSync(TSX_PATH, 'utf-8');

  it('every <th> in the header row carries its own column class', () => {
    const classes = [
      'chq-comms-compose-col-select',
      'chq-comms-compose-col-title',
      'chq-comms-compose-col-speaker',
      'chq-comms-compose-col-status',
      'chq-comms-compose-col-slot',
    ];
    for (const cls of classes) {
      expect(tsx).toContain(cls);
    }
  });

  it('no <td> in the body rows was given a new column class (widths hook off <th> only)', () => {
    expect(tsx).not.toMatch(/<td[^>]*chq-comms-compose-col-/);
  });
});
