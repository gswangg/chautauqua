// DEC-478 (amendment, wave 47): an import column mapping is INJECTIVE -- no
// two CSV columns may target the same destination field. This exercises the
// SPA's inline refusal (backed by the SAME pure-core validateImportMapping
// the server door calls, never a second copy of the rule): pointing two
// columns at "email" blocks Continue and surfaces a field-level message
// naming both columns, before any preview request is made.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';

afterEach(() => {
  cleanup();
});

const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme'].join('\n');

describe('ImportWizard: DEC-478 (wave 47) injective mapping refusal', () => {
  it('blocks Continue and names both columns when two columns target the same field', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    // Column mapping step: "Company" is auto-suggested to skip/company;
    // point it at "email" too, colliding with the auto-suggested Email
    // column.
    const companySelect = await screen.findByLabelText('Map column Company');
    fireEvent.change(companySelect, { target: { value: 'email' } });

    const errorEl = await screen.findByRole('alert');
    expect(errorEl.textContent).toContain('Email');
    expect(errorEl.textContent).toContain('Company');

    const continueButton = screen.getByRole('button', { name: /^Import \d+ rows?$/ });
    expect(continueButton).toBeDisabled();
  });

  it('does not block Continue once the columns are re-pointed to distinct targets', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const companySelect = await screen.findByLabelText('Map column Company');
    fireEvent.change(companySelect, { target: { value: 'email' } });
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Re-point Company to its own distinct target -- the collision clears.
    fireEvent.change(companySelect, { target: { value: 'company' } });

    const continueButton = screen.getByRole('button', { name: /^Import \d+ rows?$/ });
    expect(continueButton).not.toBeDisabled();
  });
});
