import { describe, expect, it } from 'vitest';
import { buildAnswerRows, resolveAnswerFields, type CfpFormLike } from './detailRows';
import type { FormField } from './types';

const fields: FormField[] = [
  { id: 'f1', section: 'session', kind: 'text', label: 'Level', required: true, position: 1 },
  { id: 'f2', section: 'session', kind: 'checkbox', label: 'First-time speaker', required: false, position: 2 },
];

describe('resolveAnswerFields', () => {
  it('returns the form fields when the form matches detail.formId', () => {
    const form: CfpFormLike = { id: 'form1', fields };
    expect(resolveAnswerFields(form, 'form1')).toBe(fields);
  });

  it('returns an empty list when the form id does not match', () => {
    const form: CfpFormLike = { id: 'form1', fields };
    expect(resolveAnswerFields(form, 'form2')).toEqual([]);
  });

  it('returns an empty list when there is no form or no formId', () => {
    const form: CfpFormLike = { id: 'form1', fields };
    expect(resolveAnswerFields(null, 'form1')).toEqual([]);
    expect(resolveAnswerFields(form, null)).toEqual([]);
  });
});

describe('buildAnswerRows', () => {
  it('labels matched fields and sorts by field position', () => {
    const answers = { f2: true, f1: 'Advanced' };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: 'Yes' },
    ]);
  });

  it('falls back to the raw key when no field matches, sorted after matched fields', () => {
    const answers = { f1: 'Advanced', unknown_key: 'mystery' };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'unknown_key', label: 'unknown_key', displayValue: 'mystery' },
    ]);
  });

  it('returns an empty list for empty answers', () => {
    expect(buildAnswerRows({}, fields)).toEqual([]);
  });

  // DEC-908: a locked built-in field answer (matched via the SAME
  // lockedFieldName helper the builder uses -- never a hand-written list)
  // and a blank/whitespace-only answer are both excluded, while a genuine
  // custom-field answer still renders normally.
  it('excludes a locked built-in field answer and a blank answer', () => {
    const answers = {
      f1: 'Advanced',
      title: 'Should never render as a Form Answers row',
      description: '   ',
      'form1:first_name': 'Also locked, per-form-PK form',
      f2: '',
    };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([{ fieldId: 'f1', label: 'Level', displayValue: 'Advanced' }]);
  });
});
