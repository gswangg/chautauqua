import { describe, expect, it } from 'vitest';
import { deriveColumnsFromFormFields, formatAnswerValue, visibleColumns } from './columns';
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

describe('formatAnswerValue', () => {
  it('renders null/undefined as empty string', () => {
    expect(formatAnswerValue(null)).toBe('');
    expect(formatAnswerValue(undefined)).toBe('');
  });

  it('renders booleans as Yes/No', () => {
    expect(formatAnswerValue(true)).toBe('Yes');
    expect(formatAnswerValue(false)).toBe('No');
  });

  it('joins arrays with a comma', () => {
    expect(formatAnswerValue(['a', 'b'])).toBe('a, b');
  });

  it('stringifies other values', () => {
    expect(formatAnswerValue(42)).toBe('42');
    expect(formatAnswerValue('hi')).toBe('hi');
  });
});
