// v12m-w2-b: the phone-only "one column per screen" pager added for frame
// docs/design/Chautauqua Contacts.dc.html:487 (`<div style="width:390px;
// height:844px; ...">`, the "Import CSV · 390" frame body :487-511). This
// exercises the component-state pager itself -- phoneColumnIndex, the radio
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
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';

afterEach(() => {
  cleanup();
});

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
});
