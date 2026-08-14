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
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
      { fieldId: 'unknown_key', label: 'unknown_key', displayValue: 'mystery' },
    ]);
  });

  // DEC-908 amendment: buildAnswerRows enumerates `fields`, not `answers` --
  // every non-locked form field gets a row even with zero answers, so an
  // unanswered optional question (e.g. "Accessibility needs") still reads
  // as a real question rather than vanishing.
  it('enumerates every field even with no answers at all, using the em dash', () => {
    expect(buildAnswerRows({}, fields)).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: '—' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
    ]);
  });

  it('renders the em dash for a form field with no stored answer, alongside its answered sibling', () => {
    const answers = { f1: 'Advanced' };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
    ]);
  });

  it('renders the em dash for a blank/whitespace-only stored answer too', () => {
    const answers = { f1: 'Advanced', f2: '   ' };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
    ]);
  });

  // DEC-908: a locked built-in field answer (matched via the SAME
  // lockedFieldName helper the builder uses -- never a hand-written list)
  // is excluded, never rendered as a Form Answers row, whether it comes
  // through as a form field or a stray answer key.
  it('excludes a locked built-in field answer', () => {
    const answers = {
      f1: 'Advanced',
      title: 'Should never render as a Form Answers row',
      'form1:first_name': 'Also locked, per-form-PK form',
    };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
    ]);
  });

  it('still excludes a locked field even when it appears in `fields`', () => {
    const fieldsWithLocked: FormField[] = [
      ...fields,
      { id: 'title', section: 'session', kind: 'text', label: 'Title', required: true, position: 0 },
    ];
    const rows = buildAnswerRows({ f1: 'Advanced', title: 'My talk' }, fieldsWithLocked);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
    ]);
  });

  it('sorts an orphan answer key (no matching field) last, in raw key order', () => {
    const answers = { f1: 'Advanced', zeta: 'z', alpha: 'a' };
    const rows = buildAnswerRows(answers, fields);
    expect(rows).toEqual([
      { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
      { fieldId: 'f2', label: 'First-time speaker', displayValue: '—' },
      { fieldId: 'alpha', label: 'alpha', displayValue: 'a' },
      { fieldId: 'zeta', label: 'zeta', displayValue: 'z' },
    ]);
  });

  // DEC-920: a 'file'-kind field's stored answer is an opaque file id
  // (DEC-040) -- resolved against answerFiles instead of the generic
  // formatAnswerValue, so the row carries enough for the view to render an
  // anchor rather than the bare id.
  describe('file-kind answers (DEC-920)', () => {
    const fileFields: FormField[] = [
      { id: 'f1', section: 'session', kind: 'text', label: 'Level', required: true, position: 1 },
      { id: 'f3', section: 'session', kind: 'file', label: 'Slides', required: false, position: 2 },
    ];

    it('resolves a matching file id to a link', () => {
      const answers = { f1: 'Advanced', f3: 'file-1' };
      const answerFiles = [{ id: 'file-1', filename: 'slides.pdf', sizeBytes: 4096 }];
      const rows = buildAnswerRows(answers, fileFields, answerFiles);
      expect(rows).toEqual([
        { fieldId: 'f1', label: 'Level', displayValue: 'Advanced' },
        {
          fieldId: 'f3',
          label: 'Slides',
          displayValue: 'slides.pdf',
          file: { href: '/files/file-1', filename: 'slides.pdf', sizeBytes: 4096 },
        },
      ]);
    });

    it('renders the literal "File removed" (never the bare id) when the id has no matching answerFiles row', () => {
      const answers = { f1: 'Advanced', f3: 'file-deleted' };
      const rows = buildAnswerRows(answers, fileFields, []);
      const fileRow = rows.find((r) => r.fieldId === 'f3');
      expect(fileRow).toEqual({ fieldId: 'f3', label: 'Slides', displayValue: 'File removed' });
      expect(fileRow?.displayValue).not.toContain('file-deleted');
    });

    it('renders the em dash for an unanswered file field', () => {
      const rows = buildAnswerRows({ f1: 'Advanced' }, fileFields, []);
      expect(rows.find((r) => r.fieldId === 'f3')).toEqual({ fieldId: 'f3', label: 'Slides', displayValue: '—' });
    });
  });
});
