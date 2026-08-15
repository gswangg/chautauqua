// DEC-505 amendment (wave 54): the Section select now carries a muted
// consequence line stating what the choice means for anonymised review,
// since section is the anonymisation boundary (not "pure grouping" per
// DEC-505's original clause). The line switches with the select.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldModal } from './FieldModal';
import type { FormField } from './types';

const ALL_FIELDS: FormField[] = [];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

describe('FieldModal Section consequence line (DEC-505 wave-54 amendment)', () => {
  it('shows the session-section line by default (new field defaults to session)', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByText('Shown to reviewers, including on an anonymised plan.')).toBeInTheDocument();
    expect(screen.queryByText('Hidden from reviewers while a plan is anonymised.')).not.toBeInTheDocument();
  });

  it('switches to the speaker-section line when Section is changed to Speaker', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    fireEvent.change(screen.getByLabelText('Section', { selector: 'select' }), { target: { value: 'speaker' } });
    expect(screen.getByText('Hidden from reviewers while a plan is anonymised.')).toBeInTheDocument();
    expect(screen.queryByText('Shown to reviewers, including on an anonymised plan.')).not.toBeInTheDocument();
  });

  it('renders the line inside the Section FormRow, in the muted meta register', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    const line = screen.getByText('Shown to reviewers, including on an anonymised plan.');
    expect(line).toHaveClass('chq-meta');
    expect(line.closest('.chq-form-row')).not.toBeNull();
  });
});
