// v12m-w2-b: the phone-only "one column per screen" pager added for the
// "Import CSV · 390" frame body :487-511 (citation lands on the first `it`
// below, beside its own assertion). This exercises the component-state
// pager itself -- phoneColumnIndex, the radio
// target list, and the Next column/Skip dock -- against jsdom, which never
// evaluates the `@media (max-width: 700px)` layer that actually hides this
// markup at desktop widths, so the phone block and the desktop select grid
// both render at once; queries below are scoped to the phone container
// (`.chq-contacts-import-phone-column`) to disambiguate from the desktop
// grid, which repeats the same column names and sample values. This does
// NOT re-test the injective-mapping constraint
// (ImportWizard.injectiveMapping.render.test.tsx already covers that
// against the shared `mapping` state) or the POST payload -- both are
// untouched by this phone-only presentation layer, per the task's own
// framing.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';
import { mockApi } from '../../test-utils/mockApi';
import type { ImportPlan } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));

// jsdom applies no stylesheet, so a "hidden at phone width" claim can only
// be verified against the CSS TEXT (mirrors contacts-phone-frames.test.ts's
// phoneLayer/phoneRule pair -- a local, minimal copy rather than an import,
// since that file is v12m-w4-a's and stays untouched here).
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

// DEC-663 (wave-87 amendment, contacts-v12.md findings 2 & 3): on the LAST
// column the pager's primary reads "Review N rows" and runs the SAME
// runPreview() the desktop Review step runs -- "Next column"/"Skip" become
// a path INTO the dry run rather than clamping at a dead end. The plan
// below is a minimal, valid ImportPlan shape.
const PLAN: ImportPlan = {
  rows: [{ line: 2, email: 'john@example.com', action: 'create' }],
  created: 1,
  updated: 0,
  skipped: 0,
};

const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme'].join('\n');

function phoneColumn(): HTMLElement {
  const el = document.querySelector('.chq-contacts-import-phone-column');
  if (!el) throw new Error('phone column block not found');
  return el as HTMLElement;
}

// The desktop <select> and the phone radiogroup share the exact same
// `aria-label` ("Map column <col>") because both write through the same
// setColumnMapping(col, ...) call -- getByLabelText/getByRole('radiogroup')
// alone are ambiguous in jsdom, which renders both at once (the @media
// layer that hides one of them is never evaluated here). Scope to the
// <select> element specifically.
function desktopSelect(col: string): HTMLSelectElement {
  const el = document.querySelector(`select[aria-label="Map column ${col}"]`);
  if (!el) throw new Error(`desktop select for ${col} not found`);
  return el as HTMLSelectElement;
}

function phoneColumnName(): HTMLElement {
  const el = phoneColumn().querySelector('.chq-contacts-import-phone-name');
  if (!el) throw new Error('phone column name not found');
  return el as HTMLElement;
}

describe('ImportWizard: phone-only Import CSV pager (v12m-w2-b, frame :487)', () => {
  it('opens on column 1 of N, naming the first column and its sample value', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    await screen.findByText('Column 1 of 4');
    // docs/design/Chautauqua Contacts.dc.html:487 `width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0` -- the "Import CSV · 390" frame body :487-511.
    expect(phoneColumnName().textContent).toBe('First Name');
    expect(within(phoneColumn()).getByText('First three values: John')).toBeInTheDocument();
  });

  it('advances to the next column on "Next column" and keeps the choice already made for the column it leaves', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Column 1 of 4');

    // The radio list for "First Name" mirrors the same `mapping` state as
    // the desktop select -- picking a target here must be visible on the
    // desktop select for the same column too.
    const radiogroup = screen.getByRole('radiogroup', { name: 'Map column First Name' });
    const firstNameTarget = within(radiogroup).getByRole('radio', { name: 'First name' });
    fireEvent.click(firstNameTarget);

    expect(desktopSelect('First Name').value).toBe('firstName');

    fireEvent.click(screen.getByRole('button', { name: 'Next column' }));
    await screen.findByText('Column 2 of 4');
    expect(phoneColumnName().textContent).toBe('Last Name');

    // The selection made on column 1 survives paging away from it.
    expect(desktopSelect('First Name').value).toBe('firstName');
  });

  it('clears the current column\'s mapping and advances on "Skip"', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Column 1 of 4');

    const radiogroup = screen.getByRole('radiogroup', { name: 'Map column First Name' });
    fireEvent.click(within(radiogroup).getByRole('radio', { name: 'First name' }));
    expect(desktopSelect('First Name').value).toBe('firstName');

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await screen.findByText('Column 2 of 4');
    expect(desktopSelect('First Name').value).toBe('');
  });

  it('clamps at the last column -- "Next column" on the final column is a no-op on the index', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Column 1 of 4');

    const next = screen.getByRole('button', { name: 'Next column' });
    fireEvent.click(next); // -> 2 of 4
    fireEvent.click(next); // -> 3 of 4
    fireEvent.click(next); // -> 4 of 4
    fireEvent.click(next); // already last, must stay put

    await screen.findByText('Column 4 of 4');
    expect(phoneColumnName().textContent).toBe('Company');
  });

  it('offers the full target list (skip / standard fields / full name / custom) for the current column, matching the desktop select', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Column 1 of 4');

    const radiogroup = screen.getByRole('radiogroup', { name: 'Map column First Name' });
    expect(within(radiogroup).getByRole('radio', { name: 'Skip this column' })).toBeInTheDocument();
    expect(within(radiogroup).getByRole('radio', { name: 'Full name (splits into first / last)' })).toBeInTheDocument();
    expect(within(radiogroup).getByRole('radio', { name: 'Custom: First Name' })).toBeInTheDocument();
  });

  // DEC-663 (wave-87 amendment): contacts-v12.md finding 3 -- "Next
  // column"/"Skip" clamp through columns 1..N-1 exactly as before, but on
  // the LAST column the primary reads "Review N rows" instead of "Next
  // column" and runs the same dry-run POST the desktop Review step runs.
  it('on the last column the primary reads "Review N rows" and runs the dry run instead of advancing further', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/contacts/import': { body: PLAN } });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Column 1 of 4');

    const next = screen.getByRole('button', { name: 'Next column' });
    fireEvent.click(next); // -> 2 of 4
    fireEvent.click(next); // -> 3 of 4
    fireEvent.click(next); // -> 4 of 4 (last column)
    await screen.findByText('Column 4 of 4');

    const primary = screen.getByRole('button', { name: 'Review 1 row' });
    expect(primary).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next column' })).not.toBeInTheDocument();

    fireEvent.click(primary);
    await screen.findByText('Review the import');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/contacts/import'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  // DEC-663 (wave-87 amendment): "Skip" on the last column clears that
  // column's mapping AND runs the dry run in the same click -- the request
  // must reflect the just-cleared mapping (via runPreview's override
  // argument), never the stale pre-Skip mapping.
  it('"Skip" on the last column clears its mapping and still runs the dry run, into the review step', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/contacts/import': { body: PLAN } });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByText('Column 1 of 4');

    const next = screen.getByRole('button', { name: 'Next column' });
    fireEvent.click(next); // -> 2 of 4
    fireEvent.click(next); // -> 3 of 4
    fireEvent.click(next); // -> 4 of 4 (last column, "Company")
    await screen.findByText('Column 4 of 4');

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByText('Review the import');

    const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(call).toBeDefined();
    const requestBody = JSON.parse((call![1] as RequestInit).body as string);
    expect(requestBody.mapping.Company).toBeUndefined();
  });

  // DEC-663 (wave-87 amendment, contacts-v12.md finding 2): the frame's
  // phone-position "N rows match an existing contact" note has no data at
  // this step (the dry run hasn't run) -- the same-file dedupe note this
  // wizard used to reuse there is now desktop-only, hidden at phone width
  // rather than repositioned under the phone radio list. jsdom applies no
  // stylesheet, so this is a source-scan pin on the CSS text, not computed
  // style (see phoneLayerRuleBody above).
  it('hides the same-file dedupe note at phone width -- nothing stands in for the plan-sourced note before the dry run has run', () => {
    expect(phoneLayerRuleBody(PANELS_CSS, '.chq-contacts-import-dedupe')).toMatch(/display:\s*none/);
  });
});
