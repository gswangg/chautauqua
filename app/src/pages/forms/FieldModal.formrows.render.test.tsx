// DEC-958: FieldModal's twelve fields must be built on FormRow
// (app/src/components/ModalFrame) rather than the retired .chq-field
// layout label -- every visible control resolves through its row's
// `.chq-form-row`, and the dialog carries no `chq-field` class anywhere.
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

const ALL_FIELDS = [FORMAT];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

describe('FieldModal field rows (DEC-958)', () => {
  it('resolves every base control to a .chq-form-row', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);

    const sectionRow = screen.getByLabelText('Section', { selector: 'select' }).closest('.chq-form-row');
    const kindRow = screen.getByLabelText('Kind', { selector: 'select' }).closest('.chq-form-row');
    const labelRow = screen.getByLabelText('Label', { selector: 'input' }).closest('.chq-form-row');
    const helpTextRow = screen
      .getByLabelText('Help text', { selector: 'textarea', exact: false })
      .closest('.chq-form-row');
    const triggerRow = screen.getByLabelText('Field', { selector: 'select' }).closest('.chq-form-row');

    for (const row of [sectionRow, kindRow, labelRow, helpTextRow, triggerRow]) {
      expect(row).not.toBeNull();
      expect(row).toHaveClass('chq-form-row');
    }
  });

  it('resolves the dropdown Options field and the rule value control to .chq-form-row', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);

    fireEvent.change(screen.getByLabelText('Kind', { selector: 'select' }), { target: { value: 'dropdown' } });
    const optionsRow = screen
      .getByLabelText('Options (one per line)', { selector: 'textarea', exact: false })
      .closest('.chq-form-row');
    expect(optionsRow).toHaveClass('chq-form-row');

    // Set a trigger with an 'options' value control (Format), op !== 'in'
    // (the default 'equals'), so the Value select renders as a FormRow too.
    fireEvent.change(screen.getByLabelText('Field', { selector: 'select' }), { target: { value: FORMAT.id } });
    const valueRow = screen.getByLabelText('Value', { selector: 'select' }).closest('.chq-form-row');
    expect(valueRow).toHaveClass('chq-form-row');
  });

  it('keeps Required as a checkbox label, not a FormRow', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    const requiredCheckbox = screen.getByLabelText('Required', { selector: 'input' });
    expect(requiredCheckbox.closest('.chq-form-row')).toBeNull();
    expect(requiredCheckbox.closest('label')).toHaveClass('chq-checkbox-label');
  });

  it('renders no element carrying the chq-field class', () => {
    const { container } = render(
      <FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Kind', { selector: 'select' }), { target: { value: 'dropdown' } });
    fireEvent.change(screen.getByLabelText('Field', { selector: 'select' }), { target: { value: FORMAT.id } });
    fireEvent.change(screen.getByLabelText('Is', { selector: 'select' }), { target: { value: 'in' } });

    expect(container.querySelectorAll('.chq-field').length).toBe(0);
  });
});
