// DEC-650 (wave-3 amendment, eval-findings ALL-PASS A3): closes the
// FieldModal frame residue -- frame 02--10 in
// docs/design/Chautauqua Submissions.dc.html draws the dialog titled
// "Edit a question" at a 560px measure, with the visibility-rule condition
// select reading "is" rather than a raw "eq" token. The frame's "3 of 40"
// options counter is placeholder content, not a geometry, and is
// deliberately NOT asserted here -- MAX_FIELD_OPTIONS stays the single
// source for that number (see FieldModal.render.test.tsx).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
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

describe('FieldModal title (DEC-650 wave-3, frame 02--10)', () => {
  it('titles the create dialog "Add a question" -- the drawn trigger button\'s own grammar', () => {
    render(<FieldModal allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByRole('dialog', { name: 'Add a question' })).toBeInTheDocument();
  });

  it('titles the edit dialog "Edit a question" -- verbatim from the drawn frame', () => {
    render(<FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByRole('dialog', { name: 'Edit a question' })).toBeInTheDocument();
  });
});

describe('FieldModal condition select reads as words, never a raw op token (DEC-650)', () => {
  it('renders the visibility-rule condition options as is / is not / is one of', () => {
    render(<FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    fireEvent.change(screen.getByLabelText('Field', { selector: 'select' }), { target: { value: TITLE.id } });
    const opSelect = screen.getByLabelText('Condition', { selector: 'select' });
    const optionLabels = Array.from(opSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual(['is', 'is not', 'is one of']);
  });
});

describe('FieldModal frame measure (DEC-650 wave-3, frame 02--10)', () => {
  it('carries the modal class the frame\'s 560px measure is scoped to', () => {
    // DEC-732: ModalFrame mounts through a root portal, onto document.body,
    // not into the render container.
    render(<FieldModal field={FORMAT} allFields={ALL_FIELDS} onCancel={() => {}} onSubmit={async () => {}} />);
    expect(document.body.querySelector('.chq-forms-field-modal')).not.toBeNull();
  });

  it('sets max-width: 560px on .chq-forms-field-modal in forms.css -- the frame\'s drawn geometry binds', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(__dirname, 'forms.css'), 'utf8');
    const rule = css.match(/\.chq-forms-field-modal\s*{[^}]*}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain('max-width: 560px');
    expect(rule![0]).not.toContain('520px');
  });
});
