import { describe, expect, it } from 'vitest';
import { deriveColumnsFromFormFields, findFormatField, visibleColumns } from './columns';
import type { FormField } from './types';

const fields: FormField[] = [
  { id: 'f2', section: 'session', kind: 'text', label: 'Track preference', required: false, position: 2 },
  { id: 'f1', section: 'session', kind: 'dropdown', label: 'Level', required: true, position: 1, options: ['Beginner', 'Advanced'] },
  { id: 'f3', section: 'speaker', kind: 'checkbox', label: 'First-time speaker', required: false, position: 3 },
];

describe('deriveColumnsFromFormFields', () => {
  it('sorts columns by field.position', () => {
    const cols = deriveColumnsFromFormFields(fields);
    expect(cols.map((c) => c.fieldId)).toEqual(['f1', 'f2', 'f3']);
  });

  it('preserves label/section/kind for each column', () => {
    const cols = deriveColumnsFromFormFields(fields);
    expect(cols[0]).toEqual({ fieldId: 'f1', label: 'Level', section: 'session', kind: 'dropdown' });
  });

  it('does not mutate the input array', () => {
    const copy = [...fields];
    deriveColumnsFromFormFields(fields);
    expect(fields).toEqual(copy);
  });
});

describe('visibleColumns', () => {
  it('filters to only the toggled-on field ids, preserving derived order', () => {
    const cols = deriveColumnsFromFormFields(fields);
    const visible = visibleColumns(cols, new Set(['f3', 'f1']));
    expect(visible.map((c) => c.fieldId)).toEqual(['f1', 'f3']);
  });

  it('returns an empty list when nothing is visible', () => {
    const cols = deriveColumnsFromFormFields(fields);
    expect(visibleColumns(cols, new Set())).toEqual([]);
  });
});

describe('findFormatField', () => {
  it('matches a dropdown field labeled "Format"', () => {
    const f: FormField = { id: 'f1', section: 'session', kind: 'dropdown', label: 'Format', required: false, position: 1 };
    expect(findFormatField([f])).toBe(f);
  });

  it('matches with surrounding whitespace and mixed case', () => {
    const f: FormField = { id: 'f1', section: 'session', kind: 'dropdown', label: ' FORMAT ', required: false, position: 1 };
    expect(findFormatField([f])).toBe(f);
  });

  it('matches the seeded fixture label "Session format" (DEC-249)', () => {
    const f: FormField = { id: 'f1', section: 'session', kind: 'dropdown', label: 'Session format', required: false, position: 1 };
    expect(findFormatField([f])).toBe(f);
  });

  it('does not substring-match "Reimbursement format"', () => {
    const f: FormField = { id: 'f1', section: 'session', kind: 'dropdown', label: 'Reimbursement format', required: false, position: 1 };
    expect(findFormatField([f])).toBeUndefined();
  });

  it('does not match a text field labeled "Format" (kind gate)', () => {
    const f: FormField = { id: 'f1', section: 'session', kind: 'text', label: 'Format', required: false, position: 1 };
    expect(findFormatField([f])).toBeUndefined();
  });

  it('returns undefined for an empty field list', () => {
    expect(findFormatField([])).toBeUndefined();
  });
});
