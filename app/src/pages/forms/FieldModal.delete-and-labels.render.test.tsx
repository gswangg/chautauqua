// DEC-650 (wave-66 amendment): the condition <select> speaks the SAME
// vocabulary describeCondition already uses for the FieldList row prose --
// 'is' / 'is not' / 'is one of', never the raw eq/ne/in token -- and the
// modal grows a far-left footer Delete (rendered only when editing) that
// reuses the caller's onDelete handler rather than owning a second delete
// path.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldModal } from './FieldModal';
import type { FormField } from './types';

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
const TITLE: FormField = { id: 'f-title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true };

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

describe('FieldModal condition select vocabulary (DEC-650 wave-66)', () => {
  it('renders is/is not/is one of as the option labels, never the raw eq/ne/in token', () => {
    render(
      <FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Field', { selector: 'select' }), { target: { value: TITLE.id } });
    const opSelect = screen.getByLabelText('Is', { selector: 'select' });
    const optionLabels = Array.from(opSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual(['is', 'is not', 'is one of']);
    expect(optionLabels).not.toContain('eq');
    expect(optionLabels).not.toContain('ne');
    expect(optionLabels).not.toContain('in');
    // Values stay the raw tokens -- only the label changes.
    const optionValues = Array.from(opSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toEqual(['eq', 'ne', 'in']);
  });

  it('never exposes a raw eq/ne/in token anywhere in the rendered modal', () => {
    render(
      <FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Field', { selector: 'select' }), { target: { value: TITLE.id } });
    expect(screen.queryByText('eq')).not.toBeInTheDocument();
    expect(screen.queryByText('ne')).not.toBeInTheDocument();
    expect(screen.queryByText(/^in$/)).not.toBeInTheDocument();
  });
});

describe('FieldModal footer Delete (DEC-650 wave-66)', () => {
  it('renders no Delete control when creating a new field', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.queryByRole('button', { name: 'Delete this question' })).not.toBeInTheDocument();
  });

  it('renders no Delete control when editing without an onDelete handler', () => {
    render(<FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.queryByRole('button', { name: 'Delete this question' })).not.toBeInTheDocument();
  });

  it('renders a far-left Delete when editing with onDelete, and calls the passed-in handler on click', () => {
    const onDelete = vi.fn();
    render(
      <FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} onDelete={onDelete} />,
    );
    const deleteBtn = screen.getByRole('button', { name: 'Delete this question' });
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
