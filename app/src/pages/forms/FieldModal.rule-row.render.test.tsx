// DEC-650 (wave 8, frame 02--10 :700-724): the rule builder's Field/Is/Value
// controls share ONE grid row (docs/design/Chautauqua Submissions.dc.html
// :704 grid-template-columns: 1fr 120px 1fr), the intro caption is a fixed
// line under the sentence, and the footer verbs read "Delete this
// question"/"Save the question" per the frame's drawn copy.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldModal } from './FieldModal';
import type { FormField } from './types';

const TITLE: FormField = { id: 'f-title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true };
const FORMAT: FormField = {
  id: 'f-format',
  section: 'session',
  kind: 'dropdown',
  label: 'Format',
  required: false,
  position: 1,
  locked: false,
  options: ['Talk', 'Workshop', 'Panel'],
};
const ALL_FIELDS = [TITLE, FORMAT];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

describe('FieldModal rule row geometry (DEC-650 wave 8, frame 02--10 :704)', () => {
  it('keeps Field, Is and Value inside the same row once a trigger is chosen', () => {
    render(<FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    const fieldSelect = screen.getByLabelText('Field', { selector: 'select' }) as HTMLSelectElement;
    fieldSelect.value = TITLE.id;
    fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const row = fieldSelect.closest('.chq-forms-rule-row') as HTMLElement;
    expect(row).not.toBeNull();

    const isSelect = screen.getByLabelText('Is', { selector: 'select' });
    const valueInput = screen.getByLabelText('Value', { selector: 'input' });
    expect(row.contains(isSelect)).toBe(true);
    expect(row.contains(valueInput)).toBe(true);
  });

  it('renders only the Field control in the row when no trigger is chosen -- the row itself still exists', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    const fieldSelect = screen.getByLabelText('Field', { selector: 'select' });
    const row = fieldSelect.closest('.chq-forms-rule-row');
    expect(row).not.toBeNull();
    expect(screen.queryByLabelText('Is', { selector: 'select' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Value', { selector: 'input' })).not.toBeInTheDocument();
  });
});

describe('FieldModal rule head copy (DEC-650 wave 8, frame 02--10 :700-702)', () => {
  it('renders the sentence and the fixed caption directly under it', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByText('Only show this question when…')).toBeInTheDocument();
    expect(screen.getByText('Leave it off and the question always shows.')).toBeInTheDocument();
  });
});

describe('FieldModal footer verbs (DEC-650 wave 8, frame 02--10 :722-723)', () => {
  it('names the Save action "Save the question"', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByRole('button', { name: 'Save the question' })).toBeInTheDocument();
  });

  it('names the Delete action "Delete this question" when editing', () => {
    render(
      <FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} onDelete={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Delete this question' })).toBeInTheDocument();
  });
});
