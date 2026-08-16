// w2-c: dropdown option COUNT ceiling (MAX_FIELD_OPTIONS, src/domain/form-copy.ts,
// crossed via app/src/lib/batch-caps.ts) must be disclosed at the Options
// textarea and refused locally, mirroring the MAX_FORM_FIELDS idiom on
// FormsPage's Add-a-question control.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FieldModal, type FieldModalInput } from './FieldModal';
import { MAX_FIELD_OPTIONS } from '../../lib/batch-caps';
import type { FormField } from './types';

const TITLE: FormField = { id: 'f-title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true };
const ALL_FIELDS = [TITLE];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

function renderModal(onSubmit: (input: FieldModalInput) => Promise<void>) {
  return render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={onSubmit} />);
}

describe('FieldModal dropdown options cap (MAX_FIELD_OPTIONS)', () => {
  it('shows the "N of MAX_FIELD_OPTIONS options" counter, imported from the crossing module', () => {
    renderModal(async () => {});
    fireEvent.change(screen.getByLabelText('Kind', { selector: 'select' }), { target: { value: 'dropdown' } });
    expect(screen.getByText(`0 of ${MAX_FIELD_OPTIONS} options`)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Options \(one per line\)/, { selector: 'textarea' }), {
      target: { value: 'Beginner\nIntermediate\nAdvanced' },
    });
    expect(screen.getByText(`3 of ${MAX_FIELD_OPTIONS} options`)).toBeInTheDocument();
    expect(MAX_FIELD_OPTIONS).toBe(50);
  });

  it('refuses locally at the cap without calling onSubmit', async () => {
    const onSubmit = vi.fn(async () => {});
    renderModal(onSubmit);
    fireEvent.change(screen.getByLabelText('Label', { selector: 'input' }), { target: { value: 'Track' } });
    fireEvent.change(screen.getByLabelText('Kind', { selector: 'select' }), { target: { value: 'dropdown' } });

    const options = Array.from({ length: MAX_FIELD_OPTIONS + 1 }, (_, i) => `opt-${i}`).join('\n');
    fireEvent.change(screen.getByLabelText(/Options \(one per line\)/, { selector: 'textarea' }), {
      target: { value: options },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save the question' }));

    expect(await screen.findByText(`Max ${MAX_FIELD_OPTIONS} options`)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
