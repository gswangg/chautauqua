// v12m-w30-d: frame verdict for docs/design/Chautauqua Contacts.dc.html:487
// ("Import CSV · 390"), extent 487-517 -- the one-column-per-screen import
// pager. Enters the REAL ImportWizard through its route the same way
// ImportWizard.phoneColumns.render.test.tsx does (CSV paste -> match-columns
// step), then grades the frame's phone anatomy literal-by-literal: the
// back control + title, the file summary line, the "Column i of n" eyebrow
// + column name, the "First three values" line, the "Import it as" label
// and its option list (including "Skip this column", not "(ignore)"), the
// match-summary slot at :507, and the pager dock at the 44px floor.
//
// jsdom applies no stylesheet, so a "hidden/shown at phone width" or
// "44px floor" claim can only be verified against the CSS TEXT (same
// technique as ImportWizard.phoneColumns.render.test.tsx's
// phoneLayerRuleBody -- a local, minimal copy here rather than an import,
// since that file is a different lane's and stays untouched).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';

const HERE = dirname(fileURLToPath(import.meta.url));

function phoneLayerRuleBody(css: string, selector: string): string {
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
  while ((rm = rule.exec(layer)) !== null) {
    const selectors = rm[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectors.includes(selector)) return rm[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

const PANELS_CSS = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');

afterEach(() => {
  cleanup();
});

// 5 columns, matching the frame's own "2 of 5" example shape. Row 3 repeats
// row 1's email so dedupeCount > 0 and the match-summary slot at :507 has
// something to render.
const CSV = [
  'Full Name,Email,Company,Title,Phone',
  'Priya Shah,priya@example.com,Acme,Eng,555-0100',
  'Marcus Yu,marcus@example.com,Beta,Eng,555-0101',
  'Nadia Osei,priya@example.com,Gamma,Sales,555-0102',
].join('\n');

function phoneColumn(): HTMLElement {
  const el = document.querySelector('.chq-contacts-import-phone-column');
  if (!el) throw new Error('phone column block not found');
  return el as HTMLElement;
}

function phoneDock(): HTMLElement {
  const el = document.querySelector('.chq-contacts-import-phone-dock');
  if (!el) throw new Error('phone dock not found');
  return el as HTMLElement;
}

async function renderAtColumnMapping() {
  render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
  fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
  await screen.findByText('Column 1 of 5');
}

describe('ImportWizard: "Import CSV · 390" frame verdict (v12m-w30-d, docs/design/Chautauqua Contacts.dc.html:487-517)', () => {
  it('draws the "‹ Contacts" back control and the "Match the columns" title (frame :489-490)', async () => {
    await renderAtColumnMapping();
    expect(screen.getByRole('button', { name: '‹ Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Match the columns' })).toBeInTheDocument();
  });

  // Frame :491 draws ONE line: `speakers.csv · 214 rows · 2 of 5` --
  // filename, row count, and column position joined by ` · `. v12m-w18-a
  // (DEC-385 amendment) closed the shape gap: the product now renders the
  // same three fields joined by the middot, with the column-position
  // clause reading the SAME phoneColumnIndex/header.length state as the
  // "Column i of n" eyebrow further down -- no second derivation
  // (DEC-613/DEC-180). The join is phone-only (DEC-385 single-direction);
  // this test also proves the phone cascade governs it by reading the
  // reveal declarations out of the SAME @media block that switches the
  // head to a wrapping row, never a bare CSS substring match (DEC-994).
  it('the file summary line: filename, row count and column position join with " · " inside the phone cascade (frame :491, DEC-385 wave-18)', async () => {
    await renderAtColumnMapping();
    const filename = document.querySelector('.chq-contacts-import-match-filename');
    const count = document.querySelector('.chq-contacts-import-match-count');
    const position = document.querySelector('.chq-contacts-import-match-position');
    if (!filename || !count || !position) throw new Error('match head filename/count/position not found');
    expect(filename.textContent).toBe('Pasted CSV');
    expect(count.textContent).toBe('3 rows');
    expect(position.textContent).toBe('1 of 5');
    const head = document.querySelector('.chq-contacts-import-match-head');
    if (!head) throw new Error('match head not found');
    expect(head.textContent).toBe('Pasted CSV·3 rows·1 of 5');

    // The governing @media block (the one that switches the head to a
    // wrapping row) must be the SAME block that reveals the two new nodes
    // -- proves the phone cascade actually gates the reveal, not merely
    // that a rule with these selectors exists somewhere in the file.
    const headRule = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-match-head');
    expect(headRule).toMatch(/flex-direction:\s*row/);
    const sepRule = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-match-sep');
    const positionRule = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-match-position');
    expect(sepRule).toMatch(/display:\s*inline/);
    expect(positionRule).toMatch(/display:\s*inline/);
  });

  it('"Column i of n" eyebrow and the current column\'s header name (ImportWizard.tsx:1006, :1008)', async () => {
    await renderAtColumnMapping();
    expect(within(phoneColumn()).getByText('Column 1 of 5')).toBeInTheDocument();
    const name = phoneColumn().querySelector('.chq-contacts-import-phone-name');
    if (!name) throw new Error('phone column name not found');
    expect(name.textContent).toBe('Full Name');

    fireEvent.click(screen.getByRole('button', { name: 'Next column' }));
    await screen.findByText('Column 2 of 5');
    const name2 = phoneColumn().querySelector('.chq-contacts-import-phone-name');
    expect(name2?.textContent).toBe('Email');
  });

  it('"First three values: {a}, {b}, {c}" -- the label literal, exactly three samples, joined with ", " (ImportWizard.tsx:1011)', async () => {
    await renderAtColumnMapping();
    fireEvent.click(screen.getByRole('button', { name: 'Next column' })); // -> Email column
    await screen.findByText('Column 2 of 5');

    const samples = phoneColumn().querySelector('.chq-contacts-import-phone-samples');
    if (!samples) throw new Error('phone samples line not found');
    expect(samples.textContent).toBe(
      'First three values: priya@example.com, marcus@example.com, priya@example.com',
    );
    // Exactly three values joined by ", " -- never a fourth even though a
    // 4th data row could in principle exist.
    const afterLabel = samples.textContent!.replace('First three values: ', '');
    expect(afterLabel.split(', ')).toHaveLength(3);
  });

  it('the "Import it as" label and its option list, including "Skip this column" -- not "(ignore)" (DEC-825-era copy rule)', async () => {
    await renderAtColumnMapping();
    expect(within(phoneColumn()).getByText('Import it as')).toBeInTheDocument();

    const radiogroup = screen.getByRole('radiogroup', { name: 'Map column Full Name' });
    expect(within(radiogroup).getByRole('radio', { name: 'Skip this column' })).toBeInTheDocument();
    expect(within(radiogroup).queryByText('(ignore)')).not.toBeInTheDocument();
    expect(within(radiogroup).getByRole('radio', { name: 'First name' })).toBeInTheDocument();
    expect(within(radiogroup).getByRole('radio', { name: 'Full name (splits into first / last)' })).toBeInTheDocument();
    expect(within(radiogroup).getByRole('radio', { name: 'Custom: Full Name' })).toBeInTheDocument();
  });

  // Frame :507 draws `9 rows match an existing contact by email · those get
  // updated` at this exact slot -- a plan.updated count that does not exist
  // pre-dry-run. This was already adjudicated: docs/design/audit/
  // contacts-v12.md findings 1 & 2 (DEC-663 wave-108 amendment, RESOLVED)
  // rule that the product ships a TRUE, differently-worded statement it can
  // actually compute here (the in-file same-email-repeat count,
  // `dedupeCount`) rather than fabricate the frame's plan-sourced count
  // early -- the SAME counts the plan step already computes elsewhere, not
  // an independently-derived tally. This test pins that resolution still
  // holds against the current tree.
  it('the match-summary slot at :507 renders the adjudicated same-file dedupe note, not the frame-literal "existing contact" wording (RESOLVED, contacts-v12.md finding 2)', async () => {
    await renderAtColumnMapping();
    const note = phoneColumn().parentElement?.querySelector('.chq-contacts-import-dedupe');
    if (!note) throw new Error('dedupe note not found');
    expect(note.textContent).toBe('Same-file email repeat: 1 row · the later row wins');
    expect(note.textContent).not.toContain('existing contact');
  });

  it('the pager dock: "Next column" and "Skip", primary-first, carrying the shared phone-dock attribute contract (ImportWizard.tsx ~1094)', async () => {
    await renderAtColumnMapping();
    const dock = phoneDock();
    expect(dock.getAttribute('data-chq-phone-dock')).not.toBeNull();
    const buttons = within(dock).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Next column', 'Skip']);
    expect(buttons[0]).toHaveClass('chq-contacts-import-phone-next');
    expect(buttons[1]).toHaveClass('chq-contacts-import-phone-skip');
  });

  // 44px floor (min-height:48px here, above the floor) + centred flex +
  // horizontal padding, per the campaign's phone-control contract. jsdom
  // never evaluates the max-width:700px layer, so this is a CSS-text pin,
  // same technique as ImportWizard.phoneColumns.render.test.tsx.
  it('the dock buttons meet the 44px floor with centred flex and horizontal padding (contacts-panels.css, phone layer)', () => {
    const next = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-phone-next');
    expect(next).toMatch(/min-height:\s*4[4-9]px/);
    expect(next).toMatch(/align-items:\s*center/);
    expect(next).toMatch(/justify-content:\s*center/);
    expect(next).toMatch(/padding:\s*0\s+16px/);

    const skip = phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-phone-skip');
    expect(skip).toMatch(/min-height:\s*4[4-9]px/);
    expect(skip).toMatch(/align-items:\s*center/);
    expect(skip).toMatch(/padding:\s*0\s+16px/);
  });

  // Falsifiability control mirroring ImportWizard.phoneColumns.render.
  // test.tsx's own: a synthetic sheet lacking the rule must throw, not
  // silently match something else.
  it('phoneLayerRuleBody does not manufacture a match for a sheet that lacks the rule', () => {
    const sheetWithoutTheRule = `
      @media (max-width: 700px) {
        .chq-contacts-import-phone-next { min-height: 48px; }
      }
    `;
    expect(() => phoneLayerRuleBody(sheetWithoutTheRule, '.chq-contacts-import-phone-skip')).toThrow(
      /no phone rule for/,
    );
  });
});
